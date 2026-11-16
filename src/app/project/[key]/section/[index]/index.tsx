import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { KnitIcon } from '@/components/icons/KnitIcon';
import {
  Card,
  ConfirmButton,
  FormField,
  IconButton,
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
import { NotesCard } from '@/components/notes-card';
import { resolveTechnique, techniqueLabel } from '@/lib/technique-catalogue';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/screen';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { formatClock, sectionStatus } from '@/lib/knitwit-helpers';
import { goBackOr, goToCounter } from '@/lib/navigation';
import { useLiveSeconds } from '@/lib/use-live-seconds';
import { usePageTitle } from '@/lib/use-page-title';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function SectionDetailScreen() {
  const { key, index } = useLocalSearchParams<{ key: string; index: string }>();
  const sectionIndex = Number(index);
  const router = useRouter();

  const project = useKnitwitStore((state) => state.projects[key]);
  const materials = useKnitwitStore((state) => state.materials);
  const tools = useKnitwitStore((state) => state.tools);
  const techniques = useKnitwitStore((state) => state.techniques);
  const catalogue = useKnitwitStore((state) => state.catalogue);
  const setActiveSection = useKnitwitStore((state) => state.setActiveSection);
  const updateSection = useKnitwitStore((state) => state.updateSection);
  const deleteSection = useKnitwitStore((state) => state.deleteSection);
  const setSectionKit = useKnitwitStore((state) => state.setSectionKit);
  const setSectionNotes = useKnitwitStore((state) => state.setSectionNotes);
  const seconds = useLiveSeconds(key, sectionIndex);
  usePageTitle(project?.sections[sectionIndex]?.name);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftRows, setDraftRows] = useState('');
  const [picking, setPicking] = useState(false);

  if (!project) return null;
  const section = project.sections[sectionIndex];
  if (!section) return null;

  const status = sectionStatus(section);
  const pct = section.totalRows ? section.row / section.totalRows : 0;
  const sortedNotes = [...section.rowNotes].sort((a, b) => a.row - b.row);

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
    kitSummary(section.techniqueIds, techniques, () => '').trim()
      ? section.techniqueIds
          .map((tid) => techniqueLabel(resolveTechnique(tid, techniques[tid], catalogue)))
          .join(', ')
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const complete = status === 'complete';

  return (
    <Screen
      kind="pushed"
      // Pinned, not at the end of the scroll. Counting is what a section is for, and the button
      // that starts it used to sit underneath every card on the screen — on a section with a few
      // notes that was two screens down.
      footer={
        <PillButton
          onPress={() => {
            setActiveSection(key, sectionIndex);
            goToCounter(router);
          }}>
          <View style={styles.continueInner}>
            <KnitIcon name="play" size={16} color={Colors.white} accent={Colors.white} />
            <ThemedText type="default" themeColor="white" style={styles.continueText}>
              {complete ? 'Open in the counter' : section.row > 0 ? 'Continue counting' : 'Start counting'}
            </ThemedText>
          </View>
        </PillButton>
      }>
          <View style={styles.headerRow}>
            <ThemedText type="title" heading={1} style={styles.title}>
              {section.name}
            </ThemedText>
            <View style={styles.headerActions}>
              <View>
                <StatusBadge status={status} />
              </View>
              <IconButton
                icon={editing ? 'close' : 'edit'}
                label={editing ? 'Stop editing this section' : 'Edit this section'}
                onPress={() => {
                  setDraftName(section.name);
                  setDraftRows(String(section.totalRows));
                  setEditing((v) => !v);
                }}
              />
            </View>
          </View>
          <ThemedText type="body" themeColor="inkSoft">
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
                <ConfirmButton
                  label="Delete this section"
                  question="Delete this section? The rows you've counted, the time against it and its notes go with it, and can't be brought back."
                  confirmLabel="Yes, delete it"
                  onConfirm={() => {
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

          <NotesCard
            value={section.notes}
            onChange={(notes) => setSectionNotes(key, sectionIndex, notes)}
            hint="About this section. Saved as you type."
          />

          {sortedNotes.length > 0 && (
            <>
              {/* "Row notes", because the card above is also called Notes and these are a different
                  thing: left from the counter, each pinned to the row it was written on. */}
              <ThemedText type="subtitle" heading={2} style={styles.notesTitle}>
                Row notes
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: { flex: 1 },
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
  continueInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  continueText: { fontFamily: Fonts.bodyExtrabold },
});
