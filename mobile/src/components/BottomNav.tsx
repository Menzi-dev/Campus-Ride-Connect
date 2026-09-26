import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { CalendarDays, CircleUserRound, Clock, House } from 'lucide-react-native';
import { colors, font } from '../theme/theme';

type RootStackParamList = {
  Home: { skipActiveRideRestore?: boolean } | undefined;
  RiderHistory: undefined;
  RiderSchedule: undefined;
  RiderProfile: undefined;
};

type TabKey = 'Home' | 'RiderHistory' | 'RiderSchedule' | 'RiderProfile';
type ActiveTab = TabKey | 'Schedule';

const TABS: { key: TabKey; label: string; Icon: typeof House }[] = [
  { key: 'Home', label: 'Home', Icon: House },
  { key: 'RiderHistory', label: 'History', Icon: Clock },
  { key: 'RiderSchedule', label: 'Schedule', Icon: CalendarDays },
  { key: 'RiderProfile', label: 'Profile', Icon: CircleUserRound },
];

export default function BottomNav({ active }: { active: ActiveTab }) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = tab.key === active || (active === 'Schedule' && tab.key === 'RiderSchedule');
        const Icon = tab.Icon;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => {
              if (isActive) return;

              if (tab.key === 'Home') {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home', params: { skipActiveRideRestore: true } }],
                });
                return;
              }

              navigation.reset({
                index: 0,
                routes: [{ name: tab.key }],
              });
            }}
          >
            <Icon size={20} color={isActive ? colors.green : colors.gray400} strokeWidth={isActive ? 2 : 1.8} />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: 10, paddingBottom: 10 },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: { fontFamily: font.medium, fontSize: 10.5, color: colors.gray400, fontWeight: '500' },
  labelActive: { color: colors.green, fontFamily: font.semibold, fontWeight: '600' },
});