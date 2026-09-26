import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Bell,
  BookOpen,
  ChevronRight,
  CreditCard,
  Gift,
  HelpCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react-native';
import BottomNav from '../components/BottomNav';
import apiClient from '../services/ApiClient';
import { colors, font, radius, shadow, spacing } from '../theme/theme';

type RootStackParamList = {
  Login: undefined;
  RiderHistory: undefined;
  RiderPaymentMethods: undefined;
};

type StoredUser = {
  id?: string;
  fullName: string;
  email: string;
  yearOfStudy?: number;
  role?: string;
  phone?: string;
  faceVerified?: boolean;
  profilePhoto?: string;
};

type SavedCard = { id: string; lastFour: string; label: string; isDefault?: boolean };

type QuickAction = {
  label: string;
  icon: React.ReactNode;
  tint: string;
  subtitle: string;
};

export default function ProfileScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tripCount, setTripCount] = useState(0);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editYear, setEditYear] = useState('');
  const [defaultPayment, setDefaultPayment] = useState('CASH');
  const [savedCard, setSavedCard] = useState<SavedCard | null>(null);
  const [infoModal, setInfoModal] = useState<'promos' | 'support' | 'notifications' | 'safety' | null>(null);
  const [showSignOutConfirmation, setShowSignOutConfirmation] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);

    try {
      const storedRaw = await AsyncStorage.getItem('user');
      const storedUser = storedRaw ? (JSON.parse(storedRaw) as StoredUser) : null;
      const ownerKey = storedUser?.id || storedUser?.email || 'default';
      const storedPhoto =
        (await AsyncStorage.getItem(`userProfileImage:${ownerKey}`)) ||
        storedUser?.profilePhoto ||
        null;
      const [storedCardsRaw, selectedPayment] = await Promise.all([
        AsyncStorage.getItem('saved_cards'),
        AsyncStorage.getItem('default_payment_method'),
      ]);
      const storedCards: SavedCard[] = storedCardsRaw ? JSON.parse(storedCardsRaw) : [];
      const selectedCard = storedCards.find((card) => card.isDefault) || storedCards[0] || null;

      const [profile, history] = await Promise.all([
        apiClient.get('/users/me').catch(() => ({ data: storedUser || null })),
        apiClient.get('/rides/history').catch(() => ({ data: [] })),
      ]);

      const account: StoredUser = {
        ...(storedUser || {}),
        ...(profile.data || {}),
        fullName: (profile.data?.fullName || storedUser?.fullName || 'Campus rider').trim(),
        email: (profile.data?.email || storedUser?.email || 'student@campus.edu').trim(),
        phone: profile.data?.phone || storedUser?.phone,
        yearOfStudy: profile.data?.yearOfStudy ?? storedUser?.yearOfStudy,
        role: profile.data?.role || storedUser?.role || 'Student',
        faceVerified: profile.data?.faceVerified ?? storedUser?.faceVerified ?? false,
        profilePhoto: storedPhoto || profile.data?.profilePhoto,
      };

      setUser(account);
      setProfileImage(account.profilePhoto || null);
      setEditName(account.fullName);
      setEditEmail(account.email);
      setEditPhone(account.phone || '');
      setEditYear(String(account.yearOfStudy || ''));
      setTripCount((history.data || []).filter((ride: any) => ride.status === 'COMPLETED').length);
      setSavedCard(selectedCard);
      setDefaultPayment(selectedPayment === 'CARD' && selectedCard ? 'CARD' : 'CASH');
      await AsyncStorage.setItem('user', JSON.stringify(account));
    } catch {
      const fallback: StoredUser = {
        fullName: 'Campus rider',
        email: 'student@campus.edu',
        role: 'Student',
        faceVerified: false,
      };
      setUser(fallback);
      setProfileImage(null);
      setEditName(fallback.fullName);
      setEditEmail(fallback.email);
      setEditPhone('');
      setEditYear(String(fallback.yearOfStudy || ''));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSelectPhoto = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/png', 'image/jpeg', 'image/jpg'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const extension = asset.name?.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
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
        const permanentUri = `${FileSystem.documentDirectory}profile-${Date.now()}.${extension}`;
        await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });
        uri = permanentUri;
      }
      const ownerKey = user?.id || user?.email || 'default';
      await AsyncStorage.setItem(`userProfileImage:${ownerKey}`, uri);
      await AsyncStorage.setItem('user', JSON.stringify({ ...(user || {}), profilePhoto: uri }));
      setProfileImage(uri);
      setUser((prev) => (prev ? { ...prev, profilePhoto: uri } : prev));
    } catch {
      Alert.alert('Profile photo', 'Could not update your profile photo right now.');
    }
  };

  const handleProfileImageError = async () => {
    setProfileImage(null);
    const ownerKey = user?.id || user?.email || 'default';
    await AsyncStorage.removeItem(`userProfileImage:${ownerKey}`);
    if (user) {
      const updatedUser = { ...user, profilePhoto: undefined };
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const handleSaveProfile = async () => {
    const nextUser: StoredUser = {
      ...(user || {
        fullName: 'Campus rider',
        email: 'student@campus.edu',
        role: 'Student',
      }),
      fullName: editName.trim() || user?.fullName || 'Campus rider',
      email: editEmail.trim() || user?.email || 'student@campus.edu',
      phone: editPhone.trim() || user?.phone,
      yearOfStudy: editYear ? Number(editYear) : user?.yearOfStudy,
      profilePhoto: profileImage || user?.profilePhoto,
    };

    setUser(nextUser);
    if (profileImage) {
      const ownerKey = nextUser.id || nextUser.email || 'default';
      await AsyncStorage.setItem(`userProfileImage:${ownerKey}`, profileImage);
    }
    await AsyncStorage.setItem('user', JSON.stringify(nextUser));
    setEditModalVisible(false);
  };

  const handleSignOut = async () => {
    await AsyncStorage.multiRemove(['authToken', 'user']);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const handleEmergencyCall = async () => {
    const url = 'tel:10111';
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Emergency services', 'Call 10111 from a phone in South Africa.');
    }
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const quickActions: QuickAction[] = [
    { label: 'Promos', icon: <Gift size={18} color={colors.greenDark} />, tint: '#DCFCE7', subtitle: '0 active promos' },
    { label: 'Saved cards', icon: <CreditCard size={18} color={colors.blue} />, tint: '#DBEAFE', subtitle: 'Manage payment' },
    { label: 'Safety', icon: <ShieldCheck size={18} color={colors.orange} />, tint: '#FFEDD5', subtitle: 'Ride safety' },
    { label: 'Support', icon: <HelpCircle size={18} color={colors.purple} />, tint: '#F3E8FF', subtitle: 'Help center' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.green} />}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.green} style={styles.loader} />
        ) : (
          <>
            <View style={styles.profileCard}>
              <View style={styles.avatarWrap}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.avatarImage} onError={handleProfileImageError} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.plusButton} onPress={handleSelectPhoto}>
                  <Text style={styles.plusButtonText}>＋</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.name}>{user?.fullName || 'Campus rider'}</Text>
                <Text style={styles.email}>{user?.email}</Text>
                <View style={styles.metaRow}>
                  {user?.yearOfStudy ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{user.yearOfStudy} YEAR</Text>
                    </View>
                  ) : null}
                  {user?.faceVerified ? (
                    <View style={styles.verifyBadge}>
                      <Text style={styles.verifyText}>Verified</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity style={styles.editPill} onPress={() => setEditModalVisible(true)}>
                <Text style={styles.editPillText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.stats}>
              <Stat value={tripCount} label="RIDES" />
              <Stat value="0" label="RATINGS" />
              <Stat value={defaultPayment === 'CARD' && savedCard ? `Card • ${savedCard.lastFour}` : 'Cash'} label="PAYMENT" />
              <Stat value="SPU" label="CAMPUS" />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>FAVORITES</Text>
              <View style={styles.quickGrid}>
                {quickActions.map((action, index) => (
                  <TouchableOpacity
                    key={`${action.label}-${index}`}
                    style={[styles.quickAction, { backgroundColor: action.tint }]}
                    onPress={() => {
                      if (action.label === 'Promos') setInfoModal('promos');
                      if (action.label === 'Saved cards') navigation.navigate('RiderPaymentMethods');
                      if (action.label === 'Safety') setInfoModal('safety');
                      if (action.label === 'Support') setInfoModal('support');
                    }}
                  >
                    <View style={styles.quickIconWrap}>{action.icon}</View>
                    <Text style={styles.quickActionTitle}>{action.label}</Text>
                    <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ACCOUNT</Text>

              <TouchableOpacity style={styles.rowItem} onPress={() => setEditModalVisible(true)}>
                <View style={styles.rowStart}>
                  <UserRound size={16} color={colors.gray700} />
                  <Text style={styles.rowText}>Edit Profile</Text>
                </View>
                <ChevronRight size={18} color={colors.gray400} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.rowItem} onPress={() => navigation.navigate('RiderPaymentMethods')}>
                <View style={styles.rowStart}>
                  <CreditCard size={16} color={colors.gray700} />
                  <Text style={styles.rowText}>Payment Methods</Text>
                </View>
                <ChevronRight size={18} color={colors.gray400} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.rowItem} onPress={() => navigation.navigate('RiderHistory')}>
                <View style={styles.rowStart}>
                  <Sparkles size={16} color={colors.gray700} />
                  <Text style={styles.rowText}>Trip History</Text>
                </View>
                <ChevronRight size={18} color={colors.gray400} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rowItem}
                onPress={() => setInfoModal('notifications')}
              >
                <View style={styles.rowStart}>
                  <Bell size={16} color={colors.gray700} />
                  <Text style={styles.rowText}>Notifications</Text>
                </View>
                <ChevronRight size={18} color={colors.gray400} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.signOutButton}
              onPress={() => setShowSignOutConfirmation(true)}
            >
              <Text style={styles.signOutText}>⇥ Sign Out</Text>
            </TouchableOpacity>
            {showSignOutConfirmation && (
              <View style={styles.signOutConfirmation} accessibilityRole="alert">
                <Text style={styles.signOutConfirmationText}>Are you sure you want to sign out?</Text>
                <View style={styles.signOutConfirmationActions}>
                  <TouchableOpacity style={styles.signOutCancel} onPress={() => setShowSignOutConfirmation(false)}>
                    <Text style={styles.signOutCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.signOutConfirm} onPress={() => { void handleSignOut(); }}>
                    <Text style={styles.signOutConfirmText}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditModalVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit profile</Text>
            <Text style={styles.modalSubtitle}>Keep your details current for safer and smoother rides.</Text>

            <Text style={styles.inputLabel}>Full name</Text>
            <TextInput value={editName} onChangeText={setEditName} placeholder="Full name" style={styles.input} />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput value={editEmail} placeholder="Email address" keyboardType="email-address" editable={false} style={[styles.input, styles.readOnlyInput]} />

            <Text style={styles.inputLabel}>Phone number</Text>
            <TextInput value={editPhone} onChangeText={setEditPhone} placeholder="Phone number" keyboardType="phone-pad" style={styles.input} />

            <Text style={styles.inputLabel}>Year of study</Text>
            <TextInput value={editYear} placeholder="2" keyboardType="numeric" editable={false} style={[styles.input, styles.readOnlyInput]} />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryAction} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.secondaryActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryAction} onPress={handleSaveProfile}>
                <Text style={styles.primaryActionText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={infoModal !== null} transparent animationType="slide" onRequestClose={() => setInfoModal(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfoModal(null)} />
          <View style={styles.infoSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {infoModal === 'promos' ? 'Promos' :
                infoModal === 'notifications' ? 'Notifications' :
                  infoModal === 'safety' ? 'Ride safety' : 'Help & support'}
            </Text>

            {infoModal === 'promos' && (
              <View style={styles.emptyInfo}>
                <Gift size={28} color={colors.greenDark} />
                <Text style={styles.emptyInfoTitle}>No promos available</Text>
                <Text style={styles.emptyInfoText}>0 active promos. New offers will appear here when they become available.</Text>
              </View>
            )}

            {infoModal === 'notifications' && (
              <View style={styles.emptyInfo}>
                <Bell size={28} color={colors.blue} />
                <Text style={styles.emptyInfoTitle}>No notifications yet</Text>
                <Text style={styles.emptyInfoText}>Ride updates and account alerts will appear here.</Text>
              </View>
            )}

            {infoModal === 'support' && (
              <ScrollView style={styles.infoScroll}>
                <Text style={styles.infoIntro}>Quick help for common ride and account questions.</Text>
                <View style={styles.guideRow}>
                  <BookOpen size={18} color={colors.greenDark} />
                  <View style={styles.guideCopy}>
                    <Text style={styles.guideTitle}>Ride help</Text>
                    <Text style={styles.guideText}>Check your pickup and destination before requesting. For a driver or ride issue, open that ride from Trip History.</Text>
                  </View>
                </View>
                <View style={styles.guideRow}>
                  <CreditCard size={18} color={colors.blue} />
                  <View style={styles.guideCopy}>
                    <Text style={styles.guideTitle}>Payments</Text>
                    <Text style={styles.guideText}>Manage cards and your default payment method from Saved cards. Only the card brand, expiry, and last four digits are retained; the full number and security code are not saved.</Text>
                  </View>
                </View>
                <View style={styles.guideRow}>
                  <UserRound size={18} color={colors.orange} />
                  <View style={styles.guideCopy}>
                    <Text style={styles.guideTitle}>Account</Text>
                    <Text style={styles.guideText}>Update your profile details from Edit Profile. Your profile photo remains on this device when you sign out.</Text>
                  </View>
                </View>
                <View style={styles.contactNotice}>
                  <Text style={styles.contactTitle}>Campus support contact</Text>
                  <Text style={styles.guideText}>A campus support phone line or email has not been configured in the app yet.</Text>
                </View>
                <TouchableOpacity style={styles.emergencyButton} onPress={handleEmergencyCall}>
                  <Phone size={17} color={colors.white} />
                  <Text style={styles.emergencyButtonText}>Call South African Police: 10111</Text>
                </TouchableOpacity>
                <Text style={styles.emergencyCaption}>For an immediate emergency. For ride safety during an active trip, use SOS on the Home screen.</Text>
              </ScrollView>
            )}

            {infoModal === 'safety' && (
              <View style={styles.safetyInfo}>
                <ShieldCheck size={30} color={colors.greenDark} />
                <Text style={styles.emptyInfoTitle}>Stay safe on every ride</Text>
                <Text style={styles.emptyInfoText}>Confirm the driver and vehicle details in the app before getting in. Share your trip with someone you trust, and use SOS from Home if you need urgent help.</Text>
              </View>
            )}

            <TouchableOpacity style={styles.primaryAction} onPress={() => setInfoModal(null)}>
              <Text style={styles.primaryActionText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomNav active="RiderProfile" />
    </View>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scrollContent: { paddingBottom: spacing.lg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.white },
  headerTitle: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 22 },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.white, ...shadow.sm },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: { width: 62, height: 62, borderRadius: 31 },
  avatarText: { color: colors.white, fontFamily: font.extrabold, fontSize: 22 },
  plusButton: {
    position: 'absolute',
    right: -6,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  plusButtonText: { color: colors.white, fontSize: 18, fontFamily: font.bold, lineHeight: 18 },
  name: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 18 },
  email: { color: colors.gray600, fontFamily: font.medium, fontSize: 13, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.greenLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: colors.greenDark, fontFamily: font.bold, fontSize: 10 },
  verifyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifyText: { color: '#0369A1', fontFamily: font.bold, fontSize: 10 },
  editPill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8,
  },
  editPillText: { color: colors.greenDark, fontFamily: font.bold, fontSize: 12 },
  stats: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.sm, ...shadow.sm },
  statValue: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 15 },
  statLabel: { color: colors.gray600, fontFamily: font.bold, fontSize: 8, marginTop: 3 },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionLabel: { color: colors.gray600, fontFamily: font.bold, fontSize: 11, letterSpacing: 0.5, marginBottom: spacing.sm },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickAction: {
    width: '48%',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    minHeight: 90,
    justifyContent: 'space-between',
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 12 },
  quickActionSubtitle: { color: colors.gray600, fontFamily: font.medium, fontSize: 10, marginTop: 4 },
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
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { color: colors.gray900, fontFamily: font.bold, fontSize: 14 },
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
  signOutText: { color: colors.red, fontFamily: font.bold, fontSize: 15 },
  signOutConfirmation: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.md, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: colors.redLight, borderRadius: radius.md },
  signOutConfirmationText: { color: colors.gray900, fontFamily: font.bold, fontSize: 14 },
  signOutConfirmationActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  signOutCancel: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md },
  signOutCancelText: { color: colors.gray700, fontFamily: font.bold, fontSize: 13 },
  signOutConfirm: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.red, borderRadius: radius.md },
  signOutConfirmText: { color: colors.white, fontFamily: font.bold, fontSize: 13 },
  loader: { marginTop: spacing.xxxl },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl },
  infoSheet: { maxHeight: '88%', backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl },
  infoScroll: { marginTop: spacing.sm, marginBottom: spacing.md },
  infoIntro: { color: colors.gray600, fontFamily: font.medium, fontSize: 13, marginBottom: spacing.md },
  emptyInfo: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
  emptyInfoTitle: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 16, textAlign: 'center', marginTop: spacing.md },
  emptyInfoText: { color: colors.gray600, fontFamily: font.medium, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.xs },
  guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100, paddingVertical: spacing.md },
  guideCopy: { flex: 1 },
  guideTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 13 },
  guideText: { color: colors.gray600, fontFamily: font.medium, fontSize: 12, lineHeight: 18, marginTop: 4 },
  contactNotice: { backgroundColor: colors.gray50, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  contactTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 13 },
  emergencyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.red, paddingVertical: 12, borderRadius: radius.md, marginTop: spacing.md },
  emergencyButtonText: { color: colors.white, fontFamily: font.bold, fontSize: 13 },
  emergencyCaption: { color: colors.gray600, fontFamily: font.medium, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
  safetyInfo: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  modalHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: colors.gray200, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 22 },
  modalSubtitle: { color: colors.gray600, fontFamily: font.medium, fontSize: 12, marginTop: 4, marginBottom: spacing.md },
  inputLabel: { color: colors.gray700, fontFamily: font.bold, fontSize: 12, marginBottom: 8, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.gray900,
    fontFamily: font.medium,
    fontSize: 14,
    marginBottom: 8,
  },
  readOnlyInput: { backgroundColor: colors.gray100, color: colors.gray600 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  secondaryAction: {
    flex: 1,
    marginRight: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryActionText: { color: colors.gray700, fontFamily: font.bold, fontSize: 14 },
  primaryAction: {
    flex: 1,
    marginLeft: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.green,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryActionText: { color: colors.white, fontFamily: font.bold, fontSize: 14 },
});
