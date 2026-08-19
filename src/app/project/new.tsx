import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField, PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CATEGORY_LABELS } from '@/constants/catalogs';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { todayStarted } from '@/lib/knitwit-helpers';
import { goBackOr } from '@/lib/navigation';
import { useKnitwitStore } from '@/store/useKnitwitStore';

const STEPS = ['Basics', 'Pattern', 'Rows'] as const;

export default function NewProjectWizardScreen() {
  const router = useRouter();
  const patterns = useKnitwitStore((state) => state.patterns);
  const createProject = useKnitwitStore((state) => state.createProject);
  const setActiveSection = useKnitwitStore((state) => state.setActiveSection);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [started, setStarted] = useState(todayStarted());
  const [patternId, setPatternId] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState('60');
  const [nameTouched, setNameTouched] = useState(false);

  const isLast = step === STEPS.length - 1;
  // The original refuses to leave the first step without a name, since an unnamed project is
  // impossible to find again in the list.
  const nameMissing = step === 0 && !name.trim();

  const handleNext = () => {
    if (nameMissing) {
      setNameTouched(true);
      return;
    }
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    const key = createProject({
      name,
      started,
      patternId,
      totalRows: Math.max(1, parseInt(totalRows, 10) || 60),
    });
    setActiveSection(key, 0);
    router.replace(`/project/${key}`);
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
    else goBackOr(router, '/');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.topbar}>
            <Pressable onPress={handleBack} hitSlop={8}>
              <ThemedText type="default">←</ThemedText>
            </Pressable>
            <View style={styles.dots}>
              {STEPS.map((s, i) => (
                <View
                  key={s}
                  style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
                />
              ))}
            </View>
            <View style={styles.topbarSpacer} />
          </View>
          <ThemedText type="small" themeColor="inkSoft" style={styles.caption}>
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </ThemedText>

          {step === 0 && (
            <>
              <ThemedText type="subtitle">What are you making?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Give it a name so you can find it later.
              </ThemedText>
              <FormField
                label="Project name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Summer Tee"
              />
              {nameTouched && nameMissing && (
                <ThemedText type="small" themeColor="coralDeep">
                  A name is needed to save the project.
                </ThemedText>
              )}
              <FormField
                label="Started"
                value={started}
                onChangeText={setStarted}
                placeholder="e.g. Started Jun 14"
              />
            </>
          )}

          {step === 1 && (
            <>
              <ThemedText type="subtitle">Working from a pattern?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Linking one keeps its gauge and details with the project.
              </ThemedText>
              {Object.entries(patterns).map(([id, pattern]) => (
                <ChoiceCard
                  key={id}
                  swatch={pattern.accentColor}
                  title={pattern.name}
                  meta={`${CATEGORY_LABELS[pattern.category]} · ${pattern.weight}`}
                  selected={patternId === id}
                  onPress={() => setPatternId(id)}
                />
              ))}
              <ChoiceCard
                swatch={Colors.creamDeep}
                title="No pattern — I'll improvise"
                meta="Just count rows"
                selected={patternId === null}
                onPress={() => setPatternId(null)}
              />
            </>
          )}

          {step === 2 && (
            <>
              <ThemedText type="subtitle">How many rows?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                This makes a single section you can count through.
              </ThemedText>
              <FormField
                label="Target rows"
                value={totalRows}
                onChangeText={setTotalRows}
                keyboardType="numeric"
                placeholder="60"
              />
            </>
          )}

          <PillButton style={styles.nextBtn} onPress={handleNext}>
            <ThemedText type="smallBold" themeColor="white">
              {isLast ? 'Save project' : 'Next'}
            </ThemedText>
          </PillButton>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ChoiceCard({
  swatch,
  title,
  meta,
  selected,
  onPress,
}: {
  swatch: string;
  title: string;
  meta: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choiceCard, selected && styles.choiceCardSelected]}>
      <View style={[styles.choiceSwatch, { backgroundColor: swatch }]} />
      <View style={styles.choiceInfo}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="inkSoft">
          {meta}
        </ThemedText>
      </View>
      {selected && (
        <ThemedText type="smallBold" themeColor="sageDeep">
          ✓
        </ThemedText>
      )}
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
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topbarSpacer: {
    width: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.creamDeep,
  },
  dotActive: {
    backgroundColor: Colors.blushDeep,
  },
  dotDone: {
    backgroundColor: Colors.sage,
  },
  caption: {
    textAlign: 'center',
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  choiceCardSelected: {
    borderColor: Colors.sageDeep,
  },
  choiceSwatch: {
    width: 40,
    height: 40,
    borderRadius: Radii.small,
  },
  choiceInfo: {
    flex: 1,
    gap: 2,
  },
  nextBtn: {
    marginTop: Spacing.two,
  },
});
