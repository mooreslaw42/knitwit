import { Pressable, StyleSheet, View } from 'react-native';

import { AutoGrowInput } from '@/components/auto-grow-input';
import { Card, FormField, PillButton } from '@/components/knitwit-ui';
import { SectionKitEditor, type SectionKit } from '@/components/stash-picker';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';

// A section as the wizard holds it: rows kept as a string so a half-typed number never
// round-trips through a parse and reappears as "0" mid-keystroke — the same reason
// PatternSectionsEditor does it.
export type DraftSection = SectionKit & {
  name: string;
  totalRows: string;
  description: string;
  // Whether the knitter has narrowed this section's kit by hand. Until they have, it follows the
  // project's. Tracked rather than inferred from an empty kit: the first project-level pick would
  // fill the section in, and every pick after it would then look like the knitter's own choice.
  kitTouched: boolean;
};

export function blankSection(kit: SectionKit): DraftSection {
  return {
    name: '',
    totalRows: '60',
    description: '',
    kitTouched: false,
    // Starts with everything the project is made of, since that's the common case for an
    // improvised piece worked in one yarn on one set of needles. Narrowing is a tap.
    ...kit,
  };
}

// The pieces an improvised project is knitted in, planned before it is cast on. The project
// counterpart of PatternSectionsEditor: same shape of question, different answers — a pattern
// names generic slots, a project points at the knitter's own stash.
export function ProjectSectionsEditor({
  sections,
  kit,
  onChange,
}: {
  sections: DraftSection[];
  // What the project as a whole uses, from the step before. Each section chooses from within it.
  kit: SectionKit;
  onChange: (sections: DraftSection[]) => void;
}) {
  const update = (i: number, patch: Partial<DraftSection>) =>
    onChange(sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const hasKit = kit.materialIds.length + kit.toolIds.length + kit.techniqueIds.length > 0;

  return (
    <View style={styles.wrap}>
      {sections.map((section, i) => (
        <Card key={i} style={styles.card}>
          <View style={styles.head}>
            <ThemedText type="smallBold">Section {i + 1}</ThemedText>
            {/* A project must always have something to count, so the last one can't go — the same
                rule the section screen enforces once the project exists. */}
            {sections.length > 1 && (
              <Pressable hitSlop={8} onPress={() => onChange(sections.filter((_, x) => x !== i))}>
                <ThemedText type="smallBold" themeColor="coralDeep">
                  Remove
                </ThemedText>
              </Pressable>
            )}
          </View>

          <FormField
            label="Section name"
            value={section.name}
            onChangeText={(v) => update(i, { name: v })}
            placeholder="e.g. Body, Left sleeve"
          />
          <FormField
            label="Rows"
            value={section.totalRows}
            onChangeText={(v) => update(i, { totalRows: v })}
            keyboardType="numeric"
            placeholder="60"
          />

          <View style={styles.field}>
            <ThemedText type="smallBold" themeColor="inkSoft">
              Instructions (optional)
            </ThemedText>
            <ThemedText type="small" themeColor="inkSoft">
              Anything you want to remember. You can chart it stitch by stitch afterwards.
            </ThemedText>
            <AutoGrowInput
              value={section.description}
              onChangeText={(v) => update(i, { description: v })}
              placeholder="e.g. K2, *yo, k2tog; rep from * to last 2 sts, k2."
              minHeight={72}
              style={styles.pasteBox}
            />
          </View>

          {hasKit && (
            <SectionKitEditor
              value={section}
              onChange={(next) => update(i, { ...next, kitTouched: true })}
              only={kit}
            />
          )}
        </Card>
      ))}

      <PillButton
        variant="secondary"
        onPress={() => onChange([...sections, blankSection(kit)])}>
        <ThemedText type="smallBold" themeColor="ink">
          + Add section
        </ThemedText>
      </PillButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  card: { gap: Spacing.three },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  field: { gap: Spacing.one },
  pasteBox: {
    backgroundColor: Colors.cream,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    color: Colors.ink,
    minHeight: 72,
    textAlignVertical: 'top',
  },
});
