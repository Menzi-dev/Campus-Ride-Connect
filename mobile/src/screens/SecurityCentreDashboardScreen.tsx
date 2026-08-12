import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, font, radius, spacing, shadow } from '../theme/theme';

export default function SecurityCentreDashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Security Dashboard</Text>
      <Text style={styles.subtitle}>This screen is not implemented yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.gray50,
  },
  title: {
    fontFamily: font.extrabold,
    fontSize: 22,
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
  },
});
