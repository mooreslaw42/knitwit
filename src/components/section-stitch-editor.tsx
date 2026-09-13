import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { AutoGrowInput } from '@/components/auto-grow-input';
import {
  Card,
  FormField,
  PillButton,
  SelectField,
} from "@/components/knitwit-ui";
import { RegaugePanel } from "@/components/regauge-panel";
import { StitchChart, type ChartSelection } from "@/components/stitch-chart";
import { ThemedText } from "@/components/themed-text";
import { STITCHES, STITCH_ORDER } from "@/constants/catalogs";
import { Colors, Fonts, Radii, Spacing } from "@/constants/theme";
import {
  formatSizeRun,
  parseSizeRun,
  rowStitchesAfter,
  sectionRowCounts,
  sizeValue,
} from "@/lib/knitwit-helpers";
import { EdgeFunctionAborted } from "@/lib/edge-function";
import {
  convertRowsRemotely,
  mergeRemoteRows,
  sectionRowsFrom,
  unparsedRowIndexes,
} from "@/lib/parse-pattern-remote";
import {
  parseSectionText,
  reconcileRowCounts,
  type ParseIssue,
} from "@/lib/parse-pattern-text";
import type {
  Gauge,
  PatternRow,
  PatternStitchGroup,
  SizedNumber,
  StitchMultiple,
  StitchSide,
  StitchSpan,
} from "@/types/knitwit";

type EditGroup = {
  id: string;
  type: string;
  span: StitchSpan;
  count: string;
  materialSlot: string | null;
  note: string;
};
type EditRow = {
  id: string;
  label: string;
  side: StitchSide;
  marker: boolean;
  instruction: string;
  stitches: EditGroup[];
};

let uidN = 1;
const uid = (p: string) => `${p}${Date.now().toString(36)}${uidN++}`;

const STITCH_OPTIONS = STITCH_ORDER.map((k) => ({
  value: k,
  label: `${STITCHES[k].abbr} · ${STITCHES[k].label}`,
}));

const SPANS: { value: StitchSpan; label: string }[] = [
  { value: "exact", label: "Times" },
  { value: "all", label: "Across" },
  { value: "to-last", label: "To last" },
];

function toEditGroup(g: PatternStitchGroup): EditGroup {
  return {
    id: g.id,
    type: g.type,
    span: g.span,
    count: formatSizeRun(g.count),
    materialSlot: g.materialSlot,
    note: g.note,
  };
}
function toEditRow(r: PatternRow): EditRow {
  return {
    id: r.id,
    label: r.label,
    side: r.side,
    marker: r.marker,
    instruction: r.instruction,
    stitches: r.stitches.map(toEditGroup),
  };
}
function toGroup(g: EditGroup): PatternStitchGroup {
  return {
    id: g.id,
    type: g.type,
    span: g.span,
    // A run like "6 (6) 7 (7) 9" becomes one number per size; a single number stays scalar.
    count: g.span === "all" ? null : parseSizeRun(g.count),
    materialSlot: g.materialSlot,
    note: g.note.trim(),
  };
}
function toRow(r: EditRow, i: number): PatternRow {
  return {
    id: r.id,
    label: r.label.trim() || `Row ${i + 1}`,
    side: r.side,
    marker: r.marker,
    instruction: r.instruction.trim(),
    stitches: r.stitches.map(toGroup),
  };
}

// A short readable summary of a group, e.g. "k2", "M1L", "k to last 1", "p across".
function groupLabel(g: EditGroup): string {
  const def = STITCHES[g.type];
  const abbr = def ? def.abbr : g.type;
  if (g.span === "all") return `${abbr} across`;
  if (g.span === "to-last") return `${abbr} to last ${g.count || "?"}`;
  return `${abbr}${def && def.takes > 0 && g.count ? g.count : ""}`;
}

// What the editor reads and writes. Deliberately the three fields and nothing else: the caller
// owns where they came from and where they go.
export type StitchDraft = {
  description: string;
  castOn: SizedNumber;
  rows: PatternRow[];
};

