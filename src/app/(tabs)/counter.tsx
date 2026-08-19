import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { formatClock } from '@/lib/knitwit-helpers';
import { useLiveSeconds } from '@/lib/use-live-seconds';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function CounterScreen() {
  const router = useRouter();
  const activeProjectKey = useKnitwitStore((state) => state.activeProjectKey);
  const activeSectionIndex = useKnitwitStore((state) => state.activeSectionIndex);
  const project = useKnitwitStore((state) => state.projects[activeProjectKey]);
  // Every project can be deleted, which leaves nothing to count.
  const section = project?.sections[activeSectionIndex];

  const dismissedMarkerRow = useKnitwitStore((state) => state.dismissedMarkerRow);
  const castOffDismissed = useKnitwitStore((state) => state.castOffDismissed);
  const noteFormOpen = useKnitwitStore((state) => state.noteFormOpen);

  const changeRow = useKnitwitStore((state) => state.changeRow);
  const toggleTimer = useKnitwitStore((state) => state.toggleTimer);
  const confirmMarker = useKnitwitStore((state) => state.confirmMarker);
  const dismissMarker = useKnitwitStore((state) => state.dismissMarker);
  const dismissCastOff = useKnitwitStore((state) => state.dismissCastOff);
  const confirmCastOff = useKnitwitStore((state) => state.confirmCastOff);
  const openNoteForm = useKnitwitStore((state) => state.openNoteForm);
  const closeNoteForm = useKnitwitStore((state) => state.closeNoteForm);
  const saveNote = useKnitwitStore((state) => state.saveNote);

  const timerKey = useKnitwitStore((state) => state.timerKey);
  const isTimerRunning = timerKey === `${activeProjectKey}|${activeSectionIndex}`;
  const liveSeconds = useLiveSeconds(activeProjectKey, activeSectionIndex);

  const [noteText, setNoteText] = useState('');

  if (!project || !section) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            Nothing to count yet
          </ThemedText>
          <ThemedText type="small" themeColor="inkSoft" style={styles.centerText}>
            Start a project from the Home tab, then come back here to count your rows.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const atMarker =
    !noteFormOpen &&
    !section.complete &&
    section.markers.includes(section.row) &&
    dismissedMarkerRow !== section.row;
  const showCastOff =
    !noteFormOpen &&
    !section.complete &&
    !atMarker &&
    section.row >= section.totalRows &&
    !castOffDismissed;
  const showComplete = !noteFormOpen && section.complete;
  const hideMain = atMarker || showCastOff || showComplete || noteFormOpen;

  const nextMarker = section.markers.find((m) => m > section.row);
  let markerHint: string | null = null;
  if (!section.complete && !noteFormOpen) {
    if (nextMarker !== undefined) {
      markerHint = `📍 Stitch marker at row ${nextMarker} — ${nextMarker - section.row} to go`;
    } else if (section.markers.length && section.row < section.totalRows) {
      markerHint = `🎉 Final stretch — ${section.totalRows - section.row} rows to go`;
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.topbar}>
          <Pressable onPress={toggleTimer} style={styles.timerBtn}>
            <ThemedText type="smallBold" themeColor="ink">
              {isTimerRunning ? '⏸' : '▶'} {formatClock(liveSeconds)}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              setNoteText('');
              openNoteForm();
            }}
            hitSlop={8}>
            <ThemedText type="default">📝</ThemedText>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push(`/project/${activeProjectKey}/section/${activeSectionIndex}`)}
          style={styles.sectionLink}
          hitSlop={8}>
          <ThemedText type="smallBold" style={styles.label}>
            {project.name}
          </ThemedText>
          <ThemedText type="small" themeColor="inkSoft" style={styles.section}>
            {section.name}
          </ThemedText>
        </Pressable>

        {noteFormOpen && (
          <AlertCard borderColor={Colors.coralDeep} icon="📝" title="Add a note">
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="What happened at this row?"
              placeholderTextColor={Colors.inkSoft}
              style={styles.noteInput}
            />
            <View style={styles.alertBtnRow}>
              <AlertButton label="Cancel" onPress={closeNoteForm} variant="cancel" />
              <AlertButton
                label="✓ Save note"
                onPress={() => {
                  saveNote(section.row, noteText);
                  setNoteText('');
                }}
                variant="set"
              />
            </View>
          </AlertCard>
        )}

        {atMarker && (
          <AlertCard borderColor={Colors.coralDeep} icon="📍" title="Place a stitch marker">
            <ThemedText type="small" themeColor="inkSoft">
              Row {section.row}
            </ThemedText>
            <View style={styles.alertBtnRow}>
              <AlertButton label="Cancel" onPress={dismissMarker} variant="cancel" />
              <AlertButton label="✓ Marker set" onPress={confirmMarker} variant="set" />
            </View>
          </AlertCard>
        )}

        {showCastOff && (
          <AlertCard borderColor={Colors.coralDeep} icon="🧶" title="Cast off your stitches">
            <ThemedText type="small" themeColor="inkSoft" style={styles.centerText}>
              You&apos;ve reached the last row — bind off to finish this section.
            </ThemedText>
            <View style={styles.alertBtnRow}>
              <AlertButton label="Not yet" onPress={dismissCastOff} variant="cancel" />
              <AlertButton label="✓ Cast off & finish" onPress={confirmCastOff} variant="set" />
            </View>
          </AlertCard>
        )}

        {showComplete && (
          <AlertCard borderColor={Colors.sageDeep} icon="🎉" title="Section complete!">
            <ThemedText type="small" themeColor="inkSoft" style={styles.centerText}>
              You finished all {section.totalRows} rows of {section.name}.
            </ThemedText>
          </AlertCard>
        )}

        {!hideMain && (
          <View style={styles.counterArea}>
            <ThemedText style={styles.cntNumber}>{section.row}</ThemedText>
            <ThemedText type="small" themeColor="inkSoft" style={styles.cntOf}>
              of {section.totalRows} rows
            </ThemedText>
            <View style={styles.btnRow}>
              <Pressable
                onPress={() => changeRow(-1)}
                disabled={section.row <= 0}
                style={[styles.cntBtnMinus, section.row <= 0 && styles.disabled]}>
                <ThemedText type="title" themeColor="inkSoft">
                  –
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => changeRow(1)}
                disabled={section.row >= section.totalRows}
                style={[styles.cntBtnPlus, section.row >= section.totalRows && styles.disabled]}>
                <ThemedText type="title" themeColor="white" style={styles.plusGlyph}>
                  +
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.shortcuts}>
              <Pressable
                onPress={() => changeRow(-5)}
                disabled={section.row <= 0}
                style={[styles.shortcutBtn, section.row <= 0 && styles.disabled]}>
                <ThemedText type="smallBold" themeColor="inkSoft">
                  −5
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => changeRow(-10)}
                disabled={section.row <= 0}
                style={[styles.shortcutBtn, section.row <= 0 && styles.disabled]}>
                <ThemedText type="smallBold" themeColor="inkSoft">
                  −10
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {markerHint && !hideMain && (
          <View style={styles.markerHint}>
            <ThemedText type="smallBold" themeColor="sageDeep">
              {markerHint}
            </ThemedText>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function AlertCard({
  borderColor,
  icon,
  title,
  children,
}: {
  borderColor: string;
  icon: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.alertCard, { borderColor }]}>
      <ThemedText style={styles.alertIcon}>{icon}</ThemedText>
      <ThemedText type="subtitle" style={styles.centerText}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function AlertButton({
  label,
  onPress,
  variant,
}: {
  label: string;
  onPress: () => void;
  variant: 'cancel' | 'set';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.alertBtn, variant === 'set' ? styles.alertBtnSet : styles.alertBtnCancel]}>
      <ThemedText type="smallBold" themeColor={variant === 'set' ? 'white' : 'ink'}>
        {label}
      </ThemedText>
    </Pressable>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    alignItems: 'center',
  },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.three,
  },
  timerBtn: {
    backgroundColor: Colors.white,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  sectionLink: {
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  label: {
    alignSelf: 'center',
  },
  section: {
    alignSelf: 'center',
  },
  counterArea: {
    alignItems: 'center',
    marginTop: Spacing.five,
  },
  cntNumber: {
    fontFamily: Fonts.headingBold,
    fontSize: 76,
    lineHeight: 80,
    color: Colors.coralDeep,
  },
  cntOf: {
    marginBottom: Spacing.five,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  cntBtnMinus: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cntBtnPlus: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: Colors.coralDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusGlyph: {
    fontSize: 52,
    lineHeight: 56,
  },
  disabled: {
    opacity: 0.4,
  },
  shortcuts: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  shortcutBtn: {
    backgroundColor: Colors.white,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  markerHint: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.four,
  },
  alertCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderRadius: Radii.large,
    padding: Spacing.five,
    marginBottom: Spacing.four,
    width: '100%',
    alignItems: 'center',
    gap: Spacing.two,
  },
  alertIcon: {
    fontSize: 32,
  },
  centerText: {
    textAlign: 'center',
  },
  emptyTitle: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  noteInput: {
    backgroundColor: Colors.cream,
    borderRadius: Radii.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    width: '100%',
    fontFamily: Fonts.bodySemibold,
    fontSize: 14,
    color: Colors.ink,
  },
  alertBtnRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    width: '100%',
    marginTop: Spacing.two,
  },
  alertBtn: {
    flex: 1,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  alertBtnCancel: {
    backgroundColor: Colors.creamDeep,
  },
  alertBtnSet: {
    backgroundColor: Colors.sageDeep,
  },
});
