import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TOOL_ICONS, TOOL_TYPE_LABELS, yarnWeightLabel } from '@/constants/catalogs';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function MaterialsScreen() {
  const materials = useKnitwitStore((state) => state.materials);
  const tools = useKnitwitStore((state) => state.tools);
  const [view, setView] = useState<'materials' | 'tools'>('materials');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">Materials & tools</ThemedText>

          <View style={styles.segment}>
            <SegButton
              label="Yarn"
              active={view === 'materials'}
              onPress={() => setView('materials')}
            />
            <SegButton label="Tools" active={view === 'tools'} onPress={() => setView('tools')} />
          </View>

          {view === 'materials' ? (
            <View style={styles.list}>
              {Object.entries(materials).map(([id, m]) => {
                const meta = [
                  m.composition,
                  m.weight ? yarnWeightLabel(m.weight) : '',
                  `${m.grams || '?'}g / ${m.meters || '?'}m`,
                  m.price ? `€${m.price}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <View key={id} style={styles.row}>
                    <View style={[styles.thumb, { backgroundColor: Colors.creamDeep }]} />
                    <View style={styles.rowInfo}>
                      <ThemedText type="smallBold">
                        {m.brand} — {m.colorName}
                      </ThemedText>
                      <ThemedText type="small" themeColor="inkSoft">
                        {meta}
                      </ThemedText>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.list}>
              {Object.entries(tools).map(([id, t]) => (
                <View key={id} style={styles.row}>
                  <View style={[styles.thumb, styles.iconThumb]}>
                    <ThemedText type="default">{TOOL_ICONS[t.type]}</ThemedText>
                  </View>
                  <View style={styles.rowInfo}>
                    <ThemedText type="smallBold">
                      {t.thickness} {TOOL_TYPE_LABELS[t.type]}
                    </ThemedText>
                    <ThemedText type="small" themeColor="inkSoft">
                      {t.length}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SegButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.segBtn, active && styles.segBtnActive]}>
      <ThemedText type="smallBold" themeColor={active ? 'ink' : 'inkSoft'}>
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
  },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.three,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    padding: 4,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radii.pill,
  },
  segBtnActive: {
    backgroundColor: Colors.white,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: Radii.small,
  },
  iconThumb: {
    backgroundColor: Colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
});