// The stitch-by-stitch editor for one section — the written text, the deterministic parse, the AI
// read, cast-on, the chart, row and stitch-group CRUD, and the re-gauge comparison.
//
// Shared by a pattern section and a project section. It was a pattern screen for a long time and
// none of it turned out to be pattern-specific: it takes a description, a cast-on and rows, and
// hands the same three back. A project has all three too — it just had no way to reach them.
//
// `sizes` is the only thing that really differs. A pattern is written for several at once and the
// chart can only draw one, so it offers a preview switch; a project is knitted in one size, passes
// an empty list, and never sees the chips.
export function SectionStitchEditor({
  initial,
  sizes = [],
  patternGauge = null,
  swatchGauge = null,
  multiple = null,
  saveLabel = "Save stitches",
  onSave,
}: {
  initial: StitchDraft;
  sizes?: string[];
  patternGauge?: Gauge | null;
  swatchGauge?: Gauge | null;
  multiple?: StitchMultiple | null;
  saveLabel?: string;
  onSave: (draft: StitchDraft) => void;
}) {
  const [description, setDescription] = useState(initial.description);
  const [castOn, setCastOn] = useState(formatSizeRun(initial.castOn));
  const [rows, setRows] = useState<EditRow[]>(() =>
    initial.rows.map(toEditRow),
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Which stitch group the user tapped in the chart, if any.
  const [selected, setSelected] = useState<ChartSelection | null>(null);
  // A pattern is written for every size at once; the chart can only draw one, so pick which.
  const [sizePreview, setSizePreview] = useState(0);
  // A pending conversion of the written text, held for review before it replaces anything.
  const [preview, setPreview] = useState<{
    rows: EditRow[];
    issues: ParseIssue[];
    ignored: string[];
    // The counts the pattern states about itself, kept so the check can be re-run after the model
    // fills in rows the tokenizer refused.
    expectedCounts: (number | null)[];
    // Set once the model has been asked, so the card can say what read the rows.
    model: string | null;
  } | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  // A ref, not state: the unmount cleanup below never sees a re-render's state, and leaving the
  // screen has to actually stop the request rather than just ignore its answer.
  const askRef = useRef<AbortController | null>(null);
  useEffect(() => () => askRef.current?.abort(), []);

  const convert = () => {
    const result = parseSectionText(description);
    const issues = [
      ...result.issues,
      ...reconcileRowCounts(result.rows, result.expectedCounts, startCount),
    ];
    setAskError(null);
    // Descriptive patterns state the cast-on in prose ("Cast on 6 (6) 7 sts using 3mm needles")
    // rather than in a field. If the text said so, take it — it's what the chart counts from, and
    // leaving it at 0 makes every row after it wrong.
    if (result.castOn != null) setCastOn(formatSizeRun(result.castOn));
    setPreview({
      rows: result.rows.map(toEditRow),
      issues,
      ignored: result.ignoredLines,
      expectedCounts: result.expectedCounts,
      model: null,
    });
  };

  // The model half of the hybrid: hand it only the rows the tokenizer refused, merge what comes
  // back, then re-run the stitch-count check over the whole section. Nothing is applied by this —
  // it updates the same review card, which the knitter still has to accept.
  const askModel = async () => {
    if (!preview) return;
    const previewRows = preview.rows.map(toRow);
    const indexes = unparsedRowIndexes(previewRows);
    // Nothing parsed at all — there are no refusals to name, so the model charts the whole
    // section instead and its reading replaces what little is there.
    const wholeSection = previewRows.length === 0;
    if (indexes.length === 0 && !wholeSection) return;

    const controller = new AbortController();
    askRef.current = controller;
    setAsking(true);
    setAskError(null);
    try {
      const result = await convertRowsRemotely({
        sectionText: description,
        rows: previewRows,
        indexes,
        sizes,
        stitchesBefore: startCount,
        signal: controller.signal,
      });
      const merged = wholeSection
        ? sectionRowsFrom(result.rows)
        : mergeRemoteRows(previewRows, result.rows);
      setPreview({
        ...preview,
        rows: merged.rows.map(toEditRow),
        // Recomputed rather than appended: the old refusal issues are superseded by whatever the
        // model did with those rows, and the counts change once rows are filled in.
        //
        // The stitch-count check runs over the model's rows too. It's the same free validator the
        // parser gets, and it's the reason a whole-section replacement is safe to offer: if the
        // model's reading contradicts what the pattern says about itself, that shows up here
        // rather than in a chart the knitter trusts. Section mode has no per-row expected counts
        // to check against, so it reconciles against nothing and simply passes.
        issues: [
          ...merged.issues,
          ...reconcileRowCounts(
            merged.rows,
            wholeSection ? [] : preview.expectedCounts,
            startCount,
          ),
        ],
        model: result.model,
      });
    } catch (error) {
      // Stopping on purpose isn't a failure; the review card just goes back to how it was.
      if (error instanceof EdgeFunctionAborted) return;
      setAskError(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      if (askRef.current === controller) askRef.current = null;
      setAsking(false);
    }
  };

  // Derived before the missing-pattern guard: everything here reads component state, not the
  // section, and an early return sitting above these declarations trips up the React Compiler's
  // memoisation (it hoists them into a block that runs regardless).
  const patternRows = rows.map(toRow);
  const castOnSized = parseSizeRun(castOn) ?? 0;
  const startCount = Math.max(0, sizeValue(castOnSized, sizePreview));
  const before = sectionRowCounts(patternRows, startCount, sizePreview);
  // Resolve the tapped cell back to a group; rows can change underneath a stale selection.
  const selectedGroup = selected
    ? (rows[selected.rowIndex]?.stitches[selected.groupIndex] ?? null)
    : null;
  // Rows in the pending preview that still have no stitches — what the model would be asked about.
  const previewUnparsed = preview
    ? unparsedRowIndexes(preview.rows.map(toRow))
    : [];

  const updateRow = (i: number, patch: Partial<EditRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updateGroup = (ri: number, gi: number, patch: Partial<EditGroup>) =>
    setRows((rs) =>
      rs.map((r, idx) =>
        idx === ri
          ? {
              ...r,
              stitches: r.stitches.map((g, gx) =>
                gx === gi ? { ...g, ...patch } : g,
              ),
            }
          : r,
      ),
    );

  const addRow = () => {
    const nr: EditRow = {
      id: uid("r"),
      label: "",
      side: rows.length % 2 === 0 ? "RS" : "WS",
      marker: false,
      instruction: "",
      stitches: [
        {
          id: uid("g"),
          type: "knit",
          span: "all",
          count: "",
          materialSlot: null,
          note: "",
        },
      ],
    };
    setRows((rs) => [...rs, nr]);
    setExpanded((e) => ({ ...e, [nr.id]: true }));
  };

  return (
    <>
      {/* The written instruction this section was set up with — the source the stitches are
              charted from, so it stays visible right above the chart. */}
      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="inkSoft">
          Pattern text
        </ThemedText>
        <AutoGrowInput
          value={description}
          onChangeText={setDescription}
          placeholder="Write or paste this section's instructions…"
          style={styles.patternText}
        />
        {description.trim().length > 0 && (
          <PillButton
            variant="secondary"
            style={styles.convertBtn}
            disabled={asking}
            onPress={convert}
          >
            <ThemedText type="smallBold" themeColor="ink">
              Convert to stitches
            </ThemedText>
          </PillButton>
        )}
      </View>

      {preview && (
        <Card style={styles.previewCard}>
          <ThemedText type="smallBold">
            Found {preview.rows.length}{" "}
            {preview.rows.length === 1 ? "row" : "rows"}
          </ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            {rows.length > 0
              ? `Applying replaces the ${rows.length} ${rows.length === 1 ? "row" : "rows"} already charted here.`
              : "Nothing is charted yet, so this just fills it in."}
          </ThemedText>

          {preview.issues.length > 0 && (
            <View style={styles.issueList}>
              <ThemedText type="smallBold" themeColor="coralDeep">
                {preview.issues.length} to check
              </ThemedText>
              {preview.issues.slice(0, 6).map((issue, i) => (
                <ThemedText key={i} type="small" themeColor="inkSoft">
                  · {issue.message}
                </ThemedText>
              ))}
              {preview.issues.length > 6 && (
                <ThemedText type="small" themeColor="inkSoft">
                  · and {preview.issues.length - 6} more
                </ThemedText>
              )}
            </View>
          )}

          {preview.ignored.length > 0 && (
            <ThemedText type="small" themeColor="inkSoft">
              Skipped {preview.ignored.length} non-row{" "}
              {preview.ignored.length === 1 ? "line" : "lines"} (headings,
              notes).
            </ThemedText>
          )}

          {/* Rows the tokenizer wouldn't guess at. Asking the model is opt-in and costs a
                  request, so it's a button rather than something that happens automatically. */}
          {(previewUnparsed.length > 0 || preview.rows.length === 0) && (
            <View style={styles.field}>
              <ThemedText type="small" themeColor="inkSoft">
                {preview.rows.length === 0
                  ? "This section isn't written in a form Knitwit can read on its own. The AI can chart it — your text is kept either way."
                  : `${previewUnparsed.length} ${
                      previewUnparsed.length === 1 ? "row was" : "rows were"
                    } too irregular to read here — ${
                      previewUnparsed.length === 1 ? "its" : "their"
                    } wording is kept either way.`}
              </ThemedText>
              <View style={styles.inline}>
                <PillButton
                  variant="secondary"
                  style={styles.convertBtn}
                  loading={asking}
                  onPress={askModel}
                >
                  <ThemedText type="smallBold" themeColor="ink">
                    {asking
                      ? "Reading…"
                      : preview.rows.length === 0
                        ? "Read this section with AI"
                        : `Read ${previewUnparsed.length === 1 ? "it" : "them"} with AI`}
                  </ThemedText>
                </PillButton>
                {asking && (
                  <Pressable
                    hitSlop={8}
                    onPress={() => askRef.current?.abort()}
                  >
                    <ThemedText type="smallBold" themeColor="coralDeep">
                      Stop
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {preview.model && previewUnparsed.length === 0 && (
            <ThemedText type="small" themeColor="sageDeep">
              Every row is charted.
            </ThemedText>
          )}

          {askError && (
            <ThemedText type="small" themeColor="coralDeep">
              {askError}
            </ThemedText>
          )}

          <View style={styles.inline}>
            {/* Locked while the model is working: applying or cancelling mid-request would
                    land the merge on rows that are no longer on screen. */}
            <PillButton
              style={styles.grow}
              disabled={asking}
              onPress={() => {
                setRows(preview.rows);
                setSelected(null);
                setPreview(null);
                setAskError(null);
              }}
            >
              <ThemedText type="smallBold" themeColor="white">
                Apply
              </ThemedText>
            </PillButton>
            <PillButton
              variant="secondary"
              style={styles.grow}
              disabled={asking}
              onPress={() => {
                setPreview(null);
                setAskError(null);
              }}
            >
              <ThemedText type="smallBold" themeColor="ink">
                Cancel
              </ThemedText>
            </PillButton>
          </View>
        </Card>
      )}

      {sizes.length > 1 && (
        <View style={styles.field}>
          <ThemedText type="smallBold" themeColor="inkSoft">
            Previewing size
          </ThemedText>
          <View style={styles.inline}>
            {sizes.map((label, i) => (
              <Pressable
                key={label + i}
                onPress={() => setSizePreview(i)}
                style={[styles.chip, sizePreview === i && styles.chipOn]}
              >
                <ThemedText
                  type="smallBold"
                  themeColor={sizePreview === i ? "white" : "inkSoft"}
                >
                  {label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <FormField
        label={
          sizes.length > 1
            ? "Cast on — one number per size, e.g. 6 (6) 7 (7) 9"
            : "Cast on (stitches to start from)"
        }
        value={castOn}
        onChangeText={setCastOn}
        placeholder="0"
      />

      {rows.length === 0 && (
        <ThemedText type="small" themeColor="inkSoft">
          No rows yet. Add the first row to build the stitch-by-stitch overview.
        </ThemedText>
      )}

      {/* What this section becomes at the knitter's swatch gauge. Read-only — re-gauging is
              applied to a project, never written back over the pattern. */}
      <RegaugePanel
        rows={patternRows}
        castOn={startCount}
        patternGauge={patternGauge}
        swatchGauge={swatchGauge}
        multiple={multiple}
        sizeIndex={sizePreview}
      />

      {rows.length > 0 && (
        <Card style={styles.chartCard}>
          <ThemedText type="smallBold">Chart</ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            Read bottom-up, stitches right-to-left. Shaded rows are worked from
            the wrong side. Tap a stitch to edit it.
          </ThemedText>
          <StitchChart
            rows={patternRows}
            castOn={startCount}
            sizeIndex={sizePreview}
            selected={selected}
            onSelectStitch={setSelected}
          />

          {selectedGroup && selected && (
            <View style={styles.selPanel}>
              <View style={styles.selHead}>
                <ThemedText type="smallBold">
                  Row {selected.rowIndex + 1} · stitch {selected.groupIndex + 1}
                </ThemedText>
                <Pressable hitSlop={8} onPress={() => setSelected(null)}>
                  <ThemedText type="smallBold" themeColor="inkSoft">
                    Done
                  </ThemedText>
                </Pressable>
              </View>
              {/* A stitch marker belongs to the row, so it is settable from here too. */}
              <View style={styles.inline}>
                <SideToggle
                  value={rows[selected.rowIndex].side}
                  onChange={(v) => updateRow(selected.rowIndex, { side: v })}
                />
                <Pressable
                  onPress={() =>
                    updateRow(selected.rowIndex, {
                      marker: !rows[selected.rowIndex].marker,
                    })
                  }
                  style={[
                    styles.chip,
                    rows[selected.rowIndex].marker && styles.chipOn,
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    themeColor={
                      rows[selected.rowIndex].marker ? "white" : "inkSoft"
                    }
                  >
                    📍 Marker on row {selected.rowIndex + 1}
                  </ThemedText>
                </Pressable>
              </View>
              <GroupFields
                group={selectedGroup}
                onChange={(patch) =>
                  updateGroup(selected.rowIndex, selected.groupIndex, patch)
                }
                onRemove={() => {
                  const target = rows[selected.rowIndex];
                  updateRow(selected.rowIndex, {
                    stitches: target.stitches.filter(
                      (_, x) => x !== selected.groupIndex,
                    ),
                  });
                  setSelected(null);
                }}
              />
            </View>
          )}
        </Card>
      )}

      {rows.map((row, ri) => {
        const after = rowStitchesAfter(
          patternRows[ri],
          before[ri],
          sizePreview,
        );
        const delta = after - before[ri];
        const isOpen = expanded[row.id];
        return (
          <Card key={row.id} style={styles.rowCard}>
            <Pressable
              style={styles.rowHead}
              onPress={() =>
                setExpanded((e) => ({ ...e, [row.id]: !e[row.id] }))
              }
            >
              <View style={styles.rowHeadMain}>
                <ThemedText type="smallBold" themeColor="inkSoft">
                  {isOpen ? "▾" : "▸"}
                </ThemedText>
                <View style={styles.grow}>
                  <ThemedText type="smallBold">
                    Row {ri + 1} · {row.side}
                    {row.marker ? "  📍" : ""}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    themeColor="inkSoft"
                    numberOfLines={1}
                  >
                    {row.stitches.map(groupLabel).join(", ") || "No stitches"}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold" themeColor="sageDeep">
                  {after} sts{delta ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}
                </ThemedText>
              </View>
            </Pressable>

            {isOpen && (
              <View style={styles.rowBody}>
                <View style={styles.inline}>
                  <SideToggle
                    value={row.side}
                    onChange={(v) => updateRow(ri, { side: v })}
                  />
                  <Pressable
                    onPress={() => updateRow(ri, { marker: !row.marker })}
                    style={[styles.chip, row.marker && styles.chipOn]}
                  >
                    <ThemedText
                      type="smallBold"
                      themeColor={row.marker ? "white" : "inkSoft"}
                    >
                      📍 Marker
                    </ThemedText>
                  </Pressable>
                </View>

                <FormField
                  label="Instruction (optional)"
                  value={row.instruction}
                  onChangeText={(v) => updateRow(ri, { instruction: v })}
                  placeholder="e.g. K1, M1L, knit to last st, M1R, K1."
                />

                <ThemedText type="smallBold" themeColor="inkSoft">
                  Stitches
                </ThemedText>
                {row.stitches.map((g, gi) => (
                  <GroupFields
                    key={g.id}
                    group={g}
                    onChange={(patch) => updateGroup(ri, gi, patch)}
                    onRemove={() =>
                      updateRow(ri, {
                        stitches: row.stitches.filter((_, x) => x !== gi),
                      })
                    }
                  />
                ))}
                <Pressable
                  hitSlop={6}
                  style={styles.addLink}
                  onPress={() =>
                    updateRow(ri, {
                      stitches: [
                        ...row.stitches,
                        {
                          id: uid("g"),
                          type: "knit",
                          span: "all",
                          count: "",
                          materialSlot: null,
                          note: "",
                        },
                      ],
                    })
                  }
                >
                  <ThemedText type="smallBold" themeColor="blushDeep">
                    + Add stitch
                  </ThemedText>
                </Pressable>

                <Pressable
                  hitSlop={6}
                  style={styles.addLink}
                  onPress={() => setRows((rs) => rs.filter((_, x) => x !== ri))}
                >
                  <ThemedText type="smallBold" themeColor="coralDeep">
                    Remove row
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </Card>
        );
      })}

      <PillButton variant="secondary" style={styles.addRowBtn} onPress={addRow}>
        <ThemedText type="smallBold" themeColor="ink">
          + Add row
        </ThemedText>
      </PillButton>

      <PillButton
        style={styles.saveBtn}
        onPress={() =>
          onSave({ description, castOn: castOnSized, rows: patternRows })
        }
      >
        <ThemedText type="smallBold" themeColor="white">
          {saveLabel}
        </ThemedText>
      </PillButton>
    </>
  );
}

// The editable controls for one stitch group — shared by the expanded row list and the
// tap-a-cell-in-the-chart editor, so both always offer exactly the same fields.
function GroupFields({
  group,
  onChange,
  onRemove,
}: {
  group: EditGroup;
  onChange: (patch: Partial<EditGroup>) => void;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.groupCard}>
      <SelectField
        label="Stitch"
        options={STITCH_OPTIONS}
        value={group.type}
        onChange={(v) => onChange({ type: v })}
      />
      <View style={styles.inline}>
        {SPANS.map((sp) => (
          <Pressable
            key={sp.value}
            onPress={() => onChange({ span: sp.value })}
            style={[styles.chip, group.span === sp.value && styles.chipOn]}
          >
            <ThemedText
              type="smallBold"
              themeColor={group.span === sp.value ? "white" : "inkSoft"}
            >
              {sp.label}
            </ThemedText>
          </Pressable>
        ))}
        {group.span !== "all" && (
          <TextInput
            value={group.count}
            onChangeText={(v) => onChange({ count: v })}
            keyboardType="numeric"
            placeholder={group.span === "to-last" ? "leave" : "count"}
            placeholderTextColor={Colors.inkSoft}
            style={[styles.input, styles.countInput]}
          />
        )}
      </View>
      <View style={styles.inline}>
        <TextInput
          value={group.note}
          onChangeText={(v) => onChange({ note: v })}
          placeholder="Note (optional)"
          placeholderTextColor={Colors.inkSoft}
          style={[styles.input, styles.grow]}
        />
        {onRemove && (
          <Pressable hitSlop={8} onPress={onRemove}>
            <ThemedText type="default" themeColor="inkSoft">
              ✕
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function SideToggle({
  value,
  onChange,
}: {
  value: StitchSide;
  onChange: (v: StitchSide) => void;
}) {
  return (
    <View style={styles.sideToggle}>
      {(["RS", "WS"] as StitchSide[]).map((s) => (
        <Pressable
          key={s}
          onPress={() => onChange(s)}
          style={[styles.chip, value === s && styles.chipOn]}
        >
          <ThemedText
            type="smallBold"
            themeColor={value === s ? "white" : "inkSoft"}
          >
            {s}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: { gap: Spacing.two },
  selPanel: {
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.creamDeep,
    paddingTop: Spacing.three,
    marginTop: Spacing.one,
  },
  selHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowCard: { gap: Spacing.three },
  rowHead: { flexDirection: "row" },
  rowHeadMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    flex: 1,
  },
  rowBody: { gap: Spacing.three },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  sideToggle: { flexDirection: "row", gap: Spacing.two },
  groupCard: {
    gap: Spacing.two,
    backgroundColor: Colors.cream,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
  chip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipOn: { backgroundColor: Colors.blushDeep },
  input: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    color: Colors.ink,
  },
  countInput: { width: 90 },
  field: { gap: Spacing.one },
  patternText: { minHeight: 88, textAlignVertical: "top" },
  convertBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  previewCard: { gap: Spacing.two },
  issueList: { gap: Spacing.one },
  grow: { flex: 1 },
  addLink: { alignSelf: "flex-start", paddingVertical: Spacing.one },
  addRowBtn: { marginTop: Spacing.one },
  saveBtn: { marginTop: Spacing.two },
});
