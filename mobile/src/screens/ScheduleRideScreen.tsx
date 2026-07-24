import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import BottomNav from '../components/BottomNav';

// Full Schedule Ride design (date tabs, time picker, recurrence) is next
// phase per the project's table of contents — stub keeps tab bar navigable.
export default function ScheduleScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />
      <View style={styles.center}>
        <Text style={styles.title}>📅 Schedule Ride</Text>
        <Text style={styles.subtitle}>Coming in the next phase</Text>
      </View>
      <BottomNav active="Schedule" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#4CAF50' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 8 },
});
