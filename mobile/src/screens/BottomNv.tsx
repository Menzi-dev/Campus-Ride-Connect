import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  Home: undefined;
  TripHistory: undefined;
  Schedule: undefined;
  Profile: undefined;
};

type TabKey = 'Home' | 'TripHistory' | 'Schedule' | 'Profile';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'Home', label: 'Home', icon: '🏠' },
  { key: 'TripHistory', label: 'History', icon: '🕐' },
  { key: 'Schedule', label: 'Schedule', icon: '📅' },
  { key: 'Profile', label: 'Profile', icon: '👤' },
];

export default function BottomNav({ active }: { active: TabKey }) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => {
              if (!isActive) navigation.navigate(tab.key);
            }}
          >
            <Text style={[styles.icon, isActive && styles.iconActive]}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#0f0f22',
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
    paddingTop: 8,
    paddingBottom: 20,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
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
