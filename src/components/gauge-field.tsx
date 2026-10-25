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
  sameGauge,
} from '@/lib/gauge';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Gauge, LengthUnit } from '@/types/knitwit';

type Window = { width: number; height: number; unit: LengthUnit };

type Fields = { stitches: string; rows: string; window: Window };
type Draft = Fields & { emitted: Gauge | null };

// One control for every gauge in the app — pattern, material, and a material's per-craft gauge —
// so a gauge entered in one place means the same thing as one entered in another.
//
// The window is part of the entry, not an assumption. A US pattern says "22 sts to 4 inches" and
// that is genuinely not "22 sts to 10cm"; making the knitter restate it in centimetres would
// either lose the 1.6% difference or make them do the arithmetic themselves.
export function GaugeField({
  label = 'Gauge',
  badge,
  hint,
  value,
  onChange,
}: {
  label?: string;
  badge?: React.ReactNode;
  hint?: string;
  value: Gauge | null;
  onChange: (gauge: Gauge | null) => void;
}) {
  // The draft holds strings so a half-typed number ("2", "", "21,") never round-trips through a
  // parse and reappears as something the knitter didn't type. `emitted` is the gauge those strings
  // last produced — what this control told its caller.
  // A gauge already recorded keeps the window it was written in; only a new one takes the
  // knitter's preference, because that is the only case where nothing would be overridden.
  const preferred = useKnitwitStore((state) => state.settings.gaugeUnit);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...(value ? gaugeFields(value) : { stitches: '', rows: '', window: defaultWindow(preferred) }),
    emitted: value,
  }));

  // `value` wins whenever it is not the gauge this control handed up.
  //
  // The draft only ever speaks for its own keystrokes, and the same gauge is routinely shown by
  // several of these at once — the calculator asks for one gauge on six cards, over one piece of
  // state. Seeding the strings on mount and never again meant the other five went on displaying
  // the number you had just replaced, while every answer beside them recomputed from the new one:
  // an input contradicting the answer under it, with nothing on screen to say which the app
  // believed. So when the two disagree, the fields follow `value` and the draft is set aside.
  const fromValue = gaugeFields(value);
  const shown: Fields = sameGauge(draft.emitted, value)
    ? draft
    : // A gauge that has been cleared away says nothing about the window, so the one on screen
      // stays rather than snapping back to the first preset.
      { ...fromValue, window: value ? fromValue.window : draft.window };
  const { stitches, rows, window } = shown;

  const commit = (s: string, r: string, w: Window) => {
    const next = makeGauge(s, r, w);
    setDraft({ stitches: s, rows: r, window: w, emitted: next });
    onChange(next);
  };

  // Switching window restates the gauge rather than reinterpreting it: 22 sts/10cm becomes
  // 22.35 sts/4in, which is the same fabric. Silently relabelling it 22 sts/4in would change the
  // fabric without the knitter asking.
  const changeWindow = (next: Window) => {
    const current = makeGauge(stitches, rows, window);
    if (!current) {
      commit(stitches, rows, next);
      return;
    }
    const restated = convertGauge(current, next);
    const fields = gaugeFields(restated);
    setDraft({ ...fields, window: next, emitted: restated });
    onChange(restated);
  };

  const selected = presetIndexFor(makeGauge(stitches, rows, window) ?? { ...window, stitches: 0, rows: 0 });

  return (
    <View style={styles.wrap}>
      {badge ? (
        <View style={styles.labelRow}>
          <ThemedText type="smallBold" themeColor="inkSoft">
            {label}
          </ThemedText>
          {badge}
        </View>
      ) : (
        <ThemedText type="smallBold" themeColor="inkSoft">
          {label}
        </ThemedText>
      )}
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
            onChangeText={(v) => commit(v, rows, window)}
            keyboardType="numeric"
            placeholder="22"
          />
        </View>
        <View style={styles.grow}>
          <FormField
            label="Rows (optional)"
            value={rows}
            onChangeText={(v) => commit(stitches, v, window)}
            keyboardType="numeric"
            placeholder="30"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    overflow: 'visible',
  },
  wrap: { gap: Spacing.two, overflow: 'visible' },
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
