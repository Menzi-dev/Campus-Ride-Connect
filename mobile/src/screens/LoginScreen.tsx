// mobile/src/screens/LoginScreen.tsx
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
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
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
import BottomSheetModal from '../components/BottomSheetModal';
import { useToast } from '../components/Toast';
import { colors, radius, spacing, font } from '../theme/theme';
import apiClient from '../services/ApiClient';

// 👇 Your uploaded icon
const LOGO = require('../assets/icon.png');

type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  CreateAccount: undefined;
  Home: { skipActiveRideRestore?: boolean } | undefined;
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

type PasswordResetStep = 'email' | 'code' | 'password';

const ROLE_OPTIONS: RoleOption[] = [
  { label: 'Student (Rider)', value: 'RIDER', description: 'Book rides across campus', icon: User, iconColor: colors.green },
  { label: 'Student Driver', value: 'DRIVER', description: 'Offer rides and earn', icon: Car, iconColor: colors.blue },
  { label: 'University Admin', value: 'ADMIN', description: 'Manage the platform', icon: Building2, iconColor: colors.orange },
  { label: 'Campus Security', value: 'SECURITY', description: 'Monitor and respond to incidents', icon: ShieldAlert, iconColor: colors.red },
];

export default function LoginScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const isCompact = viewportWidth < 640;
  const logoSize = Math.min(
    isCompact ? 220 : 320,
    viewportWidth * (isCompact ? 0.36 : 0.42),
    viewportHeight * (isCompact ? 0.22 : 0.24),
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleOption>(ROLE_OPTIONS[0]);
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);
  const [resetSheetVisible, setResetSheetVisible] = useState(false);
  const [resetStep, setResetStep] = useState<PasswordResetStep>('email');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const SelectedRoleIcon = selectedRole.icon;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

  React.useEffect(() => {
    if (!resetSheetVisible || resetStep !== 'code' || resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resetSheetVisible, resetStep, resendCountdown]);

  const openPasswordReset = () => {
    setResetEmail(email.trim());
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetStep('email');
    setResendCountdown(0);
    setResetSheetVisible(true);
  };

  const requestResetCode = async () => {
    const normalizedEmail = resetEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showToast('Enter a valid email address', 'red');
      return;
    }

    setResetLoading(true);
    try {
      await apiClient.post('/auth/password-reset/request', { email: normalizedEmail });
      setResetEmail(normalizedEmail);
      setResetCode('');
      setResetStep('code');
      setResendCountdown(60);
      showToast(
        'If an account exists, a reset code has been sent. If you requested one in the last minute, wait before requesting again.',
        'green',
      );
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Password recovery is unavailable right now', 'red');
    } finally {
      setResetLoading(false);
    }
  };

  const verifyResetCode = async () => {
    if (!/^\d{6}$/.test(resetCode.trim())) {
      showToast('Enter the 6-digit code from your email', 'red');
      return;
    }

    setResetLoading(true);
    try {
      await apiClient.post('/auth/password-reset/verify', {
        email: resetEmail.trim().toLowerCase(),
        code: resetCode.trim(),
      });
      setResetStep('password');
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'That code is invalid or expired', 'red');
    } finally {
      setResetLoading(false);
    }
  };

  const submitPasswordReset = async () => {
    if (newPassword.length < 8) {
      showToast('Your new password must be at least 8 characters', 'red');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast('Passwords do not match', 'red');
      return;
    }

    setResetLoading(true);
    try {
      await apiClient.post('/auth/password-reset/confirm', {
        email: resetEmail.trim().toLowerCase(),
        code: resetCode.trim(),
        newPassword,
        confirmPassword: confirmNewPassword,
      });
      setEmail(resetEmail.trim().toLowerCase());
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetStep('email');
      setResetSheetVisible(false);
      showToast('Password reset successfully. Sign in with your new password.', 'green');
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'That code is invalid or expired', 'red');
    } finally {
      setResetLoading(false);
    }
  };

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

    if (isAdminEmail && password !== 'SANELEDLOMO@2005') {
      showToast('Admin must sign in with admin@spu.ac.za and password SANELEDLOMO@2005', 'red');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', {
        email: normalizedEmail,
        password,
      });

      const { token, user } = response.data;

      await AsyncStorage.multiRemove(['saved_cards', 'default_payment_method']);
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      showToast(`Welcome back${user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}!`, 'green');

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
            navigation.replace('Home', { skipActiveRideRestore: true });
        }
      }, 500);
    } catch (error: any) {
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Decorative background blobs */}
      <View style={[styles.blob, styles.blobGreen]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobLowerGreen]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobOutline]} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          isCompact
            ? { paddingTop: Math.max(28, viewportHeight * 0.04), paddingBottom: 0 }
            : { paddingTop: Math.min(48, viewportHeight * 0.02), paddingBottom: 12 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ============== LOGO + WORDMARK ============== */}
          <View style={[styles.logoContainer, isCompact && styles.logoContainerCompact]}>
            <Image source={LOGO} style={{ width: logoSize, height: logoSize }} resizeMode="contain" />
          </View>

          {/* ============== WELCOME ============== */}
          <Text style={[styles.welcomeTitle, isCompact && styles.compactWelcomeTitle]}>Welcome back</Text>
          <Text style={[styles.welcomeSubtitle, isCompact && styles.compactWelcomeSubtitle]}>
            Sign in to keep your campus moving
          </Text>

          {/* ============== ROLE PICKER ============== */}
          <View style={[styles.inputContainer, styles.roleInputContainer]}>
            <Text style={[styles.inputLabel, styles.roleInputLabel, isCompact && styles.compactInputLabel]}>I am a</Text>
            <TouchableOpacity
              style={[styles.roleField, isCompact && styles.compactField]}
              onPress={() => setRoleSheetVisible(true)}
              disabled={loading}
              activeOpacity={0.7}
            >
              <View style={styles.roleFieldLeft}>
                <SelectedRoleIcon
                  size={isCompact ? 16 : 18}
                  color={selectedRole.iconColor}
                  strokeWidth={2}
                />
                <Text style={[styles.roleFieldText, isCompact && styles.compactRoleFieldText]}>{selectedRole.label}</Text>
              </View>
              <ChevronDown size={isCompact ? 16 : 18} color={colors.gray400} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* ============== EMAIL ============== */}
          <View style={[styles.inputContainer, styles.emailInputContainer]}>
            <Text style={[styles.inputLabel, isCompact && styles.compactInputLabel]}>Email</Text>
            <View style={[styles.fieldRow, isCompact && styles.compactField]}>
              <Mail size={isCompact ? 16 : 18} color={colors.gray400} strokeWidth={1.8} />
              <TextInput
                style={[styles.fieldInput, isCompact && styles.compactFieldInput]}
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

          {/* ============== PASSWORD ============== */}
          <View style={[styles.inputContainer, styles.passwordInputContainer]}>
            <Text style={[styles.inputLabel, styles.passwordInputLabel, isCompact && styles.compactInputLabel]}>Password</Text>
            <View style={[styles.fieldRow, isCompact && styles.compactField]}>
              <Lock size={isCompact ? 16 : 18} color={colors.gray400} strokeWidth={1.8} />
              <TextInput
                style={[styles.fieldInput, isCompact && styles.compactFieldInput]}
                placeholder="••••••••"
                placeholderTextColor={colors.gray400}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((p) => !p)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={isCompact ? 16 : 18} color={colors.gray400} strokeWidth={1.8} />
                ) : (
                  <Eye size={isCompact ? 16 : 18} color={colors.gray400} strokeWidth={1.8} />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.passwordActionsRow}>
              <TouchableOpacity
                style={styles.rememberMeButton}
                onPress={() => setRememberMe((value) => !value)}
                disabled={loading}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe, disabled: loading }}
                accessibilityLabel="Remember me"
                aria-checked={rememberMe}
              >
                <View style={[styles.rememberCheckbox, rememberMe && styles.rememberCheckboxChecked]}>
                  {rememberMe && <Check size={12} color={colors.white} strokeWidth={3} />}
                </View>
                <Text style={[styles.rememberMeText, isCompact && styles.compactRememberMeText]}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openPasswordReset} disabled={loading}>
                <Text style={[styles.forgotPasswordText, isCompact && styles.compactForgotPasswordText]}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ============== SIGN IN ============== */}
          <TouchableOpacity
            style={[styles.signInButton, isCompact && styles.compactSignInButton]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <View style={styles.signInContent}>
                <Text style={[styles.signInText, isCompact && styles.compactSignInText]}>Sign In</Text>
                <ArrowRight size={isCompact ? 18 : 22} color={colors.white} strokeWidth={2.2} />
              </View>
            )}
          </TouchableOpacity>

          {/* ============== CREATE ACCOUNT ============== */}
          <View style={[styles.footerRow, isCompact && styles.compactFooterRow]}>
            <Text style={[styles.footerText, isCompact && styles.compactFooterText]}>New to campus?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateAccount')}
              disabled={loading}
            >
              <Text style={[styles.createAccountLink, isCompact && styles.compactCreateAccountLink]}> Create Account</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ============== ROLE PICKER SHEET ============== */}
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

      {/* ============== PASSWORD RESET SHEET ============== */}
      <BottomSheetModal
        visible={resetSheetVisible}
        onClose={() => {
          setResetSheetVisible(false);
          setResetStep('email');
        }}
        title={
          resetStep === 'email'
            ? 'Reset your password'
            : resetStep === 'code'
            ? 'Verify your email'
            : 'Create a new password'
        }
        subtitle={
          resetStep === 'email'
            ? 'If an account exists, we will send a one-time code to its email.'
            : resetStep === 'code'
            ? 'Enter the 6-digit code sent to your inbox.'
            : 'Choose a new password and confirm it below.'
        }
      >
        <View style={styles.resetFields}>
          {resetStep === 'email' ? (
            <>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.fieldRow}>
                <Mail size={18} color={colors.gray400} strokeWidth={1.8} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="studentNumber@spu.ac.za"
                  placeholderTextColor={colors.gray400}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!resetLoading}
                />
              </View>
            </>
          ) : null}

          {resetStep === 'code' && (
            <>
              <Text style={styles.resetEmailHint}>{resetEmail}</Text>
              <Text style={styles.inputLabel}>6-digit code</Text>
              <View style={styles.fieldRow}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="000000"
                  placeholderTextColor={colors.gray400}
                  value={resetCode}
                  onChangeText={(value) => setResetCode(value.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!resetLoading}
                />
              </View>
            </>
          )}

          {resetStep === 'password' && (
            <>
              <Text style={styles.inputLabel}>New password</Text>
              <View style={styles.fieldRow}>
                <Lock size={18} color={colors.gray400} strokeWidth={1.8} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.gray400}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  editable={!resetLoading}
                />
              </View>

              <Text style={styles.inputLabel}>Confirm new password</Text>
              <View style={styles.fieldRow}>
                <Lock size={18} color={colors.gray400} strokeWidth={1.8} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Re-enter your new password"
                  placeholderTextColor={colors.gray400}
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry
                  editable={!resetLoading}
                  returnKeyType="done"
                  onSubmitEditing={submitPasswordReset}
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.resetAction}
            onPress={
              resetStep === 'email'
                ? requestResetCode
                : resetStep === 'code'
                ? verifyResetCode
                : submitPasswordReset
            }
            disabled={resetLoading}
            activeOpacity={0.85}
          >
            {resetLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.resetActionText}>
                {resetStep === 'email' ? 'Send reset code' : resetStep === 'code' ? 'Verify code' : 'Reset password'}
              </Text>
            )}
          </TouchableOpacity>

          {resetStep === 'code' && (
            <View style={styles.resetSecondaryActions}>
              <TouchableOpacity
                onPress={() => {
                  setResetStep('email');
                  setResetCode('');
                }}
                disabled={resetLoading}
                style={styles.resendAction}
              >
                <Text style={styles.resendText}>Change email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={requestResetCode}
                disabled={resetLoading || resendCountdown > 0}
                style={styles.resendAction}
              >
                <Text style={[styles.resendText, resendCountdown > 0 && styles.resendDisabledText]}>
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Send a new code'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {resetStep === 'password' && (
            <TouchableOpacity
              onPress={() => setResetStep('code')}
              disabled={resetLoading}
              style={styles.resendAction}
            >
              <Text style={styles.resendText}>Back to code</Text>
            </TouchableOpacity>
          )}
        </View>
      </BottomSheetModal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.white, overflow: 'hidden' },

  // Background blobs
  blob: { position: 'absolute', borderRadius: 999 },
  blobGreen: { width: 512, height: 512, backgroundColor: 'rgba(34,197,94,0.07)', top: -256, right: -256 },
  blobLowerGreen: { width: 360, height: 360, backgroundColor: 'rgba(34,197,94,0.07)', bottom: -220, left: -130 },
  blobOutline: {
    width: 420,
    height: 420,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.16)',
    bottom: -248,
    left: -168,
  },

  scrollContainer: { flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: '6.2%', paddingBottom: 40 },

  // ===== Logo row =====
  logoContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 0 },
  logoContainerCompact: { marginHorizontal: 0 },

  // ===== Welcome =====
  welcomeTitle: {
    fontFamily: font.extrabold,
    fontSize: 28,
    fontWeight: '800',
    color: '#17212b',
    marginBottom: 6,
  },
  compactWelcomeTitle: { fontSize: 28, marginBottom: 6 },
  welcomeSubtitle: {
    fontFamily: font.regular,
    fontSize: 15,
    color: '#8492a9',
    marginBottom: 18,
  },
  compactWelcomeSubtitle: { fontSize: 14, marginBottom: 16 },

  // ===== Fields =====
  inputContainer: { marginBottom: 0 },
  roleInputContainer: { marginBottom: 16 },
  emailInputContainer: { marginBottom: 20 },
  passwordInputContainer: { marginBottom: 0 },
  inputLabel: {
    fontFamily: font.semibold,
    color: '#263750',
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '600',
  },
  compactInputLabel: { fontSize: 13, marginBottom: 4 },
  roleInputLabel: { marginBottom: 6 },
  passwordInputLabel: { marginBottom: 6 },
  passwordActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 9,
    minHeight: 24,
  },
  rememberMeButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  rememberCheckbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  rememberCheckboxChecked: { backgroundColor: colors.green, borderColor: colors.green },
  rememberMeText: { fontFamily: font.medium, color: '#71809a', fontSize: 13 },
  compactRememberMeText: { fontSize: 12 },

  roleField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f7f9fb',
    borderWidth: 1.5,
    borderColor: '#dce4ef',
    borderRadius: 15,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  compactField: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14, gap: 10 },
  roleFieldLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactRoleFieldText: { fontSize: 14 },
  roleFieldText: {
    fontFamily: font.medium,
    fontSize: 15,
    color: '#263750',
    fontWeight: '500',
  },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#f7f9fb',
    borderWidth: 1.5,
    borderColor: '#dce4ef',
    borderRadius: 15,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  fieldInput: {
    flex: 1,
    fontFamily: font.regular,
    paddingVertical: 9,
    fontSize: 15,
    color: '#263750',
  },
  compactFieldInput: { paddingVertical: 7, fontSize: 14 },

  forgotPasswordText: {
    color: '#71809a',
    fontFamily: font.semibold,
    fontSize: 12,
  },
  compactForgotPasswordText: { fontSize: 11 },

  signInButton: {
    marginTop: 16,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#08a253',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#08a253',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  compactSignInButton: { marginTop: 14, height: 48, borderRadius: 12 },
  signInContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },
  signInText: {
    color: colors.white,
    fontFamily: font.bold,
    fontSize: 16,
    fontWeight: '700',
  },
  compactSignInText: { fontSize: 15 },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
  },
  compactFooterRow: { marginTop: 12 },
  footerText: { fontFamily: font.regular, color: '#8492a9', fontSize: 14 },
  compactFooterText: { fontSize: 13 },
  createAccountLink: {
    fontFamily: font.bold,
    color: '#08a253',
    fontSize: 14,
    fontWeight: '700',
  },
  compactCreateAccountLink: { fontSize: 13 },

  // ===== Reset sheet =====
  resetFields: { gap: 10 },
  resetEmailHint: { color: colors.gray500, fontFamily: font.medium, fontSize: 13 },
  resetSecondaryActions: { flexDirection: 'row', justifyContent: 'space-between' },
  resetAction: {
    minHeight: 52,
    marginTop: 12,
    borderRadius: radius.md,
    backgroundColor: '#08a253',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetActionText: { color: colors.white, fontFamily: font.bold, fontSize: 15 },
  resendAction: { alignSelf: 'center', padding: 10 },
  resendText: { color: colors.greenDark, fontFamily: font.semibold, fontSize: 14 },
  resendDisabledText: { color: colors.gray400 },

  // ===== Role option =====
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
  roleOptionSelected: {
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
  },
  roleOptionText: { flex: 1 },
  roleOptionLabel: {
    fontFamily: font.bold,
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
  },
  roleOptionDesc: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.gray500,
    marginTop: 1,
  },
});