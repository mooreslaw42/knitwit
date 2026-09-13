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
  kitSummary,
  materialLabel,
  SectionKitEditor,
  toolLabel,
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
  const materials = useKnitwitStore((state) => state.materials);
  const tools = useKnitwitStore((state) => state.tools);
  const techniques = useKnitwitStore((state) => state.techniques);
  const setActiveSection = useKnitwitStore((state) => state.setActiveSection);
  const updateSection = useKnitwitStore((state) => state.updateSection);
  const deleteSection = useKnitwitStore((state) => state.deleteSection);
  const setSectionKit = useKnitwitStore((state) => state.setSectionKit);
  const seconds = useLiveSeconds(key, sectionIndex);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftRows, setDraftRows] = useState('');
  const [picking, setPicking] = useState(false);

  if (!project) return null;
  const section = project.sections[sectionIndex];
  if (!section) return null;

  const status = sectionStatus(section);
  const pct = section.totalRows ? section.row / section.totalRows : 0;
  const sortedNotes = [...section.notes].sort((a, b) => a.row - b.row);

  const kit = {
    materialIds: section.materialIds,
    toolIds: section.toolIds,
    techniqueIds: section.techniqueIds,
  };
  // Everything the section is worked with, on one line. Yarn first because that's what a knitter
  // reaches for the section by.
  const worksWith = [
    kitSummary(section.materialIds, materials, materialLabel),
    kitSummary(section.toolIds, tools, toolLabel),
    kitSummary(section.techniqueIds, techniques, (t) => t.name),
  ]
    .filter(Boolean)
    .join(' · ');

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

          {/* One card, three lists. It used to be two cards showing one yarn and one tool, styled
              to read as buttons — "+ Add material" — with nothing at all wired behind them. The
              singular was wrong twice over: nothing could be set, and a section worked in two
              colours had nowhere to say so. */}
          <Card style={styles.card}>
            {picking ? (
              <>
                <SectionKitEditor
                  value={kit}
                  onChange={(next) => setSectionKit(key, sectionIndex, next)}
                />
                <Pressable
                  hitSlop={6}
                  style={styles.pickDone}
                  onPress={() => setPicking(false)}>
                  <ThemedText type="smallBold" themeColor="inkSoft">
                    Done
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.pickRow} onPress={() => setPicking(true)}>
                <ThemedText type="small" themeColor="inkSoft">
                  Worked with
                </ThemedText>
                <ThemedText type="smallBold" themeColor={worksWith ? 'ink' : 'sageDeep'}>
                  {worksWith || '+ Add yarn, tools & techniques'}
                </ThemedText>
              </Pressable>
            )}
          </Card>

          {/* The written instructions and the chart read from them — the pair a pattern section
              has always had and a project section could not hold at all. */}
          <Card style={styles.card}>
            <ThemedText type="small" themeColor="inkSoft">
              Instructions & stitches
            </ThemedText>
            {section.description.trim() ? (
              <ThemedText type="default" numberOfLines={3}>
                {section.description.trim()}
              </ThemedText>
            ) : null}
            <Pressable
              hitSlop={6}
              style={styles.pickDone}
              onPress={() => router.push(`/project/${key}/section/${sectionIndex}/stitches`)}>
              <ThemedText type="smallBold" themeColor="sageDeep">
                {section.rows.length > 0
                  ? `${section.rows.length} ${section.rows.length === 1 ? 'row' : 'rows'} charted — open the stitch editor →`
                  : section.description.trim()
                    ? 'Chart these stitches →'
                    : '+ Write the instructions & chart the stitches'}
              </ThemedText>
            </Pressable>
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
  pickDone: {
    alignSelf: 'flex-start',
    paddingTop: Spacing.two,
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
