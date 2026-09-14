import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TOOL_TYPE_LABELS } from '@/constants/catalogs';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { resolveTechnique } from '@/lib/technique-catalogue';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Material, ProjectSection, Technique, Tool } from '@/types/knitwit';

export const materialLabel = (m: Material) => `${m.brand} — ${m.colorName}`;
export const toolLabel = (t: Tool) => `${t.thickness} ${TOOL_TYPE_LABELS[t.type]}`;

export type SectionKit = Pick<ProjectSection, 'materialIds' | 'toolIds' | 'techniqueIds'>;

export const EMPTY_KIT: SectionKit = { materialIds: [], toolIds: [], techniqueIds: [] };

// A row of everything in the stash, the chosen ones filled in. Same control the pattern editor
// uses for its slots, because it's the same question — what does this section use? — and a project
// section carries lists for exactly the reasons a pattern section does: a yoke worked in two
// colours, a body that swaps to DPNs at the crown.
function ChipToggles({
  label,
  options,
  selected,
  onToggle,
  emptyHint,
  addLabel,
  addHref,
  hideAdd = false,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  emptyHint: string;
  addLabel: string;
  addHref: Href;
  hideAdd?: boolean;
}) {
  const router = useRouter();

  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" themeColor="inkSoft">
        {label}
      </ThemedText>
      {options.length > 0 ? (
        <View style={styles.chipRow}>
          {options.map((opt) => {
            const on = selected.includes(opt.id);
            return (
              <Pressable
                key={opt.id}
                onPress={() => onToggle(opt.id)}
                style={[styles.chip, on && styles.chipOn]}>
                <ThemedText
                  type="smallBold"
                  numberOfLines={1}
                  style={styles.chipText}
                  themeColor={on ? 'white' : 'inkSoft'}>
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <ThemedText type="small" themeColor="inkSoft">
          {emptyHint}
        </ThemedText>
      )}
      {/* The stash is empty far more often than it looks from seed data, and without this the
          answer to "my yarn isn't here" was nothing at all. Hidden when the choices are already
          narrowed to a project's own kit: the place to widen that is the step above, not the
          library. */}
      {!hideAdd && (
        <Pressable hitSlop={6} style={styles.addLink} onPress={() => router.push(addHref)}>
          <ThemedText type="smallBold" themeColor="sageDeep">
            {addLabel}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

// Yarn, tools and techniques for one project section, picked out of the knitter's own library.
//
// The same three a pattern carries, offered on a project whether or not it came from one — an
// improvised make has yarn and needles and calls for a tubular cast-on just as much as a written
// pattern does.
export function SectionKitEditor({
  value,
  onChange,
  only,
}: {
  value: SectionKit;
  onChange: (kit: SectionKit) => void;
  // Narrows the choices to what the project as a whole uses. Offering the entire stash per
  // section is right on an existing project — you reach for whatever is to hand — but wrong in
  // the wizard, where the step before has just asked what this project is made of.
  only?: SectionKit;
}) {
  const materials = useKnitwitStore((state) => state.materials);
  const tools = useKnitwitStore((state) => state.tools);
  const techniques = useKnitwitStore((state) => state.techniques);
  const catalogue = useKnitwitStore((state) => state.catalogue);

  const limit = (entries: [string, unknown][], allowed: string[] | undefined) =>
    allowed ? entries.filter(([id]) => allowed.includes(id)) : entries;

  const toggle = (field: keyof SectionKit, id: string) =>
    onChange({
      ...value,
      [field]: value[field].includes(id)
        ? value[field].filter((x) => x !== id)
        : [...value[field], id],
    });

  return (
    <View style={styles.wrap}>
      <ChipToggles
        label="Yarn"
        options={limit(Object.entries(materials), only?.materialIds).map(([id, m]) => ({
          id,
          label: materialLabel(m as Material),
        }))}
        selected={value.materialIds}
        onToggle={(id) => toggle('materialIds', id)}
        emptyHint={only ? 'No yarn chosen for this project.' : 'No yarn in your library yet.'}
        addLabel="+ Add a yarn to your library"
        addHref="/material/new"
        hideAdd={!!only}
      />
      <ChipToggles
        label="Tools"
        options={limit(Object.entries(tools), only?.toolIds).map(([id, t]) => ({
          id,
          label: toolLabel(t as Tool),
        }))}
        selected={value.toolIds}
        onToggle={(id) => toggle('toolIds', id)}
        emptyHint={only ? 'No tools chosen for this project.' : 'No needles or hooks in your library yet.'}
        addLabel="+ Add a tool to your library"
        addHref="/tool/new"
        hideAdd={!!only}
      />
      <ChipToggles
        label="Techniques"
        options={limit(Object.entries(techniques), only?.techniqueIds).map(([id, t]) => ({
          id,
          label: resolveTechnique(id, t as Technique, catalogue).name,
        }))}
        selected={value.techniqueIds}
        onToggle={(id) => toggle('techniqueIds', id)}
        emptyHint={only ? 'No techniques chosen for this project.' : 'No techniques in your library yet.'}
        addLabel="+ Add a technique to your library"
        addHref="/technique/new"
        hideAdd={!!only}
      />
    </View>
  );
}

// "Rico Design — Blossom Pink, Drops — Sage Green" — what a section is worked with, for the places
// that only need to show it. Empty string when there's nothing, so the caller can fall back.
export function kitSummary<T>(
  ids: string[],
  stash: Record<string, T>,
  label: (item: T) => string,
): string {
  return ids
    .filter((id) => id in stash)
    .map((id) => label(stash[id]))
    .join(', ');
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  group: { gap: Spacing.one },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipOn: { backgroundColor: Colors.blushDeep },
  // A chip grows to its text; without a ceiling one long yarn name pushes past the card edge.
  chipText: { maxWidth: 260 },
  addLink: { alignSelf: 'flex-start', paddingVertical: Spacing.one },
});
