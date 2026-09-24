import { Picker } from '@react-native-picker/picker';
import { StyleSheet, View } from 'react-native';

import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';

// The web half of select-control.tsx — see there for why the two differ.
//
// Nothing to build here. React Native Web renders Picker as a real <select>, which is compact,
// behaves the way every other form on the web behaves, and is understood by screen readers without
// anybody having to label it. Replacing that with the phone's sheet would be worse in every way
// that matters.
export function SelectControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.box}>
      <Picker<T>
        selectedValue={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        style={styles.select}
        itemStyle={styles.item}>
        {options.map((option) => (
          <Picker.Item key={option.value} label={option.label} value={option.value} />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  select: {
    backgroundColor: Colors.white,
    color: Colors.ink,
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderWidth: 0,
  },
  item: { fontFamily: Fonts.bodySemibold, fontSize: 15, color: Colors.ink },
});
