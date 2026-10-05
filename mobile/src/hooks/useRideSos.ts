import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../services/ApiClient';
import { useToast } from '../components/Toast';

type Coordinate = { latitude: number; longitude: number };
const MAX_SECONDS = 60;

/** Uses the same ride SOS and evidence endpoints as the rider flow. */
export default function useRideSos(rideId: number) {
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [activated, setActivated] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [audioMessage, setAudioMessage] = useState('');
  const mounted = useRef(true);
  const sendingRef = useRef(false);
  const alertId = useRef<number | null>(null);
  const elapsed = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeRecording = useRef<Audio.Recording | null>(null);
  const webRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const uploadTask = useRef<Promise<void> | null>(null);
  const finishTask = useRef<Promise<void> | null>(null);
  const startTask = useRef<Promise<void> | null>(null);
  const closing = useRef(false);
  const audioWarningShown = useRef(false);

  const updateAudioMessage = (message: string) => {
    if (mounted.current) setAudioMessage(message);
  };

  const upload = async (form: FormData) => {
    form.append('duration', String(Math.max(1, Math.min(MAX_SECONDS, elapsed.current))));
    if (Platform.OS === 'web') {
      const token = await AsyncStorage.getItem('authToken');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`${apiClient.defaults.baseURL}/rides/${rideId}/sos/${alertId.current}/audio`, {
          method: 'PUT', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form, signal: controller.signal,
        });
        if (!response.ok) throw new Error('Audio upload failed');
      } finally { clearTimeout(timeout); }
    } else {
      await apiClient.put(`/rides/${rideId}/sos/${alertId.current}/audio`, form);
    }
  };

  const uploadPendingChunks = async () => {
    while (uploadTask.current) await uploadTask.current;
    if (!chunks.current.length || !alertId.current) return;
    const batch = chunks.current.splice(0);
    const task = (async () => {
      try {
        const form = new FormData();
        const mimeType = webRecorder.current?.mimeType || 'audio/webm';
        const extension = mimeType.startsWith('audio/mp4') ? 'm4a' : 'webm';
        form.append('audio', new Blob(batch, { type: mimeType }), `sos-${alertId.current}.${extension}`);
        await upload(form);
        updateAudioMessage('Audio evidence saved for Campus Security.');
      } catch {
        chunks.current.unshift(...batch);
        updateAudioMessage('Security has the SOS alert. Audio upload failed; it will retry while recording.');
        if (mounted.current && !audioWarningShown.current) {
          audioWarningShown.current = true;
          showToast('SOS was saved, but audio upload failed', 'yellow');
        }
      }
    })();
    uploadTask.current = task;
    await task;
    if (uploadTask.current === task) uploadTask.current = null;
  };

  const finishRecording = () => {
    if (finishTask.current) return finishTask.current;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    const task = (async () => {
      try {
        const recorder = webRecorder.current;
        if (recorder && recorder.state !== 'inactive') {
          await new Promise<void>(resolve => {
            recorder.onstop = () => resolve();
            recorder.stop();
          });
        }
        stream.current?.getTracks().forEach(track => track.stop());
        if (Platform.OS === 'web') {
          await uploadPendingChunks();
        } else if (nativeRecording.current) {
          const recordingInstance = nativeRecording.current;
          await recordingInstance.stopAndUnloadAsync();
          const uri = recordingInstance.getURI();
          if (uri && alertId.current) {
            const form = new FormData();
            form.append('audio', { uri, name: `sos-${alertId.current}.m4a`, type: 'audio/m4a' } as any);
            await upload(form);
            updateAudioMessage('Audio evidence saved for Campus Security.');
          }
        }
      } catch {
        updateAudioMessage('Security has the SOS alert, but audio evidence could not be saved.');
        if (mounted.current) showToast('SOS was saved, but audio upload failed', 'yellow');
      } finally {
        stream.current?.getTracks().forEach(track => track.stop());
        stream.current = null;
        webRecorder.current = null;
        nativeRecording.current = null;
        if (Platform.OS !== 'web') await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
        if (mounted.current) setRecording(false);
      }
    })();
    finishTask.current = task;
    return task;
  };

  const startRecording = async () => {
    if (Platform.OS === 'web') {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Microphone unavailable');
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || closing.current) { microphone.getTracks().forEach(track => track.stop()); return; }
      stream.current = microphone;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(microphone, mimeType ? { mimeType, audioBitsPerSecond: 24000 } : undefined);
      recorder.ondataavailable = event => { if (event.data.size > 0) chunks.current.push(event.data); };
      webRecorder.current = recorder;
      recorder.start(1000);
    } else {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Microphone permission denied');
      if (!mounted.current || closing.current) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recordingInstance = new Audio.Recording();
      nativeRecording.current = recordingInstance;
      await recordingInstance.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
      if (!mounted.current || closing.current) {
        await recordingInstance.stopAndUnloadAsync();
        nativeRecording.current = null;
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        return;
      }
      await recordingInstance.startAsync();
    }
    if (!mounted.current || closing.current) { await finishRecording(); return; }
    setRecording(true);
    updateAudioMessage('Recording in progress...');
    timer.current = setInterval(() => {
      elapsed.current = Math.min(MAX_SECONDS, elapsed.current + 1);
      if (mounted.current) setSeconds(elapsed.current);
      if (elapsed.current >= MAX_SECONDS) void finishRecording();
      else if (Platform.OS === 'web' && elapsed.current % 5 === 0) void uploadPendingChunks();
    }, 1000);
  };

  const confirm = async () => {
    if (sendingRef.current || alertId.current) return;
    sendingRef.current = true;
    closing.current = false;
    finishTask.current = null;
    audioWarningShown.current = false;
    setSending(true);
    setError('');
    try {
      let coordinates: Coordinate | null = null;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const position = await Promise.race([
          (async () => {
            if (Platform.OS !== 'web') {
              const permission = await Location.requestForegroundPermissionsAsync();
              if (permission.status !== 'granted') throw new Error('Location permission denied');
            }
            return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          })(),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('GPS timeout')), 8000); }),
        ]);
        coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      } catch { /* Deliver the alert without inventing a live GPS location. */ }
      finally { if (timeout) clearTimeout(timeout); }
      const response = await apiClient.post(`/rides/${rideId}/sos`, coordinates ? { gpsLat: coordinates.latitude, gpsLng: coordinates.longitude } : {});
      if (!response.data.alertId) throw new Error('The server did not confirm an SOS alert');
      alertId.current = response.data.alertId;
      if (!mounted.current) return;
      setLocation(coordinates);
      setActivated(true);
      showToast('SOS alert dispatched.', 'red');
      elapsed.current = 0;
      setSeconds(0);
      chunks.current = [];
      startTask.current = startRecording();
      try { await startTask.current; }
      catch {
        stream.current?.getTracks().forEach(track => track.stop());
        await finishRecording();
        updateAudioMessage('Campus Security has been alerted. Microphone access is unavailable, so audio could not be recorded.');
      }
    } catch (requestError: any) {
      if (mounted.current) setError(requestError?.response?.data?.error || 'Could not send SOS alert. Please try again.');
    } finally {
      sendingRef.current = false;
      if (mounted.current) setSending(false);
    }
  };

  const close = async () => {
    closing.current = true;
    // A pending permission prompt must not block returning to the ride.
    // startRecording releases any stream that arrives after closing.
    await finishRecording();
    alertId.current = null;
    startTask.current = null;
    finishTask.current = null;
    chunks.current = [];
    if (mounted.current) {
      setActivated(false);
      setAudioMessage('');
      setError('');
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; closing.current = true; void finishRecording(); };
  }, []);

  return { sending, activated, seconds, location, recording, error, audioMessage, confirm, close };
}
