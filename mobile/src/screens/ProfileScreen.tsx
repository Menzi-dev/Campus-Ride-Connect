import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNav from '../components/BottomNav';

type RootStackParamList = { Login: undefined };

type StoredUser = {
  fullName: string;
  email: string;
  yearOfStudy?: number;
  role?: string;
};

export default function ProfileScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    })();
  }, []);

  const handleSignOut = async () => {
    await AsyncStorage.multiRemove(['authToken', 'user']);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ marginLeft: 14 }}>
          <Text style={styles.name}>{user?.fullName || 'Loading...'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.yearOfStudy && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{user.yearOfStudy} YEAR</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.rowItem}>
          <Text style={styles.rowText}>Edit Profile</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.rowText}>Payment Methods</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.rowText}>Trip History</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={() =>
          Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: handleSignOut },
          ])
        }
      >
        <Text style={styles.signOutText}>⇥ Sign Out</Text>
      </TouchableOpacity>

      <BottomNav active="Profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  profileCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 24 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  name: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  email: { color: '#888', fontSize: 13, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(76,175,80,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  badgeText: { color: '#4CAF50', fontSize: 10, fontWeight: 'bold' },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionLabel: { color: '#666', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  rowText: { color: '#ddd', fontSize: 14 },
  chevron: { color: '#555', fontSize: 18 },
  signOutButton: {
    marginHorizontal: 20,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c0392b',
    marginBottom: 20,
  },
  signOutText: { color: '#e74c3c', fontSize: 15, fontWeight: 'bold' },
});