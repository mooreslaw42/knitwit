import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Card,
  DeleteButton,
  FormField,
  PillButton,
  ProgressBar,
  StatusBadge,
} from '@/components/knitwit-ui';
import {
  materialLabel,
  MaterialPicker,
  toolLabel,
  ToolPicker,
} from '@/components/stash-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { formatClock, sectionStatus } from '@/lib/knitwit-helpers';
import { goBackOr } from '@/lib/navigation';
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
  const updateSection = useKnitwitStore((state) => state.updateSection);
  const deleteSection = useKnitwitStore((state) => state.deleteSection);
  const setSectionMaterial = useKnitwitStore((state) => state.setSectionMaterial);
  const setSectionTool = useKnitwitStore((state) => state.setSectionTool);
  const seconds = useLiveSeconds(key, sectionIndex);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftRows, setDraftRows] = useState('');
  // Only one picker open at a time — two dropdowns unfurled at once on a phone leaves nothing of
  // the section itself on screen.
  const [picking, setPicking] = useState<'material' | 'tool' | null>(null);

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
            <View style={styles.headerActions}>
              <StatusBadge status={status} />
              <Pressable
                hitSlop={8}
                onPress={() => {
                  setDraftName(section.name);
                  setDraftRows(String(section.totalRows));
                  setEditing((v) => !v);
                }}>
                <ThemedText type="default">✎</ThemedText>
              </Pressable>
            </View>
          </View>
          <ThemedText type="default" themeColor="inkSoft">
            Row {section.row} of {section.totalRows}
          </ThemedText>
          <ProgressBar pct={pct} color={project.colorDeep} />

          {editing && (
            <Card style={styles.editCard}>
              <FormField label="Section name" value={draftName} onChangeText={setDraftName} />
              <FormField
                label="Rows"
                value={draftRows}
                onChangeText={setDraftRows}
                keyboardType="numeric"
              />
              {parseInt(draftRows, 10) < section.row && (
                <ThemedText type="small" themeColor="coralDeep">
                  You have counted to row {section.row}; shortening to {parseInt(draftRows, 10)}{' '}
                  will pull your progress back.
                </ThemedText>
              )}
              <PillButton
                onPress={() => {
                  updateSection(key, sectionIndex, {
                    name: draftName,
                    totalRows: parseInt(draftRows, 10) || section.totalRows,
                  });
                  setEditing(false);
                }}>
                <ThemedText type="smallBold" themeColor="white">
                  Save section
                </ThemedText>
              </PillButton>
              {project.sections.length > 1 ? (
                <DeleteButton
                  onPress={() => {
                    deleteSection(key, sectionIndex);
                    goBackOr(router, `/project/${key}`);
                  }}
                />
              ) : (
                <ThemedText type="small" themeColor="inkSoft">
                  This is the only section, so it cannot be deleted — a project needs something
                  to count.
                </ThemedText>
              )}
            </Card>
          )}

          <Card style={styles.card}>
            <ThemedText type="small" themeColor="inkSoft">
              Time spent
            </ThemedText>
            <ThemedText type="smallBold">{formatClock(seconds)}</ThemedText>
          </Card>

          {/* Tap the card to open the picker. These two read as buttons — "+ Add material" — and
              for a long time weren't: nothing at all was wired behind them, and a section's yarn
              and needles could only ever be set by the pattern a project was stamped from. */}
          <Card style={styles.card}>
            {picking === 'material' ? (
              <MaterialPicker
                value={section.materialId}
                onChange={(id) => {
                  setSectionMaterial(key, sectionIndex, id);
                  setPicking(null);
                }}
              />
            ) : (
              <Pressable style={styles.pickRow} onPress={() => setPicking('material')}>
                <ThemedText type="small" themeColor="inkSoft">
                  Material
                </ThemedText>
                <ThemedText type="smallBold" themeColor={material ? 'ink' : 'sageDeep'}>
                  {material ? materialLabel(material) : '+ Add material'}
                </ThemedText>
              </Pressable>
            )}
          </Card>

          <Card style={styles.card}>
            {picking === 'tool' ? (
              <ToolPicker
                value={section.toolId}
                onChange={(id) => {
                  setSectionTool(key, sectionIndex, id);
                  setPicking(null);
                }}
              />
            ) : (
              <Pressable style={styles.pickRow} onPress={() => setPicking('tool')}>
                <ThemedText type="small" themeColor="inkSoft">
                  Tool
                </ThemedText>
                <ThemedText type="smallBold" themeColor={tool ? 'ink' : 'sageDeep'}>
                  {tool ? toolLabel(tool) : '+ Add tool'}
                </ThemedText>
              </Pressable>
            )}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  editCard: {
    gap: Spacing.three,
  },
  card: {
    gap: 2,
  },
  pickRow: {
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
