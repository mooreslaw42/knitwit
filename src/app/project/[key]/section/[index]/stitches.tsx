import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SectionStitchEditor } from '@/components/section-stitch-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { sizeValue } from '@/lib/knitwit-helpers';
import { goBackOr } from '@/lib/navigation';
import { usePageTitle } from '@/lib/use-page-title';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function ProjectSectionStitchesScreen() {
  const { key, index } = useLocalSearchParams<{ key: string; index: string }>();
  const sectionIndex = Number(index);
  const router = useRouter();

  const project = useKnitwitStore((state) => state.projects[key]);
  const setSectionStitches = useKnitwitStore((state) => state.setSectionStitches);
  const section = project?.sections[sectionIndex];
  usePageTitle(section ? `${section.name} · stitches` : undefined);

  if (!project || !section) return null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" heading={1}>{section.name}</ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            {project.name} · stitch-by-stitch
          </ThemedText>
          {/* Said out loud rather than left to be discovered. A project's chart is its own copy,
              taken when it was cast on, so editing it here is editing this project — the pattern
              in the library is not touched and neither is anything else made from it. */}
          {project.patternId ? (
            <ThemedText type="small" themeColor="inkSoft">
              Changes here are yours alone — the pattern this came from stays as it is.
            </ThemedText>
          ) : null}

          <SectionStitchEditor
            initial={{
              description: section.description,
              castOn: section.castOn,
              rows: section.rows,
            }}
            craft={project.craft}
            // No size chips: a project is knitted in one size, resolved when it was created.
            sizes={[]}
            patternGauge={project.gauge?.pattern ?? null}
            swatchGauge={project.gauge?.mine ?? null}
            multiple={section.stitchMultiple}
            onSave={(draft) => {
              setSectionStitches(key, sectionIndex, {
                ...draft,
                // The editor speaks per-size because a pattern does; a project takes the one size
                // it is being knitted in and stores a plain number, as it does everywhere else.
                castOn: sizeValue(draft.castOn, project.sizeIndex),
              });
              goBackOr(router, `/project/${key}/section/${sectionIndex}`);
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
