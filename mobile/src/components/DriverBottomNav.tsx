import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart3, Clock3, Home, UserRound } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { colors, font, spacing } from '../theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type DriverNavParamList = { DriverDashboard: undefined; DriverEarnings: undefined; DriverHistory: undefined; DriverProfile: undefined };
type Tab = keyof DriverNavParamList;

export default function DriverBottomNav({ active }: { active: Tab }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNavigationProp<DriverNavParamList>>();
  const tabs: { key: Tab; label: string; icon: typeof Home }[] = [
    { key: 'DriverDashboard', label: 'Home', icon: Home },
    { key: 'DriverEarnings', label: 'Earnings', icon: BarChart3 },
    { key: 'DriverHistory', label: 'History', icon: Clock3 },
    { key: 'DriverProfile', label: 'Profile', icon: UserRound },
  ];
  return <View testID="driver-bottom-nav" style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>{tabs.map(({ key, label, icon: Icon }) => {
    const selected = key === active;
    return <TouchableOpacity key={key} style={styles.tab} onPress={() => !selected && navigation.navigate(key)} accessibilityLabel={label}>
      <Icon size={19} color={selected ? colors.green : colors.gray500} strokeWidth={selected ? 2.5 : 2} />
      <Text style={[styles.label, selected && styles.activeLabel]}>{label}</Text>
    </TouchableOpacity>;
  })}</View>;
}

const styles = StyleSheet.create({
  container: { flexShrink: 0, flexDirection: 'row', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray200, paddingTop: spacing.sm },
  tab: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', alignItems: 'center', gap: 3 },
  label: { color: colors.gray500, fontFamily: font.medium, fontSize: 10 },
  activeLabel: { color: colors.green, fontFamily: font.bold },
});
