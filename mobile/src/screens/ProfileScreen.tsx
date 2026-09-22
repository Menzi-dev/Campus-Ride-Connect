import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNav from '../components/BottomNav';
import apiClient from '../services/ApiClient';
import { colors, font, radius, spacing, shadow } from '../theme/theme';

type RootStackParamList = { Login: undefined; RiderHistory: undefined; RiderPaymentMethods: undefined };

type StoredUser = {
  fullName: string;
  email: string;
  yearOfStudy?: number;
  role?: string;
  phone?: string;
  faceVerified?: boolean;
};

export default function ProfileScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [user, setUser] = useState<StoredUser | null>(null); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [tripCount, setTripCount] = useState(0);

  const load = useCallback(async (refresh = false) => { refresh ? setRefreshing(true) : setLoading(true); try { const [profile, history] = await Promise.all([apiClient.get('/users/me'), apiClient.get('/rides/history')]); setUser(profile.data); setTripCount((history.data || []).filter((ride: any) => ride.status === 'COMPLETED').length); await AsyncStorage.setItem('user', JSON.stringify(profile.data)); } finally { setLoading(false); setRefreshing(false); } }, []);
  React.useEffect(() => { load(); }, [load]);

  const handleSignOut = async () => {
    await AsyncStorage.multiRemove(['authToken', 'user']);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.green} />} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}><Text style={styles.headerTitle}>Profile</Text></View>
      {loading ? <ActivityIndicator color={colors.green} style={styles.loader} /> : <>
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

      <View style={styles.stats}><Stat value={tripCount} label="RIDES" /><Stat value="4.9 ★" label="RATING" /><Stat value="Cash" label="PAYMENT" /><Stat value="SPU" label="CAMPUS" /></View>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.rowItem}>
          <Text style={styles.rowText}>Edit Profile</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
        <TouchableOpacity style={styles.rowItem} onPress={() => navigation.navigate('RiderPaymentMethods')}>
          <Text style={styles.rowText}>Payment Methods</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rowItem} onPress={() => navigation.navigate('RiderHistory')}>
          <Text style={styles.rowText}>Trip History</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
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
      </TouchableOpacity></>}
      </ScrollView>

      <BottomNav active="RiderProfile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 }, scrollContent: { paddingBottom: spacing.lg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.white },
  headerTitle: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 22 },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.white, ...shadow.sm },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: colors.white, fontFamily: font.extrabold, fontSize: 22 },
  name: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 18 },
  email: { color: colors.gray600, fontFamily: font.medium, fontSize: 13, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.greenLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  badgeText: { color: colors.greenDark, fontFamily: font.bold, fontSize: 10 },
  stats: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.sm, ...shadow.sm },
  statValue: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 15 },
  statLabel: { color: colors.gray600, fontFamily: font.bold, fontSize: 8, marginTop: 3 },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionLabel: { color: colors.gray600, fontFamily: font.bold, fontSize: 11, letterSpacing: 0.5, marginBottom: spacing.sm },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  rowText: { color: colors.gray900, fontFamily: font.bold, fontSize: 14 },
  chevron: { color: colors.gray500, fontSize: 18 },
  signOutButton: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.redLight,
    marginBottom: 20,
  },
  signOutText: { color: colors.red, fontFamily: font.bold, fontSize: 15 }, loader: { marginTop: spacing.xxxl },
});

function Stat({ value, label }: { value: string | number; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }