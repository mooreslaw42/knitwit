import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { SelectField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { TOOL_TYPE_LABELS } from '@/constants/catalogs';
import { Spacing } from '@/constants/theme';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Material, Tool } from '@/types/knitwit';

export const materialLabel = (m: Material) => `${m.brand} — ${m.colorName}`;
export const toolLabel = (t: Tool) => `${t.thickness} ${TOOL_TYPE_LABELS[t.type]}`;

// The empty string stands for "none" because SelectField is backed by a Picker, and a Picker item
// can't carry null as its value.
const NONE = '';

// Picking the yarn or the needles a section is worked with, out of the knitter's own stash.
//
// Both halves are the same shape, so they share one body: a list to choose from, and a way out to
// the library for the case the thing isn't in the stash yet — which is most of the time the first
// few weeks, and used to be a dead end.
function StashPicker({
  label,
  options,
  value,
  onChange,
  emptyHint,
  addLabel,
  addHref,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
  emptyHint: string;
  addLabel: string;
  addHref: Href;
}) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      {options.length > 0 ? (
        <SelectField
          label={label}
          options={[{ value: NONE, label: `No ${label.toLowerCase()}` }, ...options]}
          value={value ?? NONE}
          onChange={(v) => onChange(v === NONE ? null : v)}
        />
      ) : (
        <View style={styles.empty}>
          <ThemedText type="smallBold" themeColor="inkSoft">
            {label}
          </ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            {emptyHint}
          </ThemedText>
        </View>
      )}
      <Pressable hitSlop={6} style={styles.addLink} onPress={() => router.push(addHref)}>
        <ThemedText type="smallBold" themeColor="sageDeep">
          {addLabel}
        </ThemedText>
      </Pressable>
    </View>
  );
}

export function MaterialPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const materials = useKnitwitStore((state) => state.materials);
  return (
    <StashPicker
      label="Material"
      options={Object.entries(materials).map(([id, m]) => ({ value: id, label: materialLabel(m) }))}
      value={value}
      onChange={onChange}
      emptyHint="No yarn in your library yet."
      addLabel="+ Add a yarn to your library"
      addHref="/material/new"
    />
  );
}

export function ToolPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const tools = useKnitwitStore((state) => state.tools);
  return (
    <StashPicker
      label="Tool"
      options={Object.entries(tools).map(([id, t]) => ({ value: id, label: toolLabel(t) }))}
      value={value}
      onChange={onChange}
      emptyHint="No needles or hooks in your library yet."
      addLabel="+ Add a tool to your library"
      addHref="/tool/new"
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  empty: { gap: Spacing.one },
  addLink: { alignSelf: 'flex-start', paddingVertical: Spacing.one },
});
