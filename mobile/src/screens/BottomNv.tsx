import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { CalendarDays, CircleUserRound, Clock, House } from 'lucide-react-native';

type RootStackParamList = {
  Home: undefined;
  TripHistory: undefined;
  Schedule: undefined;
  Profile: undefined;
};

type TabKey = 'Home' | 'TripHistory' | 'Schedule' | 'Profile';

const TABS: { key: TabKey; label: string; icon: typeof House }[] = [
  { key: 'Home', label: 'Home', icon: House },
  { key: 'TripHistory', label: 'History', icon: Clock },
  { key: 'Schedule', label: 'Schedule', icon: CalendarDays },
  { key: 'Profile', label: 'Profile', icon: CircleUserRound },
];

export default function BottomNav({ active }: { active: TabKey }) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const Icon = tab.icon;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => {
              if (!isActive) navigation.navigate(tab.key);
            }}
          >
            <Icon size={20} color={isActive ? '#22C55E' : '#9CA3AF'} />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, paddingBottom: 10 },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  icon: {
    fontSize: 20,
    opacity: 0.5,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  labelActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },
});
