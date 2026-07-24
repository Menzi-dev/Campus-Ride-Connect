import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
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
  Easing,
  StatusBar,
  Image,
  Linking,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import CameraView from 'expo-camera/build/CameraView';
import { useCameraPermissions } from 'expo-camera';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  Hash,
  GraduationCap,
  Car,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  Check,
  HeartPulse,
  CloudUpload,
  FileCheck2,
  Camera as CameraIcon,
  RotateCcw,
  CheckCircle2,
  MoveUp,
  MoveDown,
  MoveLeft,
  MoveRight,
  Circle,
  AlertCircle,
} from 'lucide-react-native';
import Button from '../components/Button';
import BottomSheetModal from '../components/BottomSheetModal';
import { useToast } from '../components/Toast';
import { colors, radius, spacing, font } from '../theme/theme';
import apiClient from '../services/ApiClient';
import { LinearGradient } from 'expo-linear-gradient';

type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  CreateAccount: undefined;
  Home: undefined;
};

type Role = 'RIDER' | 'DRIVER';
type YearOption = { label: string; value: number };
type Direction = 'center' | 'left' | 'right' | 'up' | 'down';

interface FaceVerificationStep {
  direction: Direction;
  label: string;
  icon: React.ReactNode | null;
  completed: boolean;
}

const YEAR_OPTIONS: YearOption[] = [
  { label: '1st Year', value: 1 },
  { label: '2nd Year', value: 2 },
  { label: '3rd Year', value: 3 },
  { label: '4th Year', value: 4 },
  { label: 'Postgraduate', value: 5 },
];

const TOTAL_STEPS = 4;
const CAMPUS_EMAIL_DOMAIN = '@spu.ac.za';
const MAX_ATTEMPTS_PER_STEP = 3;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * BACKEND CONTRACT for face verification (implement server-side):
 *
 * POST /auth/face/verify-direction   (multipart/form-data)
 *   fields: direction ('center'|'left'|'right'|'up'|'down'), image (jpg)
 *   response: { success: boolean, message?: string }
 *   The server should run real face/head-pose detection (e.g. ML Kit,
 *   MediaPipe, or a hosted vision API) against the uploaded frame and
 *   confirm the detected yaw/pitch actually matches the requested
 *   direction. Returning success:true unconditionally defeats the
 *   purpose of liveness checking.
 *
 * The final "center" selfie captured after all steps pass is the one
 * sent along with account registration as the profile/identity photo.
 */

