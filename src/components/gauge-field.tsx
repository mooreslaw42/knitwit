import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import {
  convertGauge,
  defaultWindow,
  GAUGE_PRESETS,
  gaugeFields,
  makeGauge,
  presetIndexFor,
} from '@/lib/gauge';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Gauge, LengthUnit } from '@/types/knitwit';

type Window = { width: number; height: number; unit: LengthUnit };

// One control for every gauge in the app — pattern, material, and a material's per-craft gauge —
// so a gauge entered in one place means the same thing as one entered in another.
//
// The window is part of the entry, not an assumption. A US pattern says "22 sts to 4 inches" and
// that is genuinely not "22 sts to 10cm"; making the knitter restate it in centimetres would
// either lose the 1.6% difference or make them do the arithmetic themselves.
export function GaugeField({
  label = 'Gauge',
  hint,
  value,
  onChange,
}: {
  label?: string;
  hint?: string;
  value: Gauge | null;
  onChange: (gauge: Gauge | null) => void;
}) {
  // The fields hold strings so a half-typed number ("2", "", "21,") never round-trips through a
  // parse and reappears as something the knitter didn't type.
  // A gauge already recorded keeps the window it was written in; only a new one takes the
  // knitter's preference, because that is the only case where nothing would be overridden.
  const preferred = useKnitwitStore((state) => state.settings.gaugeUnit);
  const initial = value ? gaugeFields(value) : { stitches: '', rows: '', window: defaultWindow(preferred) };
  const [stitches, setStitches] = useState(initial.stitches);
  const [rows, setRows] = useState(initial.rows);
  const [window, setWindow] = useState<Window>(initial.window);

  const commit = (s: string, r: string, w: Window) => onChange(makeGauge(s, r, w));

  // Switching window restates the gauge rather than reinterpreting it: 22 sts/10cm becomes
  // 22.35 sts/4in, which is the same fabric. Silently relabelling it 22 sts/4in would change the
  // fabric without the knitter asking.
  const changeWindow = (next: Window) => {
    const current = makeGauge(stitches, rows, window);
    setWindow(next);
    if (!current) {
      commit(stitches, rows, next);
      return;
    }
    const restated = convertGauge(current, next);
    const fields = gaugeFields(restated);
    setStitches(fields.stitches);
    setRows(fields.rows);
    onChange(restated);
  };

  const selected = presetIndexFor(makeGauge(stitches, rows, window) ?? { ...window, stitches: 0, rows: 0 });

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold" themeColor="inkSoft">
        {label}
      </ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="inkSoft">
          {hint}
        </ThemedText>
      ) : null}

      <View style={styles.row}>
        {GAUGE_PRESETS.map((preset, i) => {
          const on = selected === i;
          return (
            <Pressable
              key={preset.label}
              onPress={() =>
                changeWindow({ width: preset.width, height: preset.height, unit: preset.unit })
              }
              style={[styles.chip, on && styles.chipOn]}>
              <ThemedText type="smallBold" themeColor={on ? 'white' : 'inkSoft'}>
                {preset.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <View style={styles.grow}>
          <FormField
            label="Stitches"
            value={stitches}
            onChangeText={(v) => {
              setStitches(v);
              commit(v, rows, window);
            }}
            keyboardType="numeric"
            placeholder="22"
          />
        </View>
        <View style={styles.grow}>
          <FormField
            label="Rows (optional)"
            value={rows}
            onChangeText={(v) => {
              setRows(v);
              commit(stitches, v, window);
            }}
            keyboardType="numeric"
            placeholder="30"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  grow: { flex: 1, minWidth: 120 },
  chip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipOn: { backgroundColor: Colors.blushDeep },
});
