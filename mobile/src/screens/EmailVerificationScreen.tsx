import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Mail, ShieldCheck, AlertCircle } from 'lucide-react-native';
import Button from '../components/Button';
import apiClient from '../services/ApiClient';
import { colors, font, radius, spacing } from '../theme/theme';

type Routes = { Login: undefined; EmailVerification: { email?: string; token?: string } | undefined };

export default function EmailVerificationScreen() {
  const navigation = useNavigation<StackNavigationProp<Routes>>();
  const route = useRoute<RouteProp<Routes, 'EmailVerification'>>();
  const [email, setEmail] = useState(route.params?.email || '');
  const [code, setCode] = useState('');
  const [state, setState] = useState<'waiting' | 'checking' | 'success' | 'error'>(route.params?.token ? 'checking' : 'waiting');
  const [message, setMessage] = useState('Enter the six-digit code from your CampusConnect verification email. Check Junk/Spam if it is missing.');
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const token = route.params?.token;
    if (!token || started.current) return;
    started.current = true;
    // Remove the secret from navigation state once captured; never log API errors or request bodies here.
    navigation.setParams({ token: undefined });
    apiClient.post('/auth/email-verification/confirm', { token }).then(() => {
      setState('success');
      setMessage('Your email is verified. You can now log in. Driver applications still require administrator approval.');
    }).catch((error) => {
      setState('error');
      setMessage(error?.response?.data?.error || 'Could not verify this link. Check your connection or request a new link.');
    });
  }, [route.params?.token, navigation]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setMessage('Enter the email address you used to register.');
      return;
    }
    setSending(true);
    try {
      const response = await apiClient.post('/auth/email-verification/resend', { email: address });
      setMessage(response.data.message);
      setCode('');
      setState('waiting');
      setCooldown(60);
    } catch {
      setMessage('Could not request a verification email. Check your connection and try again.');
    } finally { setSending(false); }
  };

  const verifyCode = async () => {
    if (sending || state === 'checking') return;
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || !/^\d{6}$/.test(code)) {
      setMessage('Enter your registration email and the six-digit verification code.');
      return;
    }
    setState('checking');
    try {
      await apiClient.post('/auth/email-verification/confirm-code', { email: address, code });
      setCode('');
      setState('success');
      setMessage('Your email is verified. You can now log in. Driver applications still require administrator approval.');
    } catch (error: any) {
      setState('error');
      setMessage(error?.response?.data?.error || 'Could not verify the code. Check your connection and try again.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.brand}>CampusConnect</Text>
      <View style={styles.card}>
        <View style={styles.icon}>
          {state === 'success' ? <ShieldCheck size={42} color={colors.green} />
            : state === 'error' ? <AlertCircle size={42} color={colors.orange} /> : <Mail size={42} color={colors.green} />}
        </View>
        <Text style={styles.title}>{state === 'success' ? 'Email verified' : 'Verify your email'}</Text>
        <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text>
        {state === 'checking' && <ActivityIndicator color={colors.green} />}
        {state !== 'success' && state !== 'checking' && <>
          <Text style={styles.label}>Registration email</Text>
          <TextInput value={email} onChangeText={setEmail} style={styles.input} placeholder="you@example.com"
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" accessibilityLabel="Registration email" />
          <Text style={styles.label}>Verification code</Text>
          <TextInput value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))}
            style={[styles.input, { textAlign: 'center', fontSize: 24, letterSpacing: 6 }]}
            placeholder="000000" maxLength={6} keyboardType="number-pad" autoComplete="one-time-code"
            textContentType="oneTimeCode" accessibilityLabel="Verification code" />
          <Button label="Verify email" onPress={verifyCode} disabled={sending} />
          <Button label={cooldown ? `Resend available in ${cooldown}s` : 'Resend verification email'} onPress={resend}
            variant="secondary" disabled={sending || cooldown > 0} loading={sending} />
        </>}
        <Button label="Go to Login" variant={state === 'success' ? 'green' : 'secondary'}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.white, padding: spacing.xl, justifyContent: 'center' },
  brand: { fontFamily: font.extrabold, fontSize: 24, color: colors.green, textAlign: 'center', marginBottom: 24 },
  card: { backgroundColor: colors.gray50, borderRadius: radius.lg, padding: 20, gap: 16 },
  icon: { alignSelf: 'center', padding: 18, backgroundColor: colors.greenLight, borderRadius: 50 },
  title: { fontFamily: font.bold, fontSize: 21, color: colors.gray900, textAlign: 'center' },
  message: { color: colors.gray600, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  label: { color: colors.gray700, fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: colors.white, borderColor: colors.gray200, borderWidth: 1, borderRadius: radius.md, padding: 12, fontSize: 15 },
});