export default function CreateAccountScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [step, setStep] = useState(1);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [step]);

  // Step 1 — Personal Info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState<YearOption | null>(null);
  const [yearSheetVisible, setYearSheetVisible] = useState(false);

  // Step 2 — Role & Documents
  const [role, setRole] = useState<Role>('RIDER');
  const [licencePlate, setLicencePlate] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [proofDoc, setProofDoc] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [licenceDoc, setLicenceDoc] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [vehicleDoc, setVehicleDoc] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  // Step 3 — Security
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Step 4 — Face Verification
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [hasRequestedCameraPermission, setHasRequestedCameraPermission] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Live session state
  const [scanActive, setScanActive] = useState(false); // a verification session is in progress
  const [verifying, setVerifying] = useState(false); // waiting on backend response for the current capture
  const [stepError, setStepError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const [currentDirection, setCurrentDirection] = useState<Direction>('center');
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [verificationSteps, setVerificationSteps] = useState<FaceVerificationStep[]>([
    { direction: 'center', label: 'Center', icon: <Circle size={20} color={colors.white} />, completed: false },
    { direction: 'left', label: 'Left', icon: <MoveLeft size={20} color={colors.white} />, completed: false },
    { direction: 'right', label: 'Right', icon: <MoveRight size={20} color={colors.white} />, completed: false },
    { direction: 'up', label: 'Up', icon: <MoveUp size={20} color={colors.white} />, completed: false },
    { direction: 'down', label: 'Down', icon: <MoveDown size={20} color={colors.white} />, completed: false },
  ]);
  const [directionIndex, setDirectionIndex] = useState(0);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const pickDocument = async (setter: (a: DocumentPicker.DocumentPickerAsset) => void) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setter(result.assets[0]);
        showToast('Document selected', 'green');
      }
    } catch (err) {
      showToast('Could not open document picker', 'red');
    }
  };

  // ---- Face verification flow -------------------------------------------

  const startFaceVerification = () => {
    setVerificationProgress(0);
    setDirectionIndex(0);
    setSelfieUri(null);
    setIsComplete(false);
    setStepError(null);
    setAttempts(0);
    setVerificationSteps((steps) => steps.map((s) => ({ ...s, completed: false })));
    setCurrentDirection(verificationSteps[0].direction);
    setScanActive(true);
    progressAnim.setValue(0);

    pulseLoopRef.current?.stop();
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoopRef.current.start();
  };

  const handleCameraReady = () => {
    setCameraReady(true);
  };

  const triggerFlash = () => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  const markStepComplete = (direction: Direction) => {
    setVerificationSteps((steps) => steps.map((s) => (s.direction === direction ? { ...s, completed: true } : s)));

    const completedCount = verificationSteps.filter((s) => s.completed).length + 1;
    const progress = (completedCount / verificationSteps.length) * 100;
    setVerificationProgress(progress);

    Animated.timing(progressAnim, {
      toValue: progress / 100,
      duration: 450,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();

    const nextIndex = directionIndex + 1;
    if (nextIndex < verificationSteps.length) {
      setDirectionIndex(nextIndex);
      setCurrentDirection(verificationSteps[nextIndex].direction);
      setAttempts(0);
      setStepError(null);
    } else {
      // All directional checks passed — take the final confirmation selfie.
      setScanActive(false);
      pulseLoopRef.current?.stop();
      captureFinalSelfie();
    }
  };

  const captureAndVerifyDirection = async () => {
    if (!cameraRef.current || !cameraReady || verifying) {
      if (!cameraReady) {
        setStepError('Camera is still warming up. Please wait a moment then try again.');
      }
      return;
    }
    setStepError(null);
    setVerifying(true);

    const direction = verificationSteps[directionIndex].direction;

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true });
      triggerFlash();

      // Convert Expo image URI to blob for multipart upload
      const response = await fetch(photo.uri);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('direction', direction);
      formData.append('image', blob, `face-${direction}-${Date.now()}.jpg`);

      const apiResponse = await apiClient.post('/auth/face/verify-direction', formData);

      const passed = apiResponse.data?.success === true;

      if (!passed) {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        if (nextAttempts >= MAX_ATTEMPTS_PER_STEP) {
          showToast("Too many failed attempts — let's start over", 'red');
          resetVerification();
        } else {
          setStepError(
            apiResponse.data?.message ||
              `We couldn't confirm you looking ${verificationSteps[directionIndex].label.toLowerCase()}. Try again.`
          );
        }
        return;
      }

      setAttempts(0);
      if (direction === 'center' && directionIndex === 0) {
        setSelfieUri(photo.uri);
      }
      markStepComplete(direction);
    } catch (err: any) {
      console.error('Face verification error:', err);
      const message =
        err?.message === 'Network Error'
          ? 'Cannot reach the server. Check your connection.'
          : err?.response?.data?.error ||
            err?.response?.data?.message ||
            'Could not verify that photo. Please try again.';
      setStepError(message);
    } finally {
      setVerifying(false);
    }
  };

  const captureFinalSelfie = async () => {
    if (!cameraRef.current) return;
    setVerifying(true);
    setStepError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      triggerFlash();
      setSelfieUri(photo.uri);
      setIsComplete(true);
      showToast('Face verification complete!', 'green');
    } catch (err) {
      setStepError('Could not capture the final photo. Please try again.');
      setScanActive(true); // let them retry the final capture
    } finally {
      setVerifying(false);
    }
  };

  const resetVerification = () => {
    setVerificationProgress(0);
    setDirectionIndex(0);
    setCurrentDirection('center');
    setSelfieUri(null);
    setIsComplete(false);
    setStepError(null);
    setAttempts(0);
    setScanActive(false);
    setVerifying(false);
    setVerificationSteps((steps) => steps.map((s) => ({ ...s, completed: false })));
    progressAnim.setValue(0);
    pulseAnim.setValue(1);
    pulseLoopRef.current?.stop();
  };

  useEffect(() => {
    return () => {
      pulseLoopRef.current?.stop();
    };
  }, []);

  // ---- misc ---------------------------------------------------------------

  const getPasswordStrength = (val: string) => {
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    return score;
  };

  const strengthMeta = [
    { label: '', color: colors.gray200 },
    { label: 'Weak', color: colors.red },
    { label: 'Fair', color: colors.orange },
    { label: 'Good', color: colors.blue },
    { label: 'Strong', color: colors.green },
  ];
  const strength = getPasswordStrength(password);

  const validateStep1 = (): string | null => {
    if (!fullName.trim()) return 'Please enter your full name';
    const trimmedEmail = email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) return 'Please enter a valid university email';
    if (!trimmedEmail.toLowerCase().endsWith(CAMPUS_EMAIL_DOMAIN)) {
      return `Please use your campus email (${CAMPUS_EMAIL_DOMAIN})`;
    }
    if (!studentNumber.trim()) return 'Please enter your student number';
    if (!yearOfStudy) return 'Please select your year of study';
    if (!phone.trim()) return 'Please enter your phone number';
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!proofDoc) return 'Please upload your Proof of Registration';
    if (role === 'DRIVER') {
      if (!licenceDoc) return "Please upload your Driver's Licence";
      if (!vehicleDoc) return 'Please upload your Vehicle Registration';
      if (!licencePlate.trim()) return 'Please enter your licence plate';
    }
    return null;
  };

  const validateStep3 = (): string | null => {
    if (!password || password.length < 8) return 'Password must be at least 8 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    if (!emergencyContact.trim()) return 'Please add an emergency contact';
    if (!agreeTerms) return 'Please agree to the Terms of Service';
    return null;
  };

  const goNext = () => {
    if (step === 1) {
      const err = validateStep1();
      if (err) return showToast(err, 'red');
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) return showToast(err, 'red');
    }
    if (step === 3) {
      const err = validateStep3();
      if (err) return showToast(err, 'red');
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goBack = () => {
    if (step === 1) {
      navigation.goBack();
      return;
    }
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleRequestPermission = async () => {
    try {
      setHasRequestedCameraPermission(true);
      const result = await requestPermission();
      if (!result.granted) {
        showToast(
          result.canAskAgain
            ? 'Camera permission is required to verify your identity'
            : 'Camera permission denied — enable it in Settings',
          'red'
        );
      }
    } catch (err) {
      showToast('Could not request camera permission', 'red');
    }
  };

  useEffect(() => {
    if (step === 4 && !hasRequestedCameraPermission) {
      handleRequestPermission();
    }
  }, [step, hasRequestedCameraPermission]);

  const handleFinalSubmit = async () => {
    if (!selfieUri) {
      showToast('Please complete face verification first', 'red');
      return;
    }

    if (!isComplete) {
      showToast('Please complete all face verification steps', 'red');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('fullName', fullName.trim());
      formData.append('email', email.trim().toLowerCase());
      formData.append('password', password);
      formData.append('role', role);

      if (yearOfStudy) {
        formData.append('yearOfStudy', String(yearOfStudy.value));
      }
      if (emergencyContact.trim()) {
        formData.append('emergencyContact', emergencyContact.trim());
      }
      if (studentNumber.trim()) {
        formData.append('studentNumber', studentNumber.trim());
      }
      if (phone.trim()) {
        formData.append('phone', phone.trim());
      }

      if (role === 'DRIVER') {
        if (licencePlate.trim()) {
          formData.append('licencePlate', licencePlate.trim());
        }
        if (vehicleMake.trim()) {
          formData.append('vehicleMake', vehicleMake.trim());
        }
        if (vehicleYear) {
          formData.append('vehicleYear', vehicleYear);
        }
      }

      // Convert selfie URI to blob for upload
      try {
        const selfieResponse = await fetch(selfieUri);
        if (!selfieResponse.ok) throw new Error(`Failed to load selfie (${selfieResponse.status})`);
        const selfieBlob = await selfieResponse.blob();
        formData.append('selfie', selfieBlob, 'face-verification.jpg');
      } catch (err: any) {
        throw new Error(`Selfie upload error: ${err.message}`);
      }

      // Convert proof document if present
      if (proofDoc) {
        try {
          const proofResponse = await fetch(proofDoc.uri);
          if (!proofResponse.ok) throw new Error(`Failed to load proof document (${proofResponse.status})`);
          const proofBlob = await proofResponse.blob();
          formData.append('proofOfRegistration', proofBlob, proofDoc.name);
        } catch (err: any) {
          throw new Error(`Proof document error: ${err.message}`);
        }
      }

      // Convert driver licence if present
      if (role === 'DRIVER' && licenceDoc) {
        try {
          const licenceResponse = await fetch(licenceDoc.uri);
          if (!licenceResponse.ok) throw new Error(`Failed to load licence document (${licenceResponse.status})`);
          const licenceBlob = await licenceResponse.blob();
          formData.append('driverLicence', licenceBlob, licenceDoc.name);
        } catch (err: any) {
          throw new Error(`Licence document error: ${err.message}`);
        }
      }

      // Convert vehicle registration if present
      if (role === 'DRIVER' && vehicleDoc) {
        try {
          const vehicleResponse = await fetch(vehicleDoc.uri);
          if (!vehicleResponse.ok) throw new Error(`Failed to load vehicle document (${vehicleResponse.status})`);
          const vehicleBlob = await vehicleResponse.blob();
          formData.append('vehicleRegistration', vehicleBlob, vehicleDoc.name);
        } catch (err: any) {
          throw new Error(`Vehicle document error: ${err.message}`);
        }
      }

      console.log('Submitting registration with form data keys:', Array.from(formData.keys()));
      const response = await apiClient.post('/auth/register', formData);

      console.log('Registration response:', response.data);

      if (response.data?.success === false) {
        showToast(response.data?.message || 'Registration failed', 'red');
        return;
      }

      if (response.data?.token) {
        await AsyncStorage.setItem('authToken', response.data.token);
      }
      if (response.data?.user) {
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      }

      showToast('Account created and verified!', 'green');
      setTimeout(() => {
        navigation.replace(response.data?.token ? 'Home' : 'Login');
      }, 600);
    } catch (error: any) {
      console.error('Registration error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        fullError: error
      });
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        (error?.message === 'Network Error'
          ? 'Cannot reach the server. Check your connection.'
          : 'Something went wrong. Please try again.');
      showToast(message, 'red');
    } finally {
      setLoading(false);
    }
  };

  const renderFaceVerification = () => {
    if (!permission) {
      return <View style={styles.cameraPlaceholder} />;
    }

    if (!permission.granted) {
      return (
        <View style={styles.permissionBox}>
          <View style={styles.permissionIcon}>
            <CameraIcon size={32} color={colors.green} strokeWidth={1.5} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionSubtitle}>
            We need camera access to verify your identity securely
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity style={styles.permissionButton} onPress={handleRequestPermission}>
              <Text style={styles.permissionButtonText}>Grant Access</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.permissionButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.permissionButtonText}>Open Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    if (isComplete && selfieUri) {
      return (
        <View style={styles.completeContainer}>
          <View style={styles.completeIconRing}>
            <CheckCircle2 size={56} color={colors.green} strokeWidth={1.5} />
          </View>
          <Text style={styles.completeTitle}>Verification Complete!</Text>
          <Text style={styles.completeSubtitle}>All face checks passed successfully</Text>
          <View style={styles.completePreview}>
            <Image source={{ uri: selfieUri }} style={styles.completeImage} />
          </View>
        </View>
      );
    }

    const activeStep = verificationSteps[directionIndex];

    return (
      <View style={styles.verificationContainer}>
        <View style={styles.cameraWrapper}>
          <View style={styles.cameraFrame}>
            <CameraView ref={cameraRef} style={styles.cameraView} facing="front" onCameraReady={handleCameraReady} />

            <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={styles.overlayTop} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={styles.overlayBottom} />

            <Animated.View
              style={[
                styles.faceGuide,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <View
                style={[
                  styles.faceGuideInner,
                  activeStep?.completed && styles.faceGuideInnerComplete,
                ]}
              >
                <View style={styles.guideCircle} />
              </View>
            </Animated.View>

            {scanActive && !isComplete && (
              <View style={styles.directionOverlay}>
                <View style={styles.directionBadge}>
                  <View style={styles.directionIcon}>{activeStep?.icon}</View>
                  <Text style={styles.directionLabel}>Look {activeStep?.label}</Text>
                </View>
              </View>
            )}

            <View style={styles.statusIndicator}>
              <View style={styles.statusDot}>
                <Animated.View style={[styles.statusPulse, { opacity: scanActive ? 1 : 0 }]} />
              </View>
              <Text style={styles.statusText}>
                {verifying ? 'Checking…' : scanActive ? 'Ready' : 'Idle'}
              </Text>
            </View>

            {verifying && (
              <View style={styles.verifyingOverlay}>
                <ActivityIndicator color={colors.white} size="small" />
                <Text style={styles.verifyingText}>Verifying photo…</Text>
              </View>
            )}

            <Animated.View pointerEvents="none" style={[styles.flashOverlay, { opacity: flashAnim }]} />
          </View>
        </View>

        {stepError && (
          <View style={styles.errorBanner}>
            <AlertCircle size={15} color={colors.red} strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorText}>{stepError}</Text>
              {attempts > 0 && (
                <Text style={styles.attemptsText}>
                  Attempt {attempts} of {MAX_ATTEMPTS_PER_STEP}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Verification Progress</Text>
            <Text style={styles.progressPercent}>{Math.round(verificationProgress)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>

        {/* Steps */}
        <View style={styles.stepsContainer}>
          {verificationSteps.map((s, index) => (
            <View key={index} style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  s.completed && styles.stepCircleComplete,
                  index === directionIndex && !s.completed && scanActive && styles.stepCircleActive,
                ]}
              >
                {s.completed ? (
                  <Check size={14} color={colors.white} strokeWidth={3} />
                ) : (
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.stepLabel, s.completed && styles.stepLabelComplete]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          {!scanActive && !isComplete && (
            <TouchableOpacity style={styles.startButton} onPress={startFaceVerification} activeOpacity={0.85}>
              <LinearGradient
                colors={['#4CAF50', '#2E7D32']}
                style={styles.startButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <CameraIcon size={20} color={colors.white} strokeWidth={2} />
                <Text style={styles.startButtonText}>Start Verification</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {scanActive && !isComplete && (
            <View style={styles.captureRow}>
              <TouchableOpacity
                style={[styles.captureButton, verifying && styles.captureButtonDisabled]}
                onPress={captureAndVerifyDirection}
                disabled={verifying}
                activeOpacity={0.8}
              >
                {verifying ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <CameraIcon size={24} color={colors.white} strokeWidth={2} />
                )}
              </TouchableOpacity>
              <Text style={styles.captureHint}>
                {verifying ? 'Hold still…' : `Tap to capture — Look ${activeStep?.label}`}
              </Text>
              <TouchableOpacity style={styles.resetButton} onPress={resetVerification} disabled={verifying}>
                <RotateCcw size={16} color={colors.gray600} strokeWidth={2} />
                <Text style={styles.resetButtonText}>Start over</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <View style={[styles.blob, styles.blobGreen]} pointerEvents="none" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={true}
        overScrollMode="always"
        nestedScrollEnabled={true}
      >
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity
            onPress={goBack}
            style={styles.backRow}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={loading}
          >
            <ArrowLeft size={14} color={colors.green} strokeWidth={2.2} />
            <Text style={styles.backText}>{step === 1 ? 'Back to Login' : 'Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join CampusConnect today</Text>
        </View>

        <View style={styles.stepRow}>
          <StepDot index={1} current={step} icon={<User size={10} color={step === 1 ? colors.white : colors.gray500} strokeWidth={2.4} />} />
          <View style={[styles.stepLine, step > 1 && styles.stepLineDone]} />
          <StepDot index={2} current={step} label="2" />
          <View style={[styles.stepLine, step > 2 && styles.stepLineDone]} />
          <StepDot index={3} current={step} label="3" />
          <View style={[styles.stepLine, step > 3 && styles.stepLineDone]} />
          <StepDot index={4} current={step} icon={<CameraIcon size={10} color={step === 4 ? colors.white : colors.gray500} strokeWidth={2.4} />} />
        </View>
        <View style={styles.stepLabels}>
          <Text style={styles.stepLabelText}>Personal</Text>
          <Text style={styles.stepLabelText}>Role &amp; Docs</Text>
          <Text style={styles.stepLabelText}>Security</Text>
          <Text style={styles.stepLabelText}>Verify Face</Text>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          {step === 1 && (
            <View>
              <Field label="Full Name" icon={<User size={16} color={colors.gray400} strokeWidth={1.8} />}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Menzi Sigwebela"
                  placeholderTextColor={colors.gray400}
                  value={fullName}
                  onChangeText={setFullName}
                  editable={!loading}
                  returnKeyType="next"
                />
              </Field>

              <Field label="University Email" icon={<Mail size={16} color={colors.gray400} strokeWidth={1.8} />}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="yourname@spu.ac.za"
                  placeholderTextColor={colors.gray400}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!loading}
                  returnKeyType="next"
                />
              </Field>
              <Text style={styles.hintText}>Must use your official university email</Text>

              <Field label="Student Number" icon={<Hash size={16} color={colors.gray400} strokeWidth={1.8} />}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="STU-12345"
                  placeholderTextColor={colors.gray400}
                  value={studentNumber}
                  onChangeText={setStudentNumber}
                  autoCapitalize="characters"
                  editable={!loading}
                  returnKeyType="next"
                />
              </Field>

              <Text style={styles.inputLabel}>Year of Study</Text>
              <TouchableOpacity
                style={styles.pickerField}
                onPress={() => setYearSheetVisible(true)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <View style={styles.pickerFieldLeft}>
                  <GraduationCap size={16} color={colors.green} strokeWidth={2} />
                  <Text style={styles.pickerFieldText}>{yearOfStudy ? yearOfStudy.label : 'Select year'}</Text>
                </View>
                <ChevronDown size={16} color={colors.gray400} strokeWidth={2} />
              </TouchableOpacity>

              <Field label="Phone Number" icon={<Phone size={16} color={colors.gray400} strokeWidth={1.8} />}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="+27 82 000 0000"
                  placeholderTextColor={colors.gray400}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!loading}
                  returnKeyType="done"
                />
              </Field>

              <Button
                label="Continue"
                onPress={goNext}
                icon={<ArrowRight size={16} color={colors.white} strokeWidth={2} />}
                style={[styles.continueButton, { marginTop: 4 }]}
              />
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.inputLabel}>I want to register as</Text>
              <View style={styles.roleGrid}>
                <RoleCard
                  active={role === 'RIDER'}
                  icon={<User size={17} color={colors.green} strokeWidth={2} />}
                  title="Rider"
                  desc="Book campus rides"
                  onPress={() => setRole('RIDER')}
                />
                <RoleCard
                  active={role === 'DRIVER'}
                  icon={<Car size={17} color={colors.blue} strokeWidth={2} />}
                  title="Driver"
                  desc="Offer rides and earn"
                  onPress={() => setRole('DRIVER')}
                />
              </View>

              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Proof of Registration</Text>
              <UploadZone file={proofDoc} onPress={() => pickDocument(setProofDoc)} />

              {role === 'DRIVER' && (
                <View>
                  <Text style={[styles.inputLabel, { marginTop: 8 }]}>Driver&apos;s Licence</Text>
                  <UploadZone file={licenceDoc} onPress={() => pickDocument(setLicenceDoc)} />

                  <Text style={[styles.inputLabel, { marginTop: 8 }]}>Vehicle Registration</Text>
                  <UploadZone file={vehicleDoc} onPress={() => pickDocument(setVehicleDoc)} />

                  <Field label="Licence Plate" icon={<Car size={16} color={colors.gray400} strokeWidth={1.8} />}>
                    <TextInput
                      style={[styles.fieldInput, styles.plateInput]}
                      placeholder="e.g. CA 482-901"
                      placeholderTextColor={colors.gray400}
                      value={licencePlate}
                      onChangeText={setLicencePlate}
                      autoCapitalize="characters"
                      editable={!loading}
                    />
                  </Field>

                  <View style={styles.row}>
                    <View style={styles.halfField}>
                      <Text style={styles.inputLabel}>Vehicle Make</Text>
                      <TextInput
                        style={styles.plainInput}
                        placeholder="e.g. VW Polo"
                        placeholderTextColor={colors.gray400}
                        value={vehicleMake}
                        onChangeText={setVehicleMake}
                        editable={!loading}
                      />
                    </View>
                    <View style={[styles.halfField, { marginLeft: spacing.sm, marginRight: 0 }]}>
                      <Text style={styles.inputLabel}>Year</Text>
                      <TextInput
                        style={styles.plainInput}
                        placeholder="e.g. 2020"
                        placeholderTextColor={colors.gray400}
                        value={vehicleYear}
                        onChangeText={setVehicleYear}
                        keyboardType="number-pad"
                        editable={!loading}
                      />
                    </View>
                  </View>
                </View>
              )}

              <Button
                label="Continue"
                onPress={goNext}
                icon={<ArrowRight size={16} color={colors.white} strokeWidth={2} />}
                style={[styles.continueButton, { marginTop: 4 }]}
              />
            </View>
          )}

          {step === 3 && (
            <View>
              <Field label="Create Password" icon={<Lock size={16} color={colors.gray400} strokeWidth={1.8} />}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.gray400}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowPassword((p) => !p)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  {showPassword ? (
                    <EyeOff size={16} color={colors.gray400} strokeWidth={1.8} />
                  ) : (
                    <Eye size={16} color={colors.gray400} strokeWidth={1.8} />
                  )}
                </TouchableOpacity>
              </Field>
              <View style={styles.strengthTrack}>
                <View
                  style={[
                    styles.strengthFill,
                    { width: `${(strength / 4) * 100}%`, backgroundColor: strengthMeta[strength].color },
                  ]}
                />
              </View>
              <Text style={[styles.hintText, strength > 0 && { color: strengthMeta[strength].color }]}>
                {password.length === 0 ? 'Enter a password' : `${strengthMeta[strength].label} password`}
              </Text>

              <Field label="Confirm Password" icon={<Lock size={16} color={colors.gray400} strokeWidth={1.8} />}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Repeat your password"
                  placeholderTextColor={colors.gray400}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowConfirm((p) => !p)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  {showConfirm ? (
                    <EyeOff size={16} color={colors.gray400} strokeWidth={1.8} />
                  ) : (
                    <Eye size={16} color={colors.gray400} strokeWidth={1.8} />
                  )}
                </TouchableOpacity>
              </Field>

              <Field label="Emergency Contact" icon={<HeartPulse size={16} color={colors.red} strokeWidth={1.8} />}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Name and phone number"
                  placeholderTextColor={colors.gray400}
                  value={emergencyContact}
                  onChangeText={setEmergencyContact}
                  editable={!loading}
                />
              </Field>

              <TouchableOpacity style={styles.termsRow} onPress={() => setAgreeTerms((v) => !v)} activeOpacity={0.7}>
                <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
                  {agreeTerms && <Check size={12} color={colors.white} strokeWidth={3} />}
                </View>
                <Text style={styles.termsText}>
                  I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>. I understand my biometric data may be used for
                  verification.
                </Text>
              </TouchableOpacity>

              <Button
                label="Continue to Face Verification"
                onPress={goNext}
                icon={<CameraIcon size={16} color={colors.white} strokeWidth={2} />}
                style={{ marginTop: 4 }}
              />
            </View>
          )}

          {step === 4 && (
            <View style={styles.faceStepContainer}>
              <Text style={styles.faceIntro}>Let&apos;s verify your identity</Text>
              <Text style={styles.faceSubIntro}>We&apos;ll take a few photos to confirm it&apos;s really you</Text>
              {renderFaceVerification()}

              {isComplete && (
                <Button
                  label={loading ? 'Creating Account…' : 'Create Account'}
                  onPress={handleFinalSubmit}
                  disabled={loading}
                  icon={loading ? undefined : <ArrowRight size={16} color={colors.white} strokeWidth={2} />}
                  style={{ marginTop: spacing.md }}
                />
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <BottomSheetModal
        visible={yearSheetVisible}
        onClose={() => setYearSheetVisible(false)}
        title="Year of study"
        subtitle="Select your current year"
      >
        {YEAR_OPTIONS.map((option) => {
          const isSelected = yearOfStudy?.value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.yearOption, isSelected && styles.yearOptionSelected]}
              onPress={() => {
                setYearOfStudy(option);
                setYearSheetVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.yearOptionLabel}>{option.label}</Text>
              {isSelected && <Check size={16} color={colors.green} strokeWidth={2.5} />}
            </TouchableOpacity>
          );
        })}
      </BottomSheetModal>
    </KeyboardAvoidingView>
  );
}

function StepDot({ index, current, label, icon }: { index: number; current: number; label?: string; icon?: React.ReactNode }) {
  const done = current > index;
  const active = current === index;
  return (
    <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
      {done ? <Check size={10} color={colors.white} strokeWidth={2.6} /> : icon || <Text style={styles.stepDotText}>{label}</Text>}
    </View>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        {icon}
        {children}
      </View>
    </View>
  );
}

function RoleCard({ active, icon, title, desc, onPress }: { active: boolean; icon: React.ReactNode; title: string; desc: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.roleCard, active && styles.roleCardActive]} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={styles.roleCardTitle}>{title}</Text>
      <Text style={styles.roleCardDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

function UploadZone({ file, onPress }: { file: DocumentPicker.DocumentPickerAsset | null; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.uploadZone, file && styles.uploadZoneActive]} onPress={onPress} activeOpacity={0.7}>
      {file ? (
        <FileCheck2 size={18} color={colors.green} strokeWidth={1.8} />
      ) : (
        <CloudUpload size={18} color={colors.gray400} strokeWidth={1.5} />
      )}
      <Text style={styles.uploadText} numberOfLines={1}>
        {file ? file.name : 'Tap to upload document'}
      </Text>
      <Text style={styles.uploadHint}>PDF, JPG, or PNG — Max 10MB</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scrollView: { flex: 1 },
  blob: { position: 'absolute', borderRadius: 999 },
  blobGreen: {
    width: 260,
    height: 260,
    backgroundColor: 'rgba(34,197,94,0.07)',
    top: -120,
    right: -100,
  },

  header: { paddingHorizontal: 0, paddingBottom: 2 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10, alignSelf: 'flex-start' },
  backText: { fontFamily: font.semibold, fontSize: 12.5, fontWeight: '600', color: colors.green },
  title: { fontFamily: font.extrabold, fontSize: 21, fontWeight: '800', color: colors.gray900, marginBottom: 2 },
  subtitle: { fontFamily: font.regular, fontSize: 12.5, color: colors.gray500 },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 14,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.blue },
  stepDotDone: { backgroundColor: colors.green },
  stepDotText: { fontFamily: font.bold, fontSize: 10, fontWeight: '700', color: colors.gray500 },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.gray200, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: colors.green },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 5,
    marginBottom: 14,
  },
  stepLabelText: {
    fontFamily: font.semibold,
    fontSize: 8,
    fontWeight: '600',
    color: colors.gray400,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  scrollContainer: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 24, paddingBottom: 24, minHeight: '100%' },

  inputContainer: { marginBottom: 12 },
  inputLabel: { fontFamily: font.semibold, color: colors.gray700, fontSize: 12, marginBottom: 4, fontWeight: '600' },
  hintText: { fontFamily: font.regular, fontSize: 10.5, color: colors.gray400, marginTop: 4, marginBottom: 8 },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.gray50,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  fieldInput: {
    flex: 1,
    fontFamily: font.regular,
    color: colors.gray900,
    paddingVertical: 8,
    fontSize: 14,
  },
  plateInput: { fontFamily: font.semibold, letterSpacing: 0.5 },
  plainInput: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.gray900,
    backgroundColor: colors.gray50,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  pickerField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  pickerFieldLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerFieldText: { fontFamily: font.medium, fontSize: 14, color: colors.gray800, fontWeight: '500' },

  roleGrid: { flexDirection: 'row', gap: 6 },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1.2,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  roleCardActive: { borderColor: colors.green, backgroundColor: colors.greenLight },
  roleCardTitle: { fontFamily: font.bold, fontSize: 11, fontWeight: '700', color: colors.gray900, marginTop: 3 },
  roleCardDesc: { fontFamily: font.regular, fontSize: 8.5, color: colors.gray400, marginTop: 0, textAlign: 'center' },

  uploadZone: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray300,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: colors.gray50,
    minHeight: 48,
    justifyContent: 'center',
  },
  uploadZoneActive: { borderStyle: 'solid', borderColor: colors.green, backgroundColor: colors.greenLight },
  continueButton: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
  },
  uploadText: { fontFamily: font.semibold, fontSize: 10.5, fontWeight: '600', color: colors.gray700, marginTop: 2, textAlign: 'center' },
  uploadHint: { fontFamily: font.regular, fontSize: 7.5, color: colors.gray400, marginTop: 1, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center' },
  halfField: { flex: 1, marginRight: spacing.sm },

  strengthTrack: { height: 4, borderRadius: 2, backgroundColor: colors.gray200, marginTop: 0, marginBottom: 6, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 2 },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.green, borderColor: colors.green },
  termsText: { flex: 1, fontFamily: font.regular, fontSize: 11, color: colors.gray700, lineHeight: 16 },
  termsLink: { fontFamily: font.semibold, fontWeight: '600', color: colors.green },

  yearOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    marginBottom: 6,
  },
  yearOptionSelected: { borderColor: colors.green, backgroundColor: colors.greenLight },
  yearOptionLabel: { fontFamily: font.semibold, fontSize: 14, fontWeight: '600', color: colors.gray900 },

  // Face verification
  faceStepContainer: {
    marginTop: 4,
  },
  faceIntro: {
    fontFamily: font.bold,
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: 4,
  },
  faceSubIntro: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  cameraPlaceholder: { width: '100%', height: 320, borderRadius: 20, backgroundColor: colors.gray100 },

  permissionBox: {
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: 20,
    padding: spacing.xl,
    gap: 12,
    minHeight: 300,
    justifyContent: 'center',
  },
  permissionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  permissionTitle: { fontFamily: font.bold, fontSize: 17, fontWeight: '700', color: colors.gray900 },
  permissionSubtitle: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionButton: {
    backgroundColor: colors.green,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 30,
    marginTop: 8,
  },
  permissionButtonText: {
    fontFamily: font.semibold,
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  verificationContainer: {
    alignItems: 'center',
  },

  cameraWrapper: {
    width: SCREEN_WIDTH - 48,
    height: SCREEN_WIDTH - 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.gray900,
    marginBottom: spacing.md,
    shadowColor: colors.gray900,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  cameraFrame: {
    flex: 1,
    position: 'relative',
  },
  cameraView: {
    flex: 1,
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
  },

  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
  },

  faceGuide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGuideInner: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGuideInnerComplete: {
    borderColor: 'rgba(76,175,80,0.85)',
  },
  guideCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  directionOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  directionBadge: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  directionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionLabel: {
    fontFamily: font.semibold,
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  statusIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
    position: 'relative',
  },
  statusPulse: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
    opacity: 0.5,
  },
  statusText: {
    fontFamily: font.medium,
    fontSize: 10,
    fontWeight: '500',
    color: colors.white,
  },

  verifyingOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  verifyingText: {
    fontFamily: font.medium,
    fontSize: 11,
    fontWeight: '500',
    color: colors.white,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 12,
    padding: 10,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontFamily: font.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.red,
    lineHeight: 16,
  },
  attemptsText: {
    fontFamily: font.regular,
    fontSize: 10.5,
    color: colors.red,
    marginTop: 2,
  },

  progressContainer: {
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressTitle: {
    fontFamily: font.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray600,
  },
  progressPercent: {
    fontFamily: font.bold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.green,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray200,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.green,
  },

  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: spacing.md,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.blue,
  },
  stepCircleComplete: {
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.green,
  },
  stepNumber: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: font.semibold,
    fontSize: 10,
    fontWeight: '600',
    color: colors.gray600,
  },
  stepLabel: {
    fontFamily: font.medium,
    fontSize: 8,
    fontWeight: '500',
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  stepLabelComplete: {
    color: colors.green,
  },

  controlsContainer: {
    width: '100%',
    gap: 8,
  },
  startButton: {
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  startButtonText: {
    fontFamily: font.bold,
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },

  captureRow: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  captureButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 4,
    borderColor: 'rgba(76,175,80,0.25)',
  },
  captureButtonDisabled: {
    backgroundColor: colors.gray400,
    shadowOpacity: 0,
  },
  captureHint: {
    fontFamily: font.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray600,
    textAlign: 'center',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: colors.gray100,
    borderRadius: 30,
    marginTop: 4,
  },
  resetButtonText: {
    fontFamily: font.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray600,
  },

  completeContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  completeIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(76,175,80,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  completeTitle: {
    fontFamily: font.bold,
    fontSize: 20,
    fontWeight: '700',
    color: colors.green,
    marginBottom: 4,
  },
  completeSubtitle: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.gray500,
    marginBottom: spacing.md,
  },
  completePreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.green,
  },
  completeImage: {
    width: '100%',
    height: '100%',
  },
});