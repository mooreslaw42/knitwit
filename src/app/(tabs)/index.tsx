import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, ProgressBar } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { currentSectionIndexOf, projectProgress } from '@/lib/knitwit-helpers';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function HomeScreen() {
  const router = useRouter();
  const projects = useKnitwitStore((state) => state.projects);
  const patterns = useKnitwitStore((state) => state.patterns);

  const entries = Object.entries(projects);
  const activeCount = entries.filter(([, p]) => projectProgress(p).pct < 1).length;
  const doneCount = entries.filter(([, p]) => projectProgress(p).pct >= 1).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="title">Good evening, Pim 🧶</ThemedText>
          </View>

          <View style={styles.stats}>
            <MiniStat num={activeCount} label="Active" />
            <MiniStat num={Object.keys(patterns).length} label="Saved patterns" />
            <MiniStat num={doneCount} label="Done" />
          </View>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Your projects
          </ThemedText>

          <View style={styles.projList}>
            {entries.map(([key, p]) => {
              const pct = projectProgress(p).pct;
              const cur = p.sections[currentSectionIndexOf(p)];
              return (
                <Pressable
                  key={key}
                  style={styles.projRow}
                  onPress={() => router.push(`/project/${key}`)}>
                  <View
                    style={[
                      styles.projThumb,
                      { backgroundColor: p.photo ? undefined : p.color },
                    ]}
                  />
                  <View style={styles.projInfo}>
                    <ThemedText type="smallBold">{p.name}</ThemedText>
                    <ThemedText type="small" themeColor="inkSoft">
                      {cur.name} · row {cur.row} of {cur.totalRows}
                    </ThemedText>
                    <View style={{ marginTop: Spacing.one }}>
                      <ProgressBar pct={pct} color={p.colorDeep} />
                    </View>
                  </View>
                  <ThemedText type="smallBold" themeColor="sageDeep" style={styles.pct}>
                    {Math.round(pct * 100)}%
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function MiniStat({ num, label }: { num: number; label: string }) {
  return (
    <Card style={styles.miniStat}>
      <ThemedText type="title" style={styles.miniNum}>
        {num}
      </ThemedText>
      <ThemedText type="small" themeColor="inkSoft">
        {label}
      </ThemedText>
    </Card>
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
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.half,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.three,
    backgroundColor: Colors.creamDeep,
  },
  miniNum: {
    fontSize: 22,
    lineHeight: 26,
  },
  sectionTitle: {
    marginTop: Spacing.two,
  },
  projList: {
    gap: Spacing.two,
  },
  projRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
  projThumb: {
    width: 44,
    height: 44,
    borderRadius: Radii.small,
  },
  projInfo: {
    flex: 1,
    gap: 2,
  },
  pct: {
    flexShrink: 0,
  },
});
