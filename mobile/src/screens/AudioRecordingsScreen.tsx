import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowDownToLine, ArrowLeft, Headphones, Pause, Play, TriangleAlert } from 'lucide-react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../services/ApiClient';
import { colors, font, radius, shadow, spacing } from '../theme/theme';

type RootStackParamList = { IncidentReports: undefined; SecurityDashboard: undefined; AudioRecordings: { incidentId: number; security?: boolean } };
type Incident = { referenceNumber: string; typeLabel: string; status: string; rideReference: string; createdAt: string; hasAudio: boolean; recordingDuration?: number };

type AudioRoute = RouteProp<RootStackParamList, 'AudioRecordings'>;

export default function AudioRecordingsScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<AudioRoute>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const securityRecording = route.params.security === true;
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const nativeSoundRef = useRef<Audio.Sound | null>(null);
  const recordingUrl = `${apiClient.defaults.baseURL || ''}${securityRecording ? `/security/sos/${route.params.incidentId}/audio` : `/admin/incidents/${route.params.incidentId}/audio`}`;
  const [error, setError] = useState<string | null>(null);

  const loadIncident = useCallback(async () => {
    setLoading(true);
    try {
      if (securityRecording) {
        const response = await apiClient.get('/security/sos');
        const alert = [...(response.data?.active || []), ...(response.data?.resolved || [])].find((item: any) => item.id === route.params.incidentId);
        setIncident(alert ? { referenceNumber: alert.reference, typeLabel: 'SOS Alert', status: alert.status, rideReference: alert.rideReference, createdAt: alert.createdAt, hasAudio: alert.hasAudio, recordingDuration: alert.recordingDuration } : null);
      } else {
        const response = await apiClient.get(`/admin/incidents/${route.params.incidentId}`);
        setIncident(response.data);
      }
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load this recording');
    } finally {
      setLoading(false);
    }
  }, [route.params.incidentId]);

  useFocusEffect(useCallback(() => { loadIncident(); }, [loadIncident]));

  const openRecording = async () => {
    if (Platform.OS !== 'web' && nativeSoundRef.current) {
      const status = await nativeSoundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await nativeSoundRef.current.pauseAsync();
          setPlaying(false);
        } else {
          await nativeSoundRef.current.playAsync();
          setPlaying(true);
        }
      }
      return;
    }
    if (playerRef.current) {
      if (playing) { playerRef.current.pause(); setPlaying(false); } else { await playerRef.current.play(); setPlaying(true); }
      return;
    }
    setOpening(true);
    try {
      if (Platform.OS !== 'web') {
        const token = await AsyncStorage.getItem('authToken');
        const { sound } = await Audio.Sound.createAsync(
          { uri: recordingUrl, headers: token ? { Authorization: `Bearer ${token}` } : undefined },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              setPlaying(false);
              void sound.unloadAsync();
              nativeSoundRef.current = null;
            }
          },
        );
        nativeSoundRef.current = sound;
        setPlaying(true);
        return;
      }
      const response = await apiClient.get(`${securityRecording ? '/security/sos' : '/admin/incidents'}/${securityRecording ? route.params.incidentId + '/audio' : route.params.incidentId + '/audio'}`, { responseType: 'blob' });
      if (typeof window !== 'undefined' && response.data instanceof Blob) {
        const objectUrl = URL.createObjectURL(response.data);
        const player = new window.Audio(objectUrl);
        playerRef.current = player;
        player.onended = () => { setPlaying(false); URL.revokeObjectURL(objectUrl); playerRef.current = null; };
        await player.play();
        setPlaying(true);
      } else {
        await Linking.openURL(recordingUrl);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not open this recording');
    } finally {
      setOpening(false);
    }
  };

  useFocusEffect(useCallback(() => () => {
    void nativeSoundRef.current?.unloadAsync();
    nativeSoundRef.current = null;
  }, []));

  return <View style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><ArrowLeft size={20} color={colors.greenDark} /><Text style={styles.backText}>Back</Text></TouchableOpacity>
      <Text style={styles.title}>Audio Recordings</Text>
    </View>
    {loading ? <ActivityIndicator size="large" color={colors.green} style={styles.loader} /> : error ? <View style={styles.state}><TriangleAlert size={32} color={colors.red} /><Text style={styles.stateTitle}>Could not load recording</Text><Text style={styles.stateText}>{error}</Text><TouchableOpacity style={styles.retry} onPress={loadIncident}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : !incident?.hasAudio ? <View style={styles.state}><TriangleAlert size={32} color={colors.gray400} /><Text style={styles.stateTitle}>No audio evidence</Text><Text style={styles.stateText}>This incident does not have an audio recording.</Text></View> : <View style={styles.content}>
      <View style={styles.warning}><TriangleAlert size={17} color={colors.yellowText} /><Text style={styles.warningText}>Access is logged and auditable. Use only with authorisation.</Text></View>
      <View style={styles.recordingCard}>
        <View style={styles.iconCircle}><Headphones size={30} color={colors.blue} /></View>
        <Text style={styles.reference}>#{incident.referenceNumber}</Text>
        <Text style={styles.meta}>{incident.typeLabel}  •  Ride #{incident.rideReference}</Text>
        <Text style={styles.meta}>{incident.status}  •  {incident.recordingDuration ? `${incident.recordingDuration}s` : 'Duration unavailable'}</Text>
        <View style={styles.actionRow}><TouchableOpacity style={styles.playButton} onPress={openRecording} disabled={opening}>{playing ? <Pause size={18} color={colors.white} /> : <Play size={18} color={colors.white} />}<Text style={styles.playText}>{opening ? 'Loading...' : playing ? 'Pause' : 'Play'}</Text></TouchableOpacity><TouchableOpacity style={styles.downloadButton} onPress={() => Linking.openURL(recordingUrl)}><ArrowDownToLine size={18} color={colors.gray800} /><Text style={styles.downloadText}>Download</Text></TouchableOpacity></View>
      </View>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { backgroundColor: colors.white, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: spacing.sm },
  backText: { color: colors.greenDark, fontFamily: font.semibold, fontSize: 14 },
  title: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 24 },
  loader: { marginTop: spacing.xxxl },
  content: { padding: spacing.lg },
  warning: { backgroundColor: colors.yellowLight, borderWidth: 1, borderColor: '#FDE68A', borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.md },
  warningText: { flex: 1, color: colors.yellowText, fontFamily: font.medium, fontSize: 12 },
  recordingCard: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xxxl, alignItems: 'center', ...shadow.sm },
  iconCircle: { width: 72, height: 72, borderRadius: radius.full, backgroundColor: colors.blueLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  reference: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 22 },
  meta: { color: colors.gray500, fontFamily: font.medium, fontSize: 13, marginTop: spacing.sm, textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.xl },
  playButton: { flex: 1, minHeight: 50, backgroundColor: colors.blue, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  downloadButton: { flex: 1, minHeight: 50, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  playText: { color: colors.white, fontFamily: font.bold, fontSize: 14 },
  downloadText: { color: colors.gray800, fontFamily: font.bold, fontSize: 14 },
  state: { alignItems: 'center', padding: spacing.xxxl, marginTop: spacing.xxxl },
  stateTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 16, marginTop: spacing.md },
  stateText: { color: colors.gray500, fontFamily: font.regular, fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
  retry: { backgroundColor: colors.green, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, marginTop: spacing.lg },
  retryText: { color: colors.white, fontFamily: font.bold, fontSize: 13 },
});
