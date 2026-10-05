import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowDownToLine, ArrowLeft, Headphones, Pause, Play, TriangleAlert } from 'lucide-react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../services/ApiClient';
import { useToast } from '../components/Toast';
import { colors, font, radius, shadow, spacing } from '../theme/theme';

type RootStackParamList = { IncidentReports: undefined; SecurityDashboard: undefined; AudioRecordings: { incidentId: number; security?: boolean } };
type Incident = { referenceNumber: string; typeLabel: string; status: string; rideReference: string; createdAt: string; hasAudio: boolean; recordingDuration?: number };
const audioExtension = (mime: string) => mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : mime.includes('mpeg') ? 'mp3' : mime.includes('wav') ? 'wav' : mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : 'audio';

export default function AudioRecordingsScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AudioRecordings'>>();
  const { showToast } = useToast();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const nativeSoundRef = useRef<Audio.Sound | null>(null);
  const focused = useRef(false);
  const openingRef = useRef(false);
  const downloadingRef = useRef(false);
  const securityRecording = route.params.security === true;
  const audioPath = `${securityRecording ? '/security/sos' : '/admin/incidents'}/${route.params.incidentId}/audio`;
  const recordingUrl = `${apiClient.defaults.baseURL || ''}${audioPath}`;

  const releasePlayer = useCallback(() => {
    playerRef.current?.pause();
    playerRef.current = null;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    void nativeSoundRef.current?.unloadAsync().catch(() => {});
    nativeSoundRef.current = null;
  }, []);

  const loadIncident = useCallback(async () => {
    setLoading(true);
    try {
      if (securityRecording) {
        const response = await apiClient.get('/security/sos');
        const alert = [...(response.data?.active || []), ...(response.data?.resolved || [])].find((item: any) => String(item.id) === String(route.params.incidentId));
        setIncident(alert ? { referenceNumber: alert.reference, typeLabel: 'SOS Alert', status: alert.status, rideReference: alert.rideReference, createdAt: alert.createdAt, hasAudio: alert.hasAudio, recordingDuration: alert.recordingDuration } : null);
      } else {
        const response = await apiClient.get(`/admin/incidents/${route.params.incidentId}`);
        setIncident(response.data);
      }
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load this recording');
    } finally { setLoading(false); }
  }, [route.params.incidentId, securityRecording]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    setPlaying(false);
    void loadIncident();
    return () => { focused.current = false; releasePlayer(); };
  }, [loadIncident, releasePlayer]));

  const openRecording = async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    try {
      if (nativeSoundRef.current) {
        const status = await nativeSoundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) await nativeSoundRef.current.pauseAsync();
          else await nativeSoundRef.current.playAsync();
          setPlaying(!status.isPlaying);
        }
        return;
      }
      if (playerRef.current) {
        if (playerRef.current.paused) { await playerRef.current.play(); setPlaying(true); }
        else { playerRef.current.pause(); setPlaying(false); }
        return;
      }
      if (Platform.OS !== 'web') {
        const token = await AsyncStorage.getItem('authToken');
        const { sound } = await Audio.Sound.createAsync(
          { uri: recordingUrl, headers: token ? { Authorization: `Bearer ${token}` } : undefined },
          { shouldPlay: false },
          (status) => {
            if (status.isLoaded && status.didJustFinish) { setPlaying(false); releasePlayer(); }
          },
        );
        if (!focused.current) { await sound.unloadAsync(); return; }
        nativeSoundRef.current = sound;
        await sound.playAsync();
      } else {
        const response = await apiClient.get(audioPath, { responseType: 'blob' });
        if (!focused.current) return;
        objectUrlRef.current = URL.createObjectURL(response.data);
        const player = new window.Audio(objectUrlRef.current);
        playerRef.current = player;
        player.onended = () => { setPlaying(false); releasePlayer(); };
        player.onerror = () => { setPlaying(false); releasePlayer(); showToast('Could not play this recording. Try downloading it.', 'red'); };
        await player.play();
      }
      setPlaying(true);
    } catch {
      releasePlayer();
      setPlaying(false);
      showToast('Could not play this recording. Please try again.', 'red');
    } finally { openingRef.current = false; setOpening(false); }
  };

  const downloadRecording = async () => {
    if (downloadingRef.current) return;
    downloadingRef.current = true;
    setDownloading(true);
    let temporaryFile: string | undefined;
    try {
      const baseName = `recording-${String(incident?.referenceNumber || route.params.incidentId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      if (Platform.OS === 'web') {
        const response = await apiClient.get(audioPath, { responseType: 'blob' });
        const blob: Blob = response.data;
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `${baseName}.${audioExtension(blob.type)}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } else {
        if (!FileSystem.cacheDirectory) throw new Error('File storage is unavailable');
        const token = await AsyncStorage.getItem('authToken');
        temporaryFile = `${FileSystem.cacheDirectory}${baseName}-${Date.now()}`;
        const result = await FileSystem.downloadAsync(recordingUrl, temporaryFile, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (result.status < 200 || result.status >= 300) throw new Error('Download failed');
        const mime = Object.entries(result.headers || {}).find(([key]) => key.toLowerCase() === 'content-type')?.[1] || 'application/octet-stream';
        const filename = `${baseName}.${audioExtension(mime)}`;
        if (Platform.OS === 'android') {
          const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!permission.granted) return;
          const destination = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, filename, mime);
          const contents = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
          await FileSystem.writeAsStringAsync(destination, contents, { encoding: FileSystem.EncodingType.Base64 });
          showToast('Recording downloaded.', 'green');
        } else {
          const namedFile = `${FileSystem.cacheDirectory}${filename}`;
          await FileSystem.moveAsync({ from: result.uri, to: namedFile });
          temporaryFile = namedFile;
          await Share.share({ url: namedFile, title: filename });
        }
      }
    } catch { showToast('Could not download this recording. Please try again.', 'red'); }
    finally {
      if (temporaryFile) await FileSystem.deleteAsync(temporaryFile, { idempotent: true }).catch(() => {});
      downloadingRef.current = false;
      setDownloading(false);
    }
  };

  return <View style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate(securityRecording ? 'SecurityDashboard' : 'IncidentReports')} accessibilityRole="button" accessibilityLabel="Back from recording"><ArrowLeft size={20} color={colors.greenDark} /><Text style={styles.backText}>Back</Text></TouchableOpacity>
      <Text style={styles.title}>Audio Recordings</Text>
    </View>
    <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={styles.content}>
      {loading ? <ActivityIndicator size="large" color={colors.green} style={styles.loader} /> : error ? <View style={styles.state}><TriangleAlert size={32} color={colors.red} /><Text style={styles.stateTitle}>Could not load recording</Text><Text style={styles.stateText}>{error}</Text><TouchableOpacity style={styles.retry} onPress={loadIncident}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : !incident?.hasAudio ? <View style={styles.state}><TriangleAlert size={32} color={colors.gray400} /><Text style={styles.stateTitle}>No audio evidence</Text><Text style={styles.stateText}>This incident does not have an audio recording.</Text></View> : <>
        <View style={styles.warning}><TriangleAlert size={17} color={colors.yellowText} /><Text style={styles.warningText}>Access is logged and auditable. Use only with authorisation.</Text></View>
        <View style={styles.recordingCard}>
          <View style={styles.iconCircle}><Headphones size={30} color={colors.blue} /></View>
          <Text style={styles.reference}>#{incident.referenceNumber}</Text>
          <Text style={styles.meta}>{incident.typeLabel}  ·  Ride #{incident.rideReference}</Text>
          <Text style={styles.meta}>{incident.status}  ·  {incident.recordingDuration ? `${incident.recordingDuration}s` : 'Duration unavailable'}</Text>
          <View style={styles.actionRow}><TouchableOpacity style={styles.playButton} onPress={openRecording} disabled={opening} accessibilityRole="button" accessibilityLabel={playing ? 'Pause recording' : 'Play recording'}>{playing ? <Pause size={18} color={colors.white} /> : <Play size={18} color={colors.white} />}<Text style={styles.playText}>{opening ? 'Loading...' : playing ? 'Pause' : 'Play'}</Text></TouchableOpacity><TouchableOpacity style={styles.downloadButton} onPress={downloadRecording} disabled={downloading} accessibilityRole="button" accessibilityLabel="Download recording"><ArrowDownToLine size={18} color={colors.gray800} /><Text style={styles.downloadText}>{downloading ? 'Downloading...' : 'Download'}</Text></TouchableOpacity></View>
        </View>
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.gray50 },
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
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.xl },
  playButton: { flexGrow: 1, flexBasis: 120, minHeight: 50, backgroundColor: colors.blue, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  downloadButton: { flexGrow: 1, flexBasis: 120, minHeight: 50, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  playText: { color: colors.white, fontFamily: font.bold, fontSize: 14 },
  downloadText: { color: colors.gray800, fontFamily: font.bold, fontSize: 14 },
  state: { alignItems: 'center', padding: spacing.xxxl, marginTop: spacing.xxxl },
  stateTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 16, marginTop: spacing.md },
  stateText: { color: colors.gray500, fontFamily: font.regular, fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
  retry: { backgroundColor: colors.green, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, marginTop: spacing.lg },
  retryText: { color: colors.white, fontFamily: font.bold, fontSize: 13 },
});
