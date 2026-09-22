import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart3, Clock3, Home, UserRound } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { colors, font, spacing } from '../theme/theme';

type DriverNavParamList = { DriverDashboard: undefined; DriverEarnings: undefined; DriverHistory: undefined; DriverProfile: undefined };
type Tab = keyof DriverNavParamList;

export default function DriverBottomNav({ active }: { active: Tab }) {
  const navigation = useNavigation<StackNavigationProp<DriverNavParamList>>();
  const tabs: { key: Tab; label: string; icon: typeof Home }[] = [
    { key: 'DriverDashboard', label: 'Home', icon: Home },
    { key: 'DriverEarnings', label: 'Earnings', icon: BarChart3 },
    { key: 'DriverHistory', label: 'History', icon: Clock3 },
    { key: 'DriverProfile', label: 'Profile', icon: UserRound },
  ];
  return <View style={styles.container}>{tabs.map(({ key, label, icon: Icon }) => {
    const selected = key === active;
    return <TouchableOpacity key={key} style={styles.tab} onPress={() => !selected && navigation.navigate(key)} accessibilityLabel={label}>
      <Icon size={19} color={selected ? colors.green : colors.gray500} strokeWidth={selected ? 2.5 : 2} />
      <Text style={[styles.label, selected && styles.activeLabel]}>{label}</Text>
    </TouchableOpacity>;
  })}</View>;
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray200, paddingTop: spacing.sm, paddingBottom: spacing.md },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  label: { color: colors.gray500, fontFamily: font.medium, fontSize: 10 },
  activeLabel: { color: colors.green, fontFamily: font.bold },
});
