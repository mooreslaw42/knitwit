import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SectionStitchEditor } from '@/components/section-stitch-editor';
import { NotesCard } from '@/components/notes-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { goBackOr } from '@/lib/navigation';
import { usePageTitle } from '@/lib/use-page-title';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function SectionStitchesScreen() {
  const { id, index } = useLocalSearchParams<{ id: string; index: string }>();
  const sectionIndex = Number(index);
  const router = useRouter();

  const pattern = useKnitwitStore((state) => state.patterns[id]);
  const savePattern = useKnitwitStore((state) => state.savePattern);
  const setPatternSectionNotes = useKnitwitStore((state) => state.setPatternSectionNotes);
  const section = pattern?.sections[sectionIndex];
  usePageTitle(section ? `${section.name} · ${pattern?.name ?? ''}` : undefined);

  // The pattern or section can be missing (deep link, or deleted in another tab).
  if (!pattern || !section) return null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" heading={1}>{section.name}</ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            {pattern.name} · stitch-by-stitch
          </ThemedText>

          {/* Above the editor and outside its Save, for the same reason as everywhere else. */}
          <NotesCard
            value={section.notes}
            onChange={(notes) => setPatternSectionNotes(id, sectionIndex, notes)}
            hint="About this section. Saved as you type."
          />

          <SectionStitchEditor
            initial={{
              description: section.description,
              castOn: section.castOn,
              rows: section.rows,
            }}
            craft={pattern.craft}
            sizes={pattern.sizes}
            patternGauge={pattern.gauge}
            swatchGauge={pattern.swatchGauge}
            multiple={section.stitchMultiple}
            onSave={(draft) => {
              savePattern(id, {
                ...pattern,
                sections: pattern.sections.map((s, idx) =>
                  idx === sectionIndex ? { ...s, ...draft } : s,
                ),
              });
              goBackOr(router, `/pattern/${id}`);
            }}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.three,
  },
});
