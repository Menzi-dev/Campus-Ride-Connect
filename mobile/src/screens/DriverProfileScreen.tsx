import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { BadgeCheck, Camera, CarFront, ChevronRight, Clock3, HelpCircle, LogOut, Mail, Phone, ShieldCheck, Star, UserRound } from 'lucide-react-native';
import apiClient from '../services/ApiClient';
import DriverBottomNav from '../components/DriverBottomNav';
import { colors, font, radius, spacing } from '../theme/theme';

type Profile = {
  id?: string | number;
  fullName?: string;
  email?: string;
  phone?: string;
  rating?: number | string | null;
  totalTrips?: number | string;
  approvalStatus?: string;
  licencePlate?: string;
  vehicleMake?: string;
  vehicleYear?: number | string;
  vehiclePhoto?: string | null;
  faceVerified?: boolean;
  profilePhoto?: string;
};

type RootStackParamList = {
  Login: undefined;
  DriverEarnings: undefined;
  DriverHistory: undefined;
};

export default function DriverProfileScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [profile, setProfile] = useState<Profile>({});
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [ownerKey, setOwnerKey] = useState('default');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const storedRaw = await AsyncStorage.getItem('user');
      const storedUser = storedRaw ? JSON.parse(storedRaw) as Profile : {};
      const key = String(storedUser.id || storedUser.email || 'default');
      setOwnerKey(key);
      const [response, storedPhoto] = await Promise.all([
        apiClient.get('/driver/profile'),
        AsyncStorage.getItem(`userProfileImage:${key}`),
      ]);
      const account: Profile = { ...storedUser, ...(response.data || {}) };
      const photo = storedPhoto || account.profilePhoto || null;
      setProfile(account);
      setProfileImage(photo);
      if (photo && !account.profilePhoto) {
        await AsyncStorage.setItem('user', JSON.stringify({ ...account, profilePhoto: photo }));
      }
      setLoadError('');
    } catch {
      setLoadError('Could not refresh your profile. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSelectPhoto = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/png', 'image/jpeg', 'image/jpg'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      let uri = asset.uri;
      if (Platform.OS === 'web') {
        const blob = await fetch(asset.uri).then((response) => response.blob());
        uri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image'));
          reader.onerror = () => reject(reader.error || new Error('Could not read image'));
          reader.readAsDataURL(blob);
        });
      } else if (FileSystem.documentDirectory) {
        const extension = asset.name?.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
        uri = `${FileSystem.documentDirectory}driver-profile-${Date.now()}.${extension}`;
        await FileSystem.copyAsync({ from: asset.uri, to: uri });
      }

      await AsyncStorage.setItem(`userProfileImage:${ownerKey}`, uri);
      const nextProfile = { ...profile, profilePhoto: uri };
      await AsyncStorage.setItem('user', JSON.stringify(nextProfile));
      setProfile(nextProfile);
      setProfileImage(uri);
    } catch {
      Alert.alert('Profile photo', 'Could not update your profile photo right now.');
    }
  };

  const handleProfileImageError = async () => {
    setProfileImage(null);
    await AsyncStorage.removeItem(`userProfileImage:${ownerKey}`);
    const nextProfile = { ...profile, profilePhoto: undefined };
    setProfile(nextProfile);
    await AsyncStorage.setItem('user', JSON.stringify(nextProfile));
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['authToken', 'user']);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const initials = (profile.fullName || 'Driver').split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const rating = profile.rating == null || Number(profile.rating) <= 0 ? '—' : Number(profile.rating).toFixed(1);
  const approval = profile.approvalStatus || 'PENDING';
  const approved = approval.toUpperCase() === 'APPROVED';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.gray50} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.green} />}
      >
        <View style={styles.headingRow}>
          <View>
            <Text style={styles.eyebrow}>DRIVER ACCOUNT</Text>
            <Text style={styles.title}>Your profile</Text>
            <Text style={styles.subtitle}>Your driver details and vehicle information.</Text>
          </View>
          <View style={styles.headingIcon}><UserRound size={21} color={colors.greenDark} /></View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.green} style={styles.loader} />
        ) : (
          <>
            {loadError ? (
              <TouchableOpacity style={styles.errorBanner} onPress={() => load()}>
                <Text style={styles.errorText}>{loadError}</Text>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.identityCard}>
              <View style={styles.avatarWrap}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.avatarImage} onError={() => { void handleProfileImageError(); }} />
                ) : (
                  <View style={styles.avatar}><Text style={styles.initials}>{initials}</Text></View>
                )}
                <TouchableOpacity style={styles.photoButton} onPress={handleSelectPhoto} accessibilityLabel="Change profile photo">
                  <Camera size={13} color={colors.white} />
                </TouchableOpacity>
              </View>
              <View style={styles.identityCopy}>
                <Text style={styles.name} numberOfLines={1}>{profile.fullName || 'Driver'}</Text>
                <Text style={styles.email} numberOfLines={1}>{profile.email || 'No email recorded'}</Text>
                <View style={[styles.approvalPill, approved ? styles.approvalPillGood : styles.approvalPillPending]}>
                  {approved ? <BadgeCheck size={13} color={colors.greenDark} /> : <Clock3 size={13} color={colors.orange} />}
                  <Text style={[styles.approvalText, approved ? styles.approvalTextGood : styles.approvalTextPending]}>{formatStatus(approval)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <View style={styles.metricIcon}><Star size={15} color={colors.orange} fill={colors.orange} /></View>
                <View style={styles.metricCopy}>
                  <Text style={styles.metricValue}>{rating}</Text>
                  <Text style={styles.metricLabel}>{rating === '—' ? 'NO RATINGS' : 'DRIVER RATING'}</Text>
                </View>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metric}>
                <View style={[styles.metricIcon, styles.tripMetricIcon]}><CarFront size={16} color={colors.blue} /></View>
                <View style={styles.metricCopy}>
                  <Text style={styles.metricValue}>{Number(profile.totalTrips || 0).toLocaleString()}</Text>
                  <Text style={styles.metricLabel}>COMPLETED TRIPS</Text>
                </View>
              </View>
            </View>

            <SectionTitle icon={<CarFront size={15} color={colors.gray600} />} title="Vehicle" />
            <View style={styles.vehicleCard}>
              {profile.vehicleMake || profile.vehicleYear || profile.licencePlate ? (
                <>
                  <View style={styles.vehicleTop}>
                    <View style={styles.vehicleIcon}><CarFront size={22} color={colors.greenDark} /></View>
                    <View style={styles.vehicleCopy}>
                      <Text style={styles.vehicleName}>{profile.vehicleMake || 'Vehicle make not recorded'}</Text>
                      <Text style={styles.vehicleMeta}>{profile.vehicleYear ? `Model year ${profile.vehicleYear}` : 'Model year not recorded'}</Text>
                    </View>
                    {profile.vehiclePhoto ? (
                      <Image source={{ uri: profile.vehiclePhoto }} style={styles.vehiclePhoto} resizeMode="cover" />
                    ) : (
                      <View style={styles.vehiclePhotoPlaceholder}>
                        <CarFront size={22} color={colors.gray400} />
                        <Text style={styles.vehiclePhotoPlaceholderText}>No photo</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.plateBlock}>
                    <Text style={styles.plateLabel}>LICENCE PLATE</Text>
                    <Text style={styles.plateValue}>{profile.licencePlate || 'Not recorded'}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.vehicleEmpty}>
                  <Text style={styles.vehicleEmptyTitle}>Vehicle details not available</Text>
                  <Text style={styles.vehicleEmptyText}>Your vehicle details will appear here once they are on file.</Text>
                </View>
              )}
            </View>

            <SectionTitle icon={<ShieldCheck size={15} color={colors.gray600} />} title="Account & verification" />
            <View style={styles.detailList}>
              <DetailRow icon={<ShieldCheck size={17} color={approved ? colors.greenDark : colors.orange} />} label="Driver approval" value={formatStatus(approval)} positive={approved} />
              <View style={styles.detailDivider} />
              <DetailRow icon={<UserRound size={17} color={profile.faceVerified ? colors.greenDark : colors.orange} />} label="Face recognition" value={profile.faceVerified ? 'Verified' : 'Pending'} positive={Boolean(profile.faceVerified)} />
              <View style={styles.detailDivider} />
              <DetailRow icon={<Mail size={17} color={profile.email ? colors.greenDark : colors.orange} />} label="Account email" value={profile.email ? 'On file' : 'Missing'} positive={Boolean(profile.email)} />
              {profile.phone ? <><View style={styles.detailDivider} /><DetailRow icon={<Phone size={17} color={colors.gray600} />} label="Phone" value={profile.phone} /></> : null}
            </View>

            <SectionTitle icon={<HelpCircle size={15} color={colors.gray600} />} title="Driver tools" />
            <View style={styles.toolsList}>
              <TouchableOpacity style={styles.toolRow} onPress={() => navigation.navigate('DriverEarnings')}>
                <View style={[styles.toolIcon, styles.earningsIcon]}><CarFront size={17} color={colors.blue} /></View>
                <View style={styles.toolCopy}><Text style={styles.toolTitle}>Earnings</Text><Text style={styles.toolSubtitle}>Review your ride earnings</Text></View>
                <ChevronRight size={17} color={colors.gray400} />
              </TouchableOpacity>
              <View style={styles.detailDivider} />
              <TouchableOpacity style={styles.toolRow} onPress={() => navigation.navigate('DriverHistory')}>
                <View style={[styles.toolIcon, styles.historyIcon]}><Clock3 size={17} color={colors.greenDark} /></View>
                <View style={styles.toolCopy}><Text style={styles.toolTitle}>Trip history</Text><Text style={styles.toolSubtitle}>View your completed rides</Text></View>
                <ChevronRight size={17} color={colors.gray400} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={() => setShowLogoutConfirmation(true)}>
              <LogOut size={17} color={colors.red} />
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
            {showLogoutConfirmation ? (
              <View style={styles.logoutConfirmation} accessibilityRole="alert">
                <Text style={styles.logoutConfirmationTitle}>Are you sure you want to log out?</Text>
                <Text style={styles.logoutConfirmationText}>You can sign back in anytime with your driver account.</Text>
                <View style={styles.logoutActions}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setShowLogoutConfirmation(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmButton} onPress={() => { void handleLogout(); }}><Text style={styles.confirmText}>Log out</Text></TouchableOpacity>
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={styles.bottomNavDock}>
        <DriverBottomNav active="DriverProfile" />
      </View>
    </View>
  );
}

