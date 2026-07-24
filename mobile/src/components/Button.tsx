import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, spacing, font } from '../theme/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: 'green' | 'red' | 'white';
};

export default function Button({ label, onPress, style, loading = false, icon, disabled, variant }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'white' && styles.whiteButton,
        variant === 'red' && styles.redButton,
        variant === 'green' && styles.greenButton,
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'white' ? colors.gray800 : colors.white} />
      ) : (
        <>
          <Text style={[styles.label, variant === 'white' && styles.labelDark]}>{label}</Text>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.green,
  },
  greenButton: {
    backgroundColor: colors.green,
  },
  redButton: {
    backgroundColor: colors.red,
  },
  whiteButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  disabledButton: {
    backgroundColor: colors.gray300,
  },
  label: {
    fontFamily: font.semibold,
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  labelDark: {
    color: colors.gray800,
  },
  icon: {
    marginLeft: spacing.sm,
  },
});
