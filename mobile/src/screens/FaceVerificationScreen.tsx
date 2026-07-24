import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import CameraView from 'expo-camera/build/CameraView';
import { useCameraPermissions } from 'expo-camera';
import { Camera as CameraIcon, UserCircle2, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react-native';
import Button from '../components/Button';
import BottomSheetModal from '../components/BottomSheetModal';
import { colors, radius, spacing, font } from '../theme/theme';
import apiClient from '../services/ApiClient';

type RootStackParamList = {
  FaceVerification: {
    nextScreen?: keyof RootStackParamList;
    fullName?: string;
    email?: string;
  } | undefined;
  Login: undefined;
  Home: undefined;
  DriverDashboard: undefined;
};

type Status = 'permission' | 'ready' | 'capturing' | 'verifying' | 'result';

const RING_SIZE = 240;

export default function FaceVerificationScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'FaceVerification'>>();
  const nextScreen = route.params?.nextScreen ?? 'Home';
  const fullName = route.params?.fullName;
  const email = route.params?.email;
  const firstName = fullName?.trim().split(' ')[0];

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [status, setStatus] = useState<Status>('ready');
  const [resultSuccess, setResultSuccess] = useState<boolean | null>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [resultModalVisible, setResultModalVisible] = useState(false);

  const spin1 = useRef(new Animated.Value(0)).current;
  const spin2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const isBusy = status === 'capturing' || status === 'verifying';
    let loop1: Animated.CompositeAnimation | null = null;
    let loop2: Animated.CompositeAnimation | null = null;

    if (isBusy) {
      loop1 = Animated.loop(
        Animated.timing(spin1, { toValue: 1, duration: 2000, useNativeDriver: true })
      );
      loop2 = Animated.loop(
        Animated.timing(spin2, { toValue: 1, duration: 3000, useNativeDriver: true })
      );
      loop1.start();
      loop2.start();
    }
    return () => {
      loop1?.stop();
      loop2?.stop();
    };
  }, [status]);

  const rotate1 = spin1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotate2 = spin2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      setStatus('capturing');
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setStatus('verifying');
      await verifyFace(photo.uri);
    } catch (err) {
      setStatus('ready');
      Alert.alert('Camera error', 'Could not capture a photo. Please try again.');
    }
  };

  const verifyFace = async (uri: string) => {
    try {
      const formData = new FormData();
      formData.append('selfie', {
        uri,
        name: 'face-verification.jpg',
        type: 'image/jpeg',
      } as any);

      // Right after registration there's no auth token yet, so we identify
      // the account by email instead. If your backend issues a token at
      // registration and this screen runs post-login instead, this field
      // becomes redundant — the backend can identify the user from the
      // Authorization header on the apiClient request instead.
      if (email) {
        formData.append('email', email);
      }

      // Assumed contract — adjust to match your backend:
      // POST /verification/face  ->  { success: boolean, confidence: number, message?: string }
      const response = await apiClient.post('/verification/face', formData);

      const { success, confidence: conf, message } = response.data;
      setConfidence(typeof conf === 'number' ? conf : null);
      setResultSuccess(!!success);
      setResultMessage(
        message ||
          (success
            ? 'Your identity has been verified successfully.'
            : 'We could not verify your face. Please try again in good lighting.')
      );
      setStatus('result');
      setResultModalVisible(true);
    } catch (error: any) {
      setResultSuccess(false);
      setConfidence(null);
      setResultMessage(
        error?.response?.data?.error ||
          'Verification failed. Check your connection and try again.'
      );
      setStatus('result');
      setResultModalVisible(true);
    }
  };

  const handleContinue = () => {
    setResultModalVisible(false);
    navigation.replace(nextScreen as any);
  };

  const handleRetry = () => {
    setResultModalVisible(false);
    setStatus('ready');
  };

  // --- Permission not yet determined ---
  if (!permission) {
    return <View style={styles.container} />;
  }

  // --- Permission denied ---
  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.permissionIconCircle}>
          <CameraIcon size={36} color={colors.green} strokeWidth={1.8} />
        </View>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionSubtitle}>
          We need your camera to verify it's really you before every trip. Your photo is only
          used for identity verification.
        </Text>
        {permission.canAskAgain ? (
          <Button label="Grant Camera Access" onPress={requestPermission} icon={<CameraIcon size={18} color={colors.white} strokeWidth={2} />} />
        ) : (
          <Button
            label="Open Settings"
            onPress={() => Linking.openSettings()}
            icon={<CameraIcon size={18} color={colors.white} strokeWidth={2} />}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <Text style={styles.title}>Face Verification</Text>
        <Text style={styles.subtitle}>
          {status === 'verifying'
            ? 'Verifying your identity...'
            : status === 'capturing'
            ? 'Hold still...'
            : firstName
            ? `Hi ${firstName}, let's confirm it's really you`
            : 'Position your face in the frame'}
        </Text>
      </View>

      <View style={styles.scanArea}>
        <View style={styles.ringWrap}>
          {(status === 'capturing' || status === 'verifying') && (
            <>
              <Animated.View
                style={[styles.ring, styles.ring1, { transform: [{ rotate: rotate1 }] }]}
              />
              <Animated.View
                style={[styles.ring, styles.ring2, { transform: [{ rotate: rotate2 }] }]}
              />
            </>
          )}

          <View style={styles.cameraCircle}>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
            {status === 'verifying' && (
              <View style={styles.verifyingOverlay}>
                <ShieldCheck size={32} color={colors.white} strokeWidth={1.8} />
              </View>
            )}
          </View>

          {/* Corner brackets, purely decorative framing guide */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        <View style={styles.instructionBox}>
          <UserCircle2 size={16} color={colors.gray500} strokeWidth={1.8} />
          <Text style={styles.instructionText}>
            Look directly at the camera in a well-lit area
          </Text>
        </View>

        <Button
          label={status === 'verifying' ? 'Verifying...' : 'Capture & Verify'}
          onPress={handleCapture}
          loading={status === 'capturing' || status === 'verifying'}
          disabled={status === 'capturing' || status === 'verifying'}
          icon={<CameraIcon size={18} color={colors.white} strokeWidth={2} />}
        />
      </View>

      {/* RESULT MODAL */}
      <BottomSheetModal
        visible={resultModalVisible}
        onClose={() => setResultModalVisible(false)}
        title={resultSuccess ? 'Verified' : 'Result'}
      >
        <View style={styles.resultContent}>
          {resultSuccess ? (
            <CheckCircle2 size={56} color={colors.green} strokeWidth={1.5} />
          ) : (
            <XCircle size={56} color={colors.red} strokeWidth={1.5} />
          )}
          <Text style={styles.resultTitle}>
            {resultSuccess ? 'Identity Verified' : 'Verification Failed'}
          </Text>
          <Text style={styles.resultMessage}>{resultMessage}</Text>
          {confidence !== null && (
            <Text style={styles.confidenceText}>Match confidence: {confidence}%</Text>
          )}
          <Button
            label={
              resultSuccess
                ? nextScreen === 'Login'
                  ? 'Continue to Login'
                  : 'Continue'
                : 'Try Again'
            }
            onPress={resultSuccess ? handleContinue : handleRetry}
            style={[{ marginTop: spacing.lg }, resultSuccess ? styles.greenButton : styles.redButton]}
          />
        </View>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  header: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xxxl, paddingBottom: spacing.lg },
  title: { fontFamily: font.extrabold, fontSize: 24, fontWeight: '800', color: colors.gray900 },
  subtitle: { fontFamily: font.regular, fontSize: 14, color: colors.gray500, marginTop: 2 },

  scanArea: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xxl, paddingTop: spacing.lg },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  ring: {
    position: 'absolute',
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ring1: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderTopColor: colors.green,
    borderRightColor: colors.green,
  },
  ring2: {
    width: RING_SIZE - 20,
    height: RING_SIZE - 20,
    borderBottomColor: colors.blue,
    borderLeftColor: colors.blue,
  },
  cameraCircle: {
    width: RING_SIZE - 60,
    height: RING_SIZE - 60,
    borderRadius: (RING_SIZE - 60) / 2,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
  },
  verifyingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(34,197,94,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenButton: {
    backgroundColor: colors.green,
  },
  redButton: {
    backgroundColor: colors.red,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: colors.green,
  },
  cornerTL: { top: 30, left: 30, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cornerTR: { top: 30, right: 30, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cornerBL: { bottom: 30, left: 30, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 30, right: 30, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },

  instructionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: spacing.xl,
    width: '100%',
  },
  instructionText: { fontFamily: font.regular, fontSize: 13, color: colors.gray600, flex: 1 },

  permissionIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  permissionTitle: { fontFamily: font.bold, fontSize: 18, fontWeight: '700', color: colors.gray900, marginBottom: 8 },
  permissionSubtitle: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 20,
  },

  resultContent: { alignItems: 'center', paddingTop: 4 },
  resultTitle: { fontFamily: font.extrabold, fontSize: 20, fontWeight: '800', color: colors.gray900, marginTop: spacing.md },
  resultMessage: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  confidenceText: { fontFamily: font.mono, fontSize: 13, color: colors.gray600, marginTop: 8 },
});