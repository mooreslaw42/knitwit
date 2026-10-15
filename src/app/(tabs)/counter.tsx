import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KnitIcon, type KnitIconName } from '@/components/icons/KnitIcon';
import { EmptyState } from '@/components/illustrations/EmptyState';
import { Illustration, type IllustrationName } from '@/components/illustrations/Illustration';
import { PillButton } from '@/components/knitwit-ui';
import { Confetti } from '@/components/motion/Confetti';
import { haptics, type HapticKind } from '@/components/motion/haptics';
import { enterCard, exitCard } from '@/components/motion/presets';
import { PressableScale } from '@/components/motion/PressableScale';
import { RowCount } from '@/components/motion/RowCount';
import { TimerPulse } from '@/components/motion/TimerPulse';
import { StitchChart, StitchRowStrip } from '@/components/stitch-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { formatClock } from '@/lib/knitwit-helpers';
import { useLiveSeconds } from '@/lib/use-live-seconds';
import { usePageTitle } from '@/lib/use-page-title';
import { useWideLayout } from '@/lib/use-wide-layout';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function CounterScreen() {
  const router = useRouter();
  const activeProjectKey = useKnitwitStore((state) => state.activeProjectKey);
  const activeSectionIndex = useKnitwitStore((state) => state.activeSectionIndex);
  const project = useKnitwitStore((state) => state.projects[activeProjectKey]);
  const setActiveSection = useKnitwitStore((state) => state.setActiveSection);
  // Every project can be deleted, which leaves nothing to count.
  const section = project?.sections[activeSectionIndex];
  usePageTitle(section ? `${section.name} · counting` : 'Counter');

  // Colourwork cells are painted their yarn's colour, which lives on the originating pattern's
  // material slots (set by the pixel-pattern builder). The project's copied rows still reference
  // those slot ids, so the colours are looked up live from the pattern — gone (pattern deleted)
  // means the chart simply falls back to monochrome.
  const patternMaterials = useKnitwitStore((state) =>
    project?.patternId ? state.patterns[project.patternId]?.materials : undefined,
  );

  // The chart was copied onto the project section when it was created, so counting is unaffected
  // by later edits to the pattern it came from.
  const chartRows = section?.rows ?? [];
  // `row` counts rows completed, so it names the row just worked; before anything is worked, show
  // the first row that's coming up.
  // Counting on past the planned total (see the store's `extending`) takes the knitter beyond the
  // charted rows. Clamping to the last one would caption row 21 as "Row 16" and hand them stitches
  // for a row they aren't working — better to show no chart than the wrong one.
  const chartRowIndex =
    chartRows.length && (section?.row ?? 0) <= chartRows.length
      ? Math.max(0, (section?.row ?? 0) - 1)
      : -1;
  const chartRow = chartRowIndex >= 0 ? chartRows[chartRowIndex] : null;

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
  // Hooks run before the empty-state return below, so these cannot move down with the layout.
  const wide = useWideLayout();
  const rowsScroll = useRef<ScrollView>(null);
  const rowTops = useRef<Record<number, number>>({});
  const placed = useRef(false);
  const workedRows = section?.row ?? 0;

  // Follow the count up the list. Without this the list always opens at row 1, so by row 30 the
  // row you are actually working is off the bottom and you re-scroll after every press — which
  // would undo the reason for putting the two side by side.
  //
  // Held a third of the way down rather than at the very top, so the rows still to come are
  // visible too — that is what you look ahead to.
  const showCurrentRow = (animated: boolean) => {
    const top = rowTops.current[workedRows];
    if (top == null) return false;
    rowsScroll.current?.scrollTo({ y: Math.max(0, top - 140), animated });
    return true;
  };

  useEffect(() => {
    showCurrentRow(true);
  });

  // Arriving mid-section, the rows have not been laid out when the effect above first runs, so
  // there is nothing to scroll to yet and the list would sit at row 1 until the next press. The
  // first layout that reaches the current row does the jump instead, without animating — it
  // should already be there, not slide there.
  const noteRowTop = (index: number, y: number) => {
    rowTops.current[index] = y;
    if (!placed.current && index === workedRows) placed.current = showCurrentRow(false);
  };

  // A different section is a different list; its rows have their own heights and its own place
  // to jump to.
  useEffect(() => {
    rowTops.current = {};
    placed.current = false;
  }, [activeProjectKey, activeSectionIndex]);

  if (!project || !section) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.emptyWrap}>
            <EmptyState
              illustration="nothing-here"
              title="Nothing to count yet"
              message="Start a project from the Home tab, then come back here to count your rows."
            />
          </View>
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
  // Where to send the knitter next: the first section still to work, wrapping round so finishing
  // out of order doesn't strand them on the last one.
  const nextSection = (() => {
    const n = project.sections.length;
    for (let i = 1; i <= n; i++) {
      const index = (activeSectionIndex + i) % n;
      const candidate = project.sections[index];
      if (!candidate.complete && candidate.row < candidate.totalRows) {
        return { index, name: candidate.name };
      }
    }
    return null;
  })();
  const allDone = project.sections.every((s) => s.complete || s.row >= s.totalRows);
  const hideMain = atMarker || showCastOff || showComplete || noteFormOpen;

  const nextMarker = section.markers.find((m) => m > section.row);
  let markerHint: { icon: KnitIconName; text: string } | null = null;
  if (!section.complete && !noteFormOpen) {
    if (nextMarker !== undefined) {
      markerHint = {
        icon: 'stitch-marker',
        text: `Stitch marker at row ${nextMarker} — ${nextMarker - section.row} to go`,
      };
    } else if (section.markers.length && section.row < section.totalRows) {
      const left = section.totalRows - section.row;
      markerHint = {
        icon: 'celebrate',
        text: `Final stretch — ${left} ${left === 1 ? 'row' : 'rows'} to go`,
      };
    }
  }

  // Two columns only where there is genuinely a second thing to look at: a wide web window and a
  // section that has actually been charted. An empty column beside the counter is worse than no
  // column, and on a phone the counter is held one-handed and stays exactly as it was.
  const twoUp = wide && chartRows.length > 0;

  // The back link, timer, note button and the project/section name belong to the whole screen,
  // not to the counter — so on a wide window they sit above both columns as one centred header
  // rather than being boxed into the left one.
  const header = (
    <>
        <View style={[styles.topbar, twoUp && styles.topbarWide]}>
          {/* Counter is a tab, so there is no reliable stack to go back through — arriving here
              from the tab bar and from "Continue counting" leave different histories. It goes to
              the section this counter is counting, which is the one answer that is always right.
              The project/section heading below has always been a link to the same place, but it
              reads as a title, so nobody found it. */}
          <Pressable
            onPress={() =>
              router.push(`/project/${activeProjectKey}/section/${activeSectionIndex}`)
            }
            style={styles.backBtn}
            hitSlop={8}>
            <ThemedText type="smallBold" themeColor="ink" numberOfLines={1}>
              ← {section.name}
            </ThemedText>
          </Pressable>
          <PressableScale
            onPress={toggleTimer}
            haptic="select"
            scaleTo={0.96}
            style={styles.timerBtn}
            accessibilityRole="button"
            accessibilityLabel={`${isTimerRunning ? 'Pause' : 'Start'} timer, ${formatClock(liveSeconds)}`}>
            <TimerPulse running={isTimerRunning} />
            <KnitIcon
              name={isTimerRunning ? 'pause' : 'play'}
              size={16}
              color={Colors.ink}
              accent={Colors.sage}
            />
            <ThemedText type="smallBold" themeColor="ink" style={styles.tabular}>
              {formatClock(liveSeconds)}
            </ThemedText>
          </PressableScale>
          <PillButton
            style={styles.noteBtn}
            onPress={() => {
              setNoteText('');
              openNoteForm();
            }}>
            <ThemedText type="smallBold" themeColor="white">
              + Add note
            </ThemedText>
          </PillButton>
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
    </>
  );

  const body = (
    <>
        {noteFormOpen && (
          <AlertCard borderColor={Colors.coralDeep} icon="note" title="Add a note">
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
          <AlertCard
            borderColor={Colors.coralDeep}
            icon="stitch-marker"
            title="Place a stitch marker"
            haptic="nudge">
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
          <AlertCard
            borderColor={Colors.coralDeep}
            icon="cast-off"
            title="Cast off your stitches"
            haptic="nudge">
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
          <AlertCard
            borderColor={Colors.sageDeep}
            illustration="celebrate"
            title={allDone ? 'Project complete!' : 'Section complete!'}
            haptic="success">
            <Confetti burstKey={`${activeProjectKey}|${activeSectionIndex}`} />
            <ThemedText type="small" themeColor="inkSoft" style={styles.centerText}>
              {allDone
                ? `Every section of ${project.name} is done.`
                : `You finished all ${section.totalRows} rows of ${section.name}.`}
            </ThemedText>
            {/* This card used to have no buttons and hid the counter, which left the screen with
                nothing to do on it — finishing a section is the one moment the app should be
                clearest about what comes next. */}
            <View style={styles.alertBtnRow}>
              {nextSection ? (
                <>
                  <AlertButton
                    label={`Start ${nextSection.name} →`}
                    onPress={() => setActiveSection(activeProjectKey, nextSection.index)}
                    variant="set"
                  />
                  <AlertButton
                    label="Back to project"
                    onPress={() => router.push(`/project/${activeProjectKey}`)}
                    variant="cancel"
                  />
                </>
              ) : (
                <AlertButton
                  label={`Back to ${project.name}`}
                  onPress={() => router.push(`/project/${activeProjectKey}`)}
                  variant="set"
                />
              )}
            </View>
          </AlertCard>
        )}

        {!hideMain && (
          <View style={styles.counterArea}>
            {chartRowIndex >= 0 && (
              <View style={styles.rowStrip}>
                <StitchRowStrip
                  craft={project.craft}
                  rows={chartRows}
                  castOn={section.castOn}
                  rowIndex={chartRowIndex}
                  showStitchCount
                  materials={patternMaterials}
                />
                {chartRow?.instruction ? (
                  <ThemedText
                    type="small"
                    themeColor="inkSoft"
                    numberOfLines={2}
                    style={styles.rowInstruction}>
                    {chartRow.instruction}
                  </ThemedText>
                ) : null}
              </View>
            )}
            <RowCount
              value={section.row}
              style={styles.cntNumber}
              accessibilityLabel={`Row ${section.row} of ${section.totalRows}`}
            />
            <ThemedText type="small" themeColor="inkSoft" style={styles.cntOf}>
              of {section.totalRows} rows
            </ThemedText>
            <View style={styles.btnRow}>
              <PressableScale
                onPress={() => changeRow(-1)}
                disabled={section.row <= 0}
                accessibilityRole="button"
                accessibilityLabel="Previous row"
                style={[styles.cntBtnMinus, section.row <= 0 && styles.disabled]}>
                <KnitIcon name="minus" size={28} color={Colors.inkSoft} />
              </PressableScale>
              <PressableScale
                onPress={() => changeRow(1)}
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityLabel="Next row"
                // Only locked while the bind-off prompt is still standing. Once it's been
                // declined the knitter has said they aren't finished, so counting on has to work
                // — the store grows the section to match.
                disabled={section.row >= section.totalRows && !castOffDismissed}
                style={[
                  styles.cntBtnPlus,
                  section.row >= section.totalRows && !castOffDismissed && styles.disabled,
                ]}>
                <KnitIcon name="plus" size={64} color={Colors.white} />
              </PressableScale>
            </View>
            <View style={styles.shortcuts}>
              <PressableScale
                onPress={() => changeRow(-5)}
                disabled={section.row <= 0}
                haptic="select"
                accessibilityRole="button"
                accessibilityLabel="Back 5 rows"
                style={[styles.shortcutBtn, section.row <= 0 && styles.disabled]}>
                <ThemedText type="smallBold" themeColor="inkSoft">
                  −5
                </ThemedText>
              </PressableScale>
              <PressableScale
                onPress={() => changeRow(-10)}
                disabled={section.row <= 0}
                haptic="select"
                accessibilityRole="button"
                accessibilityLabel="Back 10 rows"
                style={[styles.shortcutBtn, section.row <= 0 && styles.disabled]}>
                <ThemedText type="smallBold" themeColor="inkSoft">
                  −10
                </ThemedText>
              </PressableScale>
            </View>
          </View>
        )}

        {/* Sitting at the end with the prompt already declined, the only way to bind off was to
            leave and come back. The action stays on the counter for as long as it applies. */}
        {!hideMain && section.row >= section.totalRows && !section.complete && (
          <PillButton style={styles.bindOffBtn} onPress={confirmCastOff}>
            <ThemedText type="smallBold" themeColor="white">
              ✓ Bind off &amp; finish {section.name}
            </ThemedText>
          </PillButton>
        )}

        {markerHint && !hideMain && (
          <View style={styles.markerHint}>
            <KnitIcon name={markerHint.icon} size={18} color={Colors.sageDeep} accent={Colors.sage} />
            <ThemedText type="smallBold" themeColor="sageDeep">
              {markerHint.text}
            </ThemedText>
          </View>
        )}

        {/* Narrow enough that the chart column isn't there, but the section has one to show. On a
            wide window this is the right-hand column and the button would be pointing at something
            already on screen; on a phone it is the only way through to it. */}
        {!twoUp && chartRows.length > 0 && !hideMain && (
          <Pressable
            style={styles.showPatternBtn}
            onPress={() =>
              router.push(`/project/${activeProjectKey}/section/${activeSectionIndex}/stitches`)
            }>
            <ThemedText type="smallBold" themeColor="sageDeep">
              Show pattern · {chartRows.length} {chartRows.length === 1 ? 'row' : 'rows'} →
            </ThemedText>
          </Pressable>
        )}
    </>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView
        style={[styles.safeArea, twoUp && styles.safeAreaWide]}
        edges={['top', 'left', 'right']}>
        {header}
        {twoUp ? (
          <View style={styles.columns}>
            <View style={styles.colCounter}>{body}</View>
            {/* Scrolls on its own, so reading ahead never moves the + button out from under the
                cursor — the whole point of putting them side by side. */}
            <View style={styles.colRows}>
              <ThemedText type="smallBold" themeColor="inkSoft" style={styles.rowsHeading}>
                {section.name} · {chartRows.length}{' '}
                {chartRows.length === 1 ? 'row' : 'rows'} · read bottom-up
              </ThemedText>
              <ScrollView
                ref={rowsScroll}
                style={styles.rowsScroll}
                contentContainerStyle={styles.rowsScrollContent}>
                <StitchChart
                  rows={chartRows}
                  castOn={section.castOn}
                  craft={project.craft}
                  worked={section.row}
                  onRowLayout={noteRowTop}
                  materials={patternMaterials}
                />
              </ScrollView>
            </View>
          </View>
        ) : (
          body
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function AlertCard({
  borderColor,
  icon,
  illustration,
  title,
  haptic,
  children,
}: {
  borderColor: string;
  icon?: KnitIconName;
  illustration?: IllustrationName;
  title: string;
  /** Felt as the card appears, so a knitter notices without looking up from the needles. */
  haptic?: HapticKind;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    if (haptic) haptics[haptic]();
  }, [haptic]);

  const tint = borderColor === Colors.sageDeep ? Colors.sage : Colors.coral;
  return (
    <Animated.View
      entering={enterCard}
      exiting={exitCard}
      style={[styles.alertCard, { borderColor }]}>
      {illustration ? (
        <Illustration name={illustration} width={150} />
      ) : icon ? (
        <View style={[styles.alertIconBubble, { backgroundColor: tint + '55' }]}>
          <KnitIcon name={icon} size={32} color={borderColor} accent={tint} />
        </View>
      ) : null}
      <ThemedText type="subtitle" style={styles.centerText}>
        {title}
      </ThemedText>
      {children}
    </Animated.View>
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
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
      haptic={variant === 'set' ? 'firm' : 'select'}
      accessibilityRole="button"
      style={[styles.alertBtn, variant === 'set' ? styles.alertBtnSet : styles.alertBtnCancel]}>
      <ThemedText type="smallBold" themeColor={variant === 'set' ? 'white' : 'ink'}>
        {label}
      </ThemedText>
    </PressableScale>
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
  // Wider only when there are two columns to fill. The counter alone stays at reading width.
  safeAreaWide: {
    maxWidth: 1080,
    alignItems: 'stretch',
  },
  // Spread to the corners the header would be as wide as both columns, which is the opposite of
  // what the extra width is for. Clustered in the middle it stays one object, over one screen.
  // Sits under the counter rather than beside it, so a thumb on the + button is nowhere near it.
  showPatternBtn: {
    marginTop: Spacing.four,
    alignSelf: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  topbarWide: {
    justifyContent: 'center',
    gap: Spacing.three,
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.five,
    width: '100%',
  },
  // Fixed, not a share of the window. The counter is a fixed-size object — one big number and two
  // buttons — so giving it a percentage just moves it around as the window changes; and letting it
  // grow would make it a bigger counter, which is a different change from the one asked for.
  colCounter: {
    width: 400,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
  },
  // Takes the rest, but capped: rows are text, and a line of "k across" stretched over 800px puts
  // the stitch count so far from the row it belongs to that you lose which is which.
  colRows: {
    flex: 1,
    minWidth: 0,
    maxWidth: 620,
  },
  rowsHeading: {
    marginBottom: Spacing.two,
    // Sits over a centred chart, so it is centred too.
    textAlign: 'center',
  },
  rowsScroll: {
    flex: 1,
  },
  rowsScrollContent: {
    paddingBottom: Spacing.six,
    // A chart is as wide as the stitches in it — six for a strap, forty for a body. Centring keeps
    // a narrow one from stranding itself against the left edge of a column sized for a wide one.
    alignItems: 'center',
  },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    width: '100%',
    marginBottom: Spacing.three,
  },
  backBtn: {
    backgroundColor: Colors.white,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    // Yields to the timer and the note button, which are fixed width; a long section name
    // truncates rather than pushing them off the row.
    flexShrink: 1,
  },
  timerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.white,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    flexShrink: 0,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  // Matches the "+ New pattern" pill used on the Library/Materials/Projects headers.
  noteBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
  rowStrip: {
    maxWidth: '100%',
    marginBottom: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  rowInstruction: {
    textAlign: 'center',
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
  bindOffBtn: {
    alignSelf: 'center',
    marginTop: Spacing.three,
    backgroundColor: Colors.sageDeep,
  },
  markerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
    // Keeps the finishing confetti inside the card.
    overflow: 'hidden',
  },
  alertIconBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
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
