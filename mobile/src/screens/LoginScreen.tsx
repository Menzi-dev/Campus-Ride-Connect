import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Navigation,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronDown,
  ArrowRight,
  Check,
  User,
  Car,
  Building2,
  ShieldAlert,
} from 'lucide-react-native';
import Button from '../components/Button';
import BottomSheetModal from '../components/BottomSheetModal';
import { useToast } from '../components/Toast';
import { colors, radius, spacing, font } from '../theme/theme';
import apiClient from '../services/ApiClient';

type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  CreateAccount: undefined;
  Home: undefined;
  AdminDashboard: undefined;
  DriverDashboard: undefined;
  SecurityDashboard: undefined;
};

type RoleOption = {
  label: string;
  value: 'RIDER' | 'DRIVER' | 'ADMIN' | 'SECURITY';
  description: string;
  icon: React.ComponentType<any>;
  iconColor: string;
};

const ROLE_OPTIONS: RoleOption[] = [
  { label: 'Student (Rider)', value: 'RIDER', description: 'Book rides across campus', icon: User, iconColor: colors.green },
  { label: 'Student Driver', value: 'DRIVER', description: 'Offer rides and earn', icon: Car, iconColor: colors.blue },
  { label: 'University Admin', value: 'ADMIN', description: 'Manage the platform', icon: Building2, iconColor: colors.orange },
  { label: 'Campus Security', value: 'SECURITY', description: 'Monitor and respond to incidents', icon: ShieldAlert, iconColor: colors.red },
];

