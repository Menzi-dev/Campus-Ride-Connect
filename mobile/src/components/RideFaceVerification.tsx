// Ride face check: guide a fresh capture, ask the backend to compare it and keep the returned
// confirmation for booking or driver acceptance. Show progress, errors and retry actions.
// Where: mobile/src/components/RideFaceVerification.tsx.
// How: RideFaceVerification() renders GuidedFaceScan, calls compare() to get a backend token, then
// calls submit()/onVerified() to continue the parent ride action.
/** Compares a fresh face scan with the account enrollment before submitting the verified ride action. */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import GuidedFaceScan, { FaceScanResult } from './GuidedFaceScan';
import apiClient from '../services/ApiClient';

export default function RideFaceVerification({ draft, scheduled, mode = 'rider', onClose, onVerified }: {
  draft: Record<string, unknown>; scheduled?: boolean; onClose: () => void;
  mode?: 'rider' | 'driver';
  onVerified: (token: string) => Promise<void>;
}) {
  const [phase, setPhase] = useState<'scan' | 'matching' | 'matched' | 'submitting' | 'error'>('scan');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [scanKey, setScanKey] = useState(0);
  const mounted = useRef(true);
  const busy = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // Feature: Send the fresh scan to the rider or driver comparison endpoint and keep its returned
  // confirmation.
  // Where: RideFaceVerification.compare() below.
  // How: compare() posts the captured JPEG to /face/verify-driver or /face/verify-ride, depending
  // on mode. RideFaceVerificationController calls RideFaceVerificationService; setToken() stores
  // the returned confirmation and setPhase() shows success/error.
  async function compare(result: FaceScanResult) {
    if (busy.current) return;
    busy.current = true; setPhase('matching'); setError('');
    try {
      const response = await apiClient.post(mode === 'driver' ? '/face/verify-driver' : '/face/verify-ride',
        mode === 'driver' ? { image: result.image, rideId: draft.rideId } : { image: result.image, ride: draft }, { timeout: 35000 });
      if (!mounted.current) return;
      if (response.data?.success !== true || typeof response.data.verificationToken !== 'string') throw new Error('No face-match confirmation was returned. Please try again.');
      setToken(response.data.verificationToken); setPhase('matched');
    } catch (cause: any) {
      if (mounted.current) { setError(cause?.response?.data?.error || cause?.message || 'Face match failed. Please try again.'); setPhase('error'); }
    } finally { busy.current = false; }
  }
  // Keep the verified token for submission retries; the backend handles duplicate requests.
  // Feature: Pass the successful face confirmation to the parent booking or acceptance action.
  // Where: RideFaceVerification.submit() below.
  // How: submit() calls the onVerified(token) callback supplied by the parent screen.
  // HomeScreen/ScheduleRideScreen use it to create a ride; ViewRideDetailsScreen uses it for driver
  // acceptance.
  async function submit() {
    if (busy.current) return;
    busy.current = true; setPhase('submitting');
    try { await onVerified(token); }
    catch (cause: any) {
      if (mounted.current) { setError(cause?.response?.data?.error || 'Could not submit your ride. Scan again to retry.'); setPhase('error'); }
    } finally { busy.current = false; }
  }
  // Feature: Briefly show the successful match, then continue the verified ride action.
  // Clear the delay when the phase changes so an old timer cannot submit later.
  // Where: the effect watching phase and token below, following compare() and submit().
  // How: a matched phase starts a short 300 ms timer that calls submit(); cleanup clears it.
  useEffect(() => {
    if (phase !== 'matched') return;
    const timer = setTimeout(() => { if (mounted.current) void submit(); }, 300);
    return () => clearTimeout(timer);
  }, [phase, token]);
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy.current) onClose(); }}>
    <View style={styles.background}><View style={styles.card}><ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Confirm it’s you</Text>
      <Text style={styles.subtitle}>Match your face with the photo enrolled on this account before {mode === 'driver' ? 'accepting this ride and opening navigation' : scheduled ? 'booking your scheduled ride' : 'finding a driver'}.</Text>
      {phase === 'scan' && <GuidedFaceScan key={scanKey} purpose="ride" onComplete={compare} />}
      {(phase === 'matching' || phase === 'submitting') && <View style={styles.result}><ActivityIndicator size="large" color="#00a651" /><Text style={styles.body}>{phase === 'matching' ? 'Comparing your face with your account…' : mode === 'driver' ? 'Accepting your verified ride…' : 'Submitting your verified ride…'}</Text></View>}
      {phase === 'matched' && <View style={styles.result}><Text style={styles.check}>✓</Text><Text style={styles.title}>Face match successful</Text><Text style={styles.body}>Your scan matches this account’s enrollment photo.</Text><Pressable accessibilityRole="button" style={styles.button} onPress={submit}><Text style={styles.buttonText}>{mode === 'driver' ? 'Open active ride' : scheduled ? 'Confirm scheduled ride' : 'Find drivers'}</Text></Pressable></View>}
      {phase === 'error' && <View style={styles.result}><Text style={styles.title}>Could not complete your request</Text><Text accessibilityRole="alert" style={styles.body}>{error}</Text>{!!token && <Pressable accessibilityRole="button" style={styles.button} onPress={submit}><Text style={styles.buttonText}>Retry submission</Text></Pressable>}<Pressable accessibilityRole="button" style={styles.button} onPress={() => { setToken(''); setError(''); setScanKey(k => k + 1); setPhase('scan'); }}><Text style={styles.buttonText}>Scan again</Text></Pressable></View>}
      <Pressable accessibilityRole="button" disabled={phase === 'matching' || phase === 'submitting'} style={styles.cancel} onPress={onClose}><Text style={styles.body}>Cancel request</Text></Pressable>
    </ScrollView></View></View>
  </Modal>;
}
// Screen appearance: keep layout, spacing, colours and text styles together here.
const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: { width: '100%', maxWidth: 480, maxHeight: '96%', backgroundColor: 'white', borderRadius: 24 },
  content: { padding: 22 }, title: { fontSize: 24, fontWeight: '700', color: '#19352a', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 14, lineHeight: 21, color: '#52655a', textAlign: 'center', marginBottom: 20 },
  body: { fontSize: 15, lineHeight: 22, color: '#334155', textAlign: 'center', marginVertical: 12 },
  result: { paddingVertical: 30, alignItems: 'center' }, check: { fontSize: 64, color: '#00a651', marginBottom: 16 },
  button: { backgroundColor: '#00a651', padding: 16, borderRadius: 12, alignItems: 'center', width: '100%', marginTop: 20 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' }, cancel: { alignItems: 'center', marginTop: 12 },
});
