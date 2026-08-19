import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PillButton, ProgressBar, StatusBadge } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { formatClock, sectionStatus } from '@/lib/knitwit-helpers';
import { useLiveSeconds } from '@/lib/use-live-seconds';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function SectionDetailScreen() {
  const { key, index } = useLocalSearchParams<{ key: string; index: string }>();
  const sectionIndex = Number(index);
  const router = useRouter();

  const project = useKnitwitStore((state) => state.projects[key]);
  const material = useKnitwitStore((state) =>
    project?.sections[sectionIndex]?.materialId
      ? state.materials[project.sections[sectionIndex].materialId!]
      : null,
  );
  const tool = useKnitwitStore((state) =>
    project?.sections[sectionIndex]?.toolId
      ? state.tools[project.sections[sectionIndex].toolId!]
      : null,
  );
  const setActiveSection = useKnitwitStore((state) => state.setActiveSection);
  const seconds = useLiveSeconds(key, sectionIndex);

  if (!project) return null;
  const section = project.sections[sectionIndex];
  if (!section) return null;

  const status = sectionStatus(section);
  const pct = section.totalRows ? section.row / section.totalRows : 0;
  const sortedNotes = [...section.notes].sort((a, b) => a.row - b.row);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <ThemedText type="title">{section.name}</ThemedText>
            <StatusBadge status={status} />
          </View>
          <ThemedText type="default" themeColor="inkSoft">
            Row {section.row} of {section.totalRows}
          </ThemedText>
          <ProgressBar pct={pct} color={project.colorDeep} />

          <Card style={styles.card}>
            <ThemedText type="small" themeColor="inkSoft">
              Time spent
            </ThemedText>
            <ThemedText type="smallBold">{formatClock(seconds)}</ThemedText>
          </Card>

          <Card style={styles.card}>
            <ThemedText type="small" themeColor="inkSoft">
              Material
            </ThemedText>
            <ThemedText type="smallBold">
              {material ? `${material.brand} — ${material.colorName}` : '+ Add material'}
            </ThemedText>
          </Card>

          <Card style={styles.card}>
            <ThemedText type="small" themeColor="inkSoft">
              Tool
            </ThemedText>
            <ThemedText type="smallBold">
              {tool ? `${tool.thickness} ${tool.length}` : '+ Add tool'}
            </ThemedText>
          </Card>

          {sortedNotes.length > 0 && (
            <>
              <ThemedText type="subtitle" style={styles.notesTitle}>
                Notes
              </ThemedText>
              <View style={styles.notesList}>
                {sortedNotes.map((note) => (
                  <Card key={note.id} style={styles.noteCard}>
                    <ThemedText type="small" themeColor="inkSoft">
                      Row {note.row}
                    </ThemedText>
                    <ThemedText type="default">{note.text}</ThemedText>
                  </Card>
                ))}
              </View>
            </>
          )}

          <PillButton
            style={styles.continueBtn}
            onPress={() => {
              setActiveSection(key, sectionIndex);
              router.push('/counter');
            }}>
            <ThemedText type="smallBold" themeColor="white">
              Continue counting →
            </ThemedText>
          </PillButton>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  card: {
    gap: 2,
  },
  notesTitle: {
    marginTop: Spacing.three,
  },
  notesList: {
    gap: Spacing.two,
  },
  noteCard: {
    gap: 2,
  },
  continueBtn: {
    marginTop: Spacing.four,
  },
});