export default function LoginScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleOption>(ROLE_OPTIONS[0]);
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);

  const SelectedRoleIcon = selectedRole.icon;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password.trim()) {
      showToast('Please fill in both email and password', 'red');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      showToast('Please enter a valid email address', 'red');
      return;
    }

    const normalizedEmail = trimmedEmail.toLowerCase();
    const isAdminEmail = normalizedEmail === 'admin@spu.ac.za';

    if (isAdminEmail && password !== 'admin12345') {
      showToast('Admin must sign in with admin@spu.ac.za and password admin12345', 'red');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', {
        email: normalizedEmail,
        password,
      });

      const { token, user } = response.data;

      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      showToast(`Welcome back${user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}!`, 'green');

      // Route by the role the BACKEND returns, not the client-selected value —
      // the role picker is a UX hint for the request, the server is the source of truth.
      setTimeout(() => {
        switch (user.role) {
          case 'ADMIN':
            navigation.replace('AdminDashboard');
            break;
          case 'SECURITY':
            navigation.replace('SecurityDashboard');
            break;
          case 'DRIVER':
            navigation.replace('DriverDashboard');
            break;
          default:
            navigation.replace('Home');
        }
      }, 500);
    } catch (error: any) {
      console.log('Login error:', error);
      console.log('Error response:', error?.response);
      console.log('Error message:', error?.message);
      const message =
        error?.response?.status === 401 || error?.response?.status === 404
          ? 'No account found with those credentials'
          : error?.response?.data?.error ||
            (error?.message === 'Network Error'
              ? 'Cannot reach the server. Check your connection.'
              : 'Something went wrong. Please try again.');
      showToast(message, 'red');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <View style={[styles.blob, styles.blobGreen]} pointerEvents="none" />

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* LOGO */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={[colors.green, colors.greenDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoCircle}
            >
              <Navigation size={24} color={colors.white} strokeWidth={2} fill={colors.white} />
            </LinearGradient>
            <Text style={styles.logoText}>CampusConnect</Text>
          </View>

          {/* WELCOME */}
          <Text style={styles.welcomeTitle}>Welcome back</Text>
          <Text style={styles.welcomeSubtitle}>Sign in to keep your campus moving</Text>

          {/* ROLE PICKER */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>I am a</Text>
            <TouchableOpacity
              style={styles.roleField}
              onPress={() => setRoleSheetVisible(true)}
              disabled={loading}
              activeOpacity={0.7}
            >
              <View style={styles.roleFieldLeft}>
                  <SelectedRoleIcon size={18} color={selectedRole.iconColor} strokeWidth={2} />
                <Text style={styles.roleFieldText}>{selectedRole.label}</Text>
              </View>
              <ChevronDown size={18} color={colors.gray400} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* EMAIL */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.fieldRow}>
              <Mail size={18} color={colors.gray400} strokeWidth={1.8} />
              <TextInput
                style={styles.fieldInput}
                placeholder="studentNumber@spu.ac.za"
                placeholderTextColor={colors.gray400}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!loading}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* PASSWORD */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.fieldRow}>
              <Lock size={18} color={colors.gray400} strokeWidth={1.8} />
              <TextInput
                style={styles.fieldInput}
                placeholder="••••••••"
                placeholderTextColor={colors.gray400}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword((p) => !p)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                {showPassword ? (
                  <EyeOff size={18} color={colors.gray400} strokeWidth={1.8} />
                ) : (
                  <Eye size={18} color={colors.gray400} strokeWidth={1.8} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* SIGN IN */}
          <Button
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            icon={<ArrowRight size={18} color={colors.white} strokeWidth={2} />}
            style={{ marginTop: spacing.sm }}
          />

          {/* CREATE ACCOUNT */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to campus?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('CreateAccount')} disabled={loading}>
              <Text style={styles.createAccountLink}> Create Account</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ROLE PICKER SHEET */}
      <BottomSheetModal
        visible={roleSheetVisible}
        onClose={() => setRoleSheetVisible(false)}
        title="Select your role"
        subtitle="Choose how you use CampusConnect"
      >
        {ROLE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = option.value === selectedRole.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.roleOption, isSelected && styles.roleOptionSelected]}
              onPress={() => {
                setSelectedRole(option);
                setRoleSheetVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Icon size={20} color={option.iconColor} strokeWidth={2} />
              <View style={styles.roleOptionText}>
                <Text style={styles.roleOptionLabel}>{option.label}</Text>
                <Text style={styles.roleOptionDesc}>{option.description}</Text>
              </View>
              {isSelected && <Check size={18} color={colors.green} strokeWidth={2.5} />}
            </TouchableOpacity>
          );
        })}
      </BottomSheetModal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  blobGreen: {
    width: 320,
    height: 320,
    backgroundColor: 'rgba(34,197,94,0.08)',
    top: -160,
    right: -120,
  },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xxxl, paddingVertical: 40 },

  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.xxl },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  logoText: { fontFamily: font.extrabold, fontSize: 19, fontWeight: '800', color: colors.gray900 },

  welcomeTitle: { fontFamily: font.extrabold, fontSize: 26, fontWeight: '800', color: colors.gray900, marginBottom: 4 },
  welcomeSubtitle: { fontFamily: font.regular, fontSize: 14, color: colors.gray500, marginBottom: spacing.xxl },

  inputContainer: { marginBottom: spacing.lg },
  inputLabel: { fontFamily: font.semibold, color: colors.gray700, fontSize: 13, marginBottom: 6, fontWeight: '600' },

  roleField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  roleFieldLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roleFieldText: { fontFamily: font.medium, fontSize: 15, color: colors.gray800, fontWeight: '500' },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.gray50,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  fieldInput: {
    flex: 1,
    fontFamily: font.regular,
    color: colors.gray900,
    paddingVertical: 13,
    fontSize: 15,
  },

  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { fontFamily: font.regular, color: colors.gray500, fontSize: 14 },
  createAccountLink: { fontFamily: font.bold, color: colors.green, fontSize: 14, fontWeight: '700' },

  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    marginBottom: 8,
  },
  roleOptionSelected: { borderColor: colors.green, backgroundColor: colors.greenLight },
  roleOptionText: { flex: 1 },
  roleOptionLabel: { fontFamily: font.bold, fontSize: 15, fontWeight: '700', color: colors.gray900 },
  roleOptionDesc: { fontFamily: font.regular, fontSize: 12, color: colors.gray500, marginTop: 1 },
});