import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors } from '../theme';

interface Props {
  title: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  outline?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, color = colors.primary, textColor, outline, disabled, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        outline ? { borderColor: color, borderWidth: 2, backgroundColor: 'transparent' } : { backgroundColor: color },
        (pressed || disabled) && { opacity: 0.7 },
        style,
      ]}
    >
      <Text style={[styles.text, { color: textColor ?? (outline ? color : colors.white) }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  text: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
