import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, AlertTriangle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useRideSos from '../hooks/useRideSos';
import { colors, font, radius, spacing } from '../theme/theme';
import ScrollableCard from './ScrollableCard';

type Props = { visible: boolean; rideId: number; onClose: () => void };

export default function RideSosModal({ visible, rideId, onClose }: Props) {
  const sos = useRideSos(rideId);
  const insets = useSafeAreaInsets();
  const [closing, setClosing] = useState(false);
  const wave = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (!sos.recording) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(wave, { toValue: 1.25, duration: 300, useNativeDriver: true }),
      Animated.timing(wave, { toValue: 0.5, duration: 300, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [sos.recording, wave]);

  const close = async () => {
    if (closing || (!sos.activated && sos.sending)) return;
    setClosing(true);
    await sos.close();
    setClosing(false);
    onClose();
  };

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => void close()}>
    <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {!sos.activated ? <>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !sos.sending && onClose()} accessibilityLabel="Dismiss SOS confirmation" />
        <ScrollableCard style={styles.confirmation}>
          <View style={styles.handle} />
          <AlertTriangle size={42} color={colors.red} />
          <Text style={styles.title}>Activate SOS Alert?</Text>
          <Text style={styles.subtitle}>This will immediately alert Campus Security with your GPS location and record audio evidence.</Text>
          {sos.error ? <Text style={styles.error} accessibilityRole="alert">{sos.error}</Text> : null}
          <TouchableOpacity style={styles.confirmButton} onPress={sos.confirm} disabled={sos.sending} accessibilityRole="button" accessibilityLabel="Yes, Send SOS Alert">
            {sos.sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Yes, Send SOS Alert</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={sos.sending} accessibilityRole="button" accessibilityLabel="Cancel SOS">
            <Text style={styles.cancelText}>×  Cancel</Text>
          </TouchableOpacity>
        </ScrollableCard>
      </> : <View style={styles.activated}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.back} onPress={() => void close()} disabled={closing} accessibilityRole="button" accessibilityLabel="Back to active trip"><ArrowLeft size={22} color={colors.white} /></TouchableOpacity>
          <View style={styles.headerIcon}><AlertTriangle size={24} color={colors.white} /></View>
          <View style={{ flex: 1 }}><Text style={styles.headerTitle}>SOS Activated</Text><Text style={styles.headerSubtitle}>Campus Security has been alerted</Text></View>
        </View>
        <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={styles.content}>
          <View style={styles.notice}><AlertTriangle size={16} color={colors.red} /><Text style={styles.noticeText}>{sos.location ? 'Campus Security has received your SOS alert and GPS location.' : 'Campus Security has received your SOS alert. Live GPS is unavailable; your trip details are included.'}</Text></View>
          <View style={styles.gps}><Text style={styles.label}>GPS LOCATION</Text><Text style={styles.gpsValue}>{sos.location ? `${sos.location.latitude.toFixed(6)}, ${sos.location.longitude.toFixed(6)}` : 'Live location unavailable'}</Text></View>
          <View style={styles.evidence}><Text style={styles.label}>EVIDENCE AUDIO</Text>{sos.recording && <Text style={styles.rec}>● REC</Text>}</View>
          <Text style={styles.timer}>{String(Math.floor(sos.seconds / 60)).padStart(2, '0')}:{String(sos.seconds % 60).padStart(2, '0')}</Text>
          <View style={styles.waveform}>{[10,18,28,38,24,44,30,18,10,25,15].map((height, index) => <Animated.View key={index} style={[styles.waveBar, { height, transform: [{ scaleY: wave }] }]} />)}</View>
          <Text style={styles.audioMessage}>{sos.recording ? 'Recording in progress...' : sos.audioMessage || 'Starting audio recording...'}</Text>
          {sos.recording && <Text style={styles.recordingHint}>{sos.audioMessage}</Text>}
          <TouchableOpacity style={styles.safeButton} onPress={() => void close()} disabled={closing} accessibilityRole="button" accessibilityLabel="I'm Safe — Back to ride">
            {closing ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>I'm Safe — Back to ride</Text>}
          </TouchableOpacity>
          <Text style={styles.recordingHint}>Returning stops recording. Security will keep the alert until it is resolved.</Text>
        </ScrollView>
      </View>}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, minHeight: 0, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(15,23,42,0.46)' },
  confirmation: { width: '100%', maxWidth: 520, padding: spacing.xl, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.gray300, marginBottom: spacing.xl },
  title: { fontFamily: font.bold, fontSize: 19, color: colors.gray900, textAlign: 'center', marginTop: spacing.lg },
  subtitle: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: colors.gray500, textAlign: 'center', marginVertical: spacing.lg, maxWidth: 320 },
  error: { color: colors.red, fontFamily: font.medium, textAlign: 'center', marginBottom: spacing.md },
  confirmButton: { width: '100%', minHeight: 48, borderRadius: radius.full, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.white, fontFamily: font.bold, fontSize: 14 },
  cancelButton: { width: '100%', minHeight: 44, marginTop: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.gray200, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.gray800, fontFamily: font.semibold, fontSize: 14 },
  activated: { flex: 1, minHeight: 0, width: '100%', maxWidth: 640, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.red },
  back: { width: 34, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f87171', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.white, fontFamily: font.bold, fontSize: 18 },
  headerSubtitle: { color: colors.white, fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  notice: { flexDirection: 'row', gap: spacing.sm, backgroundColor: '#fee2e2', padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  noticeText: { flex: 1, color: colors.red, fontFamily: font.medium, fontSize: 12, lineHeight: 17 },
  gps: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.gray50 },
  label: { color: colors.gray600, fontFamily: font.bold, fontSize: 11, letterSpacing: 0.5 },
  gpsValue: { color: colors.gray900, fontFamily: font.bold, fontSize: 14, marginTop: 7 },
  evidence: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  rec: { color: colors.red, fontFamily: font.bold, fontSize: 11 },
  timer: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 42, textAlign: 'center', marginTop: spacing.lg },
  waveform: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: 54, marginVertical: spacing.md },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: colors.red },
  audioMessage: { color: colors.red, fontFamily: font.medium, fontSize: 13, textAlign: 'center' },
  recordingHint: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: colors.gray500, textAlign: 'center', marginTop: spacing.sm },
  safeButton: { marginTop: spacing.lg, minHeight: 48, borderRadius: radius.full, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
});