function formatStatus(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <View style={styles.sectionHeading}>{icon}<Text style={styles.sectionTitle}>{title}</Text></View>;
}

function DetailRow({ icon, label, value, positive }: { icon: React.ReactNode; label: string; value: string; positive?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, positive && styles.detailValueGood]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: colors.gray50, position: 'relative' },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: 84 },
  bottomNavDock: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, backgroundColor: colors.white },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs, marginBottom: spacing.sm },
  eyebrow: { color: colors.greenDark, fontFamily: font.bold, fontSize: 9, marginBottom: 4 },
  title: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 22 },
  subtitle: { color: colors.gray500, fontFamily: font.medium, fontSize: 10, marginTop: 2 },
  headingIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.greenLight },
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, padding: spacing.sm },
  avatarWrap: { position: 'relative' },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 54, height: 54, borderRadius: 27 },
  initials: { color: colors.white, fontFamily: font.extrabold, fontSize: 18 },
  photoButton: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.green, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1, minWidth: 0 },
  name: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 15 },
  email: { color: colors.gray500, fontFamily: font.medium, fontSize: 10, marginTop: 2 },
  approvalPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 3, marginTop: 5 },
  approvalPillGood: { backgroundColor: colors.greenLight },
  approvalPillPending: { backgroundColor: colors.orangeLight },
  approvalText: { fontFamily: font.bold, fontSize: 9 },
  approvalTextGood: { color: colors.greenDark },
  approvalTextPending: { color: colors.orange },
  metricsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: spacing.sm, marginTop: spacing.xs },
  metric: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 0 },
  metricIcon: { width: 26, height: 26, borderRadius: radius.sm, backgroundColor: colors.orangeLight, alignItems: 'center', justifyContent: 'center' },
  tripMetricIcon: { backgroundColor: colors.blueLight },
  metricCopy: { minWidth: 0 },
  metricValue: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 14 },
  metricLabel: { color: colors.gray500, fontFamily: font.bold, fontSize: 7, marginTop: 1 },
  metricDivider: { width: 1, height: 25, backgroundColor: colors.gray200, marginHorizontal: spacing.xs },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, marginBottom: 5 },
  sectionTitle: { color: colors.gray700, fontFamily: font.bold, fontSize: 11 },
  vehicleCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, padding: spacing.sm },
  vehicleTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vehicleIcon: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  vehicleCopy: { flex: 1 },
  vehiclePhoto: { width: 88, height: 62, borderRadius: radius.sm, backgroundColor: colors.gray100 },
  vehiclePhotoPlaceholder: { width: 88, height: 62, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderColor: colors.gray200, borderStyle: 'dashed', borderRadius: radius.sm, backgroundColor: colors.gray50 },
  vehiclePhotoPlaceholderText: { color: colors.gray400, fontFamily: font.medium, fontSize: 8 },
  vehicleName: { color: colors.gray900, fontFamily: font.bold, fontSize: 13 },
  vehicleMeta: { color: colors.gray500, fontFamily: font.medium, fontSize: 10, marginTop: 2 },
  plateBlock: { backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 5, marginTop: spacing.sm },
  plateLabel: { color: colors.gray500, fontFamily: font.bold, fontSize: 8 },
  plateValue: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 12, marginTop: 2 },
  vehicleEmpty: { paddingVertical: 5 },
  vehicleEmptyTitle: { color: colors.gray700, fontFamily: font.bold, fontSize: 12 },
  vehicleEmptyText: { color: colors.gray500, fontFamily: font.medium, fontSize: 10, marginTop: 3, lineHeight: 14 },
  detailList: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, paddingHorizontal: spacing.sm },
  detailRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailIcon: { width: 22, alignItems: 'center' },
  detailLabel: { flex: 1, color: colors.gray700, fontFamily: font.semibold, fontSize: 10 },
  detailValue: { maxWidth: '45%', color: colors.orange, fontFamily: font.bold, fontSize: 9, textAlign: 'right' },
  detailValueGood: { color: colors.greenDark },
  detailDivider: { height: 1, backgroundColor: colors.gray100 },
  toolsList: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, paddingHorizontal: spacing.sm },
  toolRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toolIcon: { width: 28, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  earningsIcon: { backgroundColor: colors.blueLight },
  historyIcon: { backgroundColor: colors.greenLight },
  toolCopy: { flex: 1 },
  toolTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 11 },
  toolSubtitle: { color: colors.gray500, fontFamily: font.medium, fontSize: 9, marginTop: 1 },
  logoutButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.redLight, borderRadius: radius.md, marginTop: spacing.sm },
  logoutText: { color: colors.red, fontFamily: font.bold, fontSize: 12 },
  logoutConfirmation: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: colors.redLight, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs },
  logoutConfirmationTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 11 },
  logoutConfirmationText: { color: colors.gray600, fontFamily: font.medium, fontSize: 9, lineHeight: 13, marginTop: 2 },
  logoutActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  cancelButton: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.white },
  cancelText: { color: colors.gray700, fontFamily: font.bold, fontSize: 10 },
  confirmButton: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.red },
  confirmText: { color: colors.white, fontFamily: font.bold, fontSize: 10 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.orangeLight, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm },
  errorText: { flex: 1, color: colors.gray700, fontFamily: font.medium, fontSize: 11 },
  retryText: { color: colors.greenDark, fontFamily: font.bold, fontSize: 11, marginLeft: spacing.sm },
  loader: { marginTop: spacing.xxxl },
});
