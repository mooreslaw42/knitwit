import { FormField } from '@/components/knitwit-ui';

// Native has no date input of its own, and pulling in a picker library for a field the app only
// really uses on the web today isn't worth the native dependency. Typing the date works, and the
// format is stated rather than guessed at. Revisit when iOS ships — see docs/plans.
export function DateField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  hint?: string;
}) {
  return (
    <FormField
      label={label}
      value={value ?? ''}
      onChangeText={(v) => onChange(v.trim() || null)}
      placeholder={hint ?? 'YYYY-MM-DD'}
      autoCapitalize="none"
    />
  );
}
