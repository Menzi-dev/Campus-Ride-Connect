// Registration: collect rider or driver details in steps, select driver documents and capture a
// guided enrollment photo. Submit the completed application to the backend and explain the next
// verification or approval step.
// Where: mobile/src/screens/CreateAccountScreen.tsx; start at CreateAccountScreen(), then follow
// the named actions below.
// How: CreateAccountScreen() renders the screen and keeps its form/list/progress values in React
// state. handleFinalSubmit() contain the API calls; ApiClient.ts adds the /api base path and saved
// login token.
/** Collects role-specific account details, documents and guided face enrollment before registration. */
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
  StatusBar,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';

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
  CheckCircle2,
} from 'lucide-react-native';
import Button from '../components/Button';
import BottomSheetModal from '../components/BottomSheetModal';
import { useToast } from '../components/Toast';
import { colors, radius, spacing, font } from '../theme/theme';
import apiClient from '../services/ApiClient';

import GuidedFaceScan, { FaceScanResult } from '../components/GuidedFaceScan';

type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  EmailVerification: { email?: string; token?: string } | undefined;
  CreateAccount: undefined;
  AdminDashboard: undefined;
  DriverDashboard: undefined;
  SecurityDashboard: undefined;
  Home: undefined;
  Legal: { document: 'terms' | 'privacy' };
};

type Role = 'RIDER' | 'DRIVER';
type YearOption = { label: string; value: number };

const YEAR_OPTIONS: YearOption[] = [
  { label: '1st Year', value: 1 },
  { label: '2nd Year', value: 2 },
  { label: '3rd Year', value: 3 },
  { label: '4th Year', value: 4 },
  { label: 'Postgraduate', value: 5 },
];

const TOTAL_STEPS = 4;
const CAMPUS_EMAIL_DOMAIN = '@spu.ac.za';

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
  const [vehiclePhotoAsset, setVehiclePhotoAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  // Step 3 — Security
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Step 4 — Face Verification
  const [, requestPermission] = useCameraPermissions();

  const [hasRequestedCameraPermission, setHasRequestedCameraPermission] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [faceScanResult, setFaceScanResult] = useState<FaceScanResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [isComplete, setIsComplete] = useState(false);

  // Feature: Open the file picker and keep the selected driver application document.
  // Where: CreateAccountScreen.pickDocument() below.
  // How: pickDocument() uses DocumentPicker.getDocumentAsync() in the block below to carry out this
  // step.
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

  // Feature: Let the driver choose a vehicle photo and validate the selected file.
  // Where: CreateAccountScreen.pickVehiclePhoto() below.
  // How: pickVehiclePhoto() uses DocumentPicker.getDocumentAsync() in the block below to carry out
  // this step. setVehiclePhotoAsset() update React state, which redraws the related screen content.
  const pickVehiclePhoto = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const photo = result.assets[0];
      if (photo.size && photo.size > 4 * 1024 * 1024) {
        showToast('Choose a vehicle photo smaller than 4 MB', 'red');
        return;
      }
      setVehiclePhotoAsset(photo);
      showToast('Vehicle photo selected', 'green');
    } catch {
      showToast('Could not open the photo picker', 'red');
    }
  };

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

  // Feature: Validate the current registration step before moving to the next step.
  // Where: CreateAccountScreen.goNext() below.
  // How: goNext() uses validateStep1(), validateStep2() and validateStep3() in the block below to
  // carry out this step. setStep() update React state, which redraws the related screen content.
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

  // Feature: Return to the previous registration step without submitting the account.
  // Where: CreateAccountScreen.goBack() below.
  // How: goBack() uses navigation.canGoBack(), navigation.goBack() and navigation.replace() in the
  // block below to carry out this step. setStep() update React state, which redraws the related
  // screen content.
  const goBack = () => {
    if (step === 1) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('Login');
      return;
    }
    setStep((s) => Math.max(s - 1, 1));
  };

  // Feature: Request camera access and update the capture state according to the permission result.
  // Where: CreateAccountScreen.handleRequestPermission() below.
  // How: handleRequestPermission() uses requestPermission() in the block below to carry out this
  // step. setHasRequestedCameraPermission() update React state, which redraws the related screen
  // content.
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
      if (Platform.OS !== 'web') handleRequestPermission();
    }
  }, [step, hasRequestedCameraPermission]);

  // Feature: Check the completed registration steps and send account, enrollment and driver
  // application data.
  // Where: CreateAccountScreen.handleFinalSubmit() below.
  // How: handleFinalSubmit() builds FormData from the form, enrollment image/metadata and
  // applicable driver files, then posts /auth/register. AuthController and AuthService save the
  // account and pending driver profile.
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
      if (faceScanResult) {
        formData.append('faceScanMetadata', JSON.stringify({
          method: faceScanResult.method, completedAt: faceScanResult.completedAt,
          challenges: faceScanResult.challenges, identityVerified: false,
        }));
      }

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

      if (role === 'DRIVER' && vehiclePhotoAsset) {
        try {
          const photoResponse = await fetch(vehiclePhotoAsset.uri);
          if (!photoResponse.ok) throw new Error(`Failed to load photo (${photoResponse.status})`);
          const photoBlob = await photoResponse.blob();
          formData.append('vehiclePhoto', photoBlob, vehiclePhotoAsset.name || 'vehicle-photo.jpg');
        } catch (err: any) {
          throw new Error(`Vehicle photo upload error: ${err.message}`);
        }
      }

      console.log('Submitting registration with form data keys:', Array.from(formData.keys()));
      const response = await apiClient.post('/auth/register', formData);

      console.log('Registration completed:', { success: response.data?.success, role: response.data?.user?.role });

      if (response.data?.success === false) {
        showToast(response.data?.message || 'Registration failed', 'red');
        return;
      }

      await AsyncStorage.multiRemove(['authToken', 'user', 'saved_cards', 'default_payment_method']);
      if (response.data?.user?.role === 'DRIVER' && response.data?.emailVerificationRequired === false) {
        if (typeof response.data.token === 'string' && response.data.token) {
          await AsyncStorage.setItem('authToken', response.data.token);
          await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
          showToast('Driver application submitted. Waiting for admin approval.', 'blue');
          navigation.replace('DriverDashboard');
        } else {
          showToast('Driver application submitted. Sign in to view your approval status.', 'blue');
          navigation.replace('Login');
        }
        return;
      }
      showToast('Account created. Please verify your email.', 'green');
      navigation.replace('EmailVerification', { email: email.trim().toLowerCase() });
    } catch (error: any) {
      // Axios errors include submitted passwords/documents in their request configuration.
      console.error('Registration failed:', { status: error?.response?.status, code: error?.code });
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
    if (Platform.OS === 'web') {
      if (isComplete && selfieUri) return <View style={styles.completeContainer}>
        <CheckCircle2 size={56} color={colors.green} />
        <Text style={styles.completeTitle}>Guided scan complete</Text>
        <Text style={styles.completeSubtitle}>Your face and requested movements were detected.</Text>
        <Image source={{ uri: selfieUri }} style={{ width: 140, height: 140, borderRadius: 20, marginVertical: 16 }} />
        <TouchableOpacity onPress={() => { setFaceScanResult(null); setSelfieUri(null); setIsComplete(false); }}><Text>Scan again</Text></TouchableOpacity>
      </View>;
      return <GuidedFaceScan onComplete={result => {
        setFaceScanResult(result); setSelfieUri(result.image); setIsComplete(true);
      }} />;
    }
    return <GuidedFaceScan onComplete={() => undefined} />;
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

                  <Text style={[styles.inputLabel, { marginTop: 8 }]}>Vehicle Photo <Text style={styles.optionalLabel}>Optional</Text></Text>
                  <TouchableOpacity style={[styles.vehiclePhotoPicker, vehiclePhotoAsset && styles.vehiclePhotoPickerSelected]} onPress={pickVehiclePhoto} activeOpacity={0.8}>
                    {vehiclePhotoAsset ? (
                      <Image source={{ uri: vehiclePhotoAsset.uri }} style={styles.vehiclePhotoPreview} />
                    ) : (
                      <View style={styles.vehiclePhotoPlaceholder}><Car size={20} color={colors.greenDark} /></View>
                    )}
                    <View style={styles.vehiclePhotoCopy}>
                      <Text style={styles.vehiclePhotoTitle} numberOfLines={1}>{vehiclePhotoAsset ? 'Vehicle photo selected' : 'Add a photo of your car'}</Text>
                      <Text style={styles.vehiclePhotoHint} numberOfLines={2}>Shown on your driver profile · JPG, PNG or WebP · up to 4 MB</Text>
                    </View>
                    <CameraIcon size={17} color={colors.greenDark} />
                  </TouchableOpacity>

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

              <View style={styles.termsRow}>
                <TouchableOpacity
                  onPress={() => setAgreeTerms((value) => !value)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: agreeTerms }}
                  accessibilityLabel="Agree to Terms of Service and Privacy Policy"
                >
                  <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
                    {agreeTerms && <Check size={12} color={colors.white} strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text
                    style={styles.termsLink}
                    accessibilityRole="link"
                    onPress={() => navigation.navigate('Legal', { document: 'terms' })}
                  >
                    Terms of Service
                  </Text>{' '}and{' '}
                  <Text
                    style={styles.termsLink}
                    accessibilityRole="link"
                    onPress={() => navigation.navigate('Legal', { document: 'privacy' })}
                  >
                    Privacy Policy
                  </Text>. I understand my biometric data may be used for
                  verification.
                </Text>
              </View>

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
              <Text style={styles.faceIntro}>Let&apos;s scan your face</Text>
              <Text style={styles.faceSubIntro}>Follow the live instructions. Your enrollment image is saved only after the guided scan.</Text>
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

// Screen appearance: keep layout, spacing, colours and text styles together here.
const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.white },
  scrollView: { flex: 1 },
  blob: { position: 'absolute', borderRadius: 999 },
  blobGreen: {
    width: 260,
    height: 260,
    backgroundColor: 'rgba(34,197,94,0.07)',
    top: -120,
    right: 0,
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

  scrollContainer: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 24,
    minHeight: '100%',
  },

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
  optionalLabel: { color: colors.gray400, fontFamily: font.regular, fontSize: 10 },
  vehiclePhotoPicker: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.gray300, borderRadius: radius.md, backgroundColor: colors.gray50 },
  vehiclePhotoPickerSelected: { borderStyle: 'solid', borderColor: colors.green, backgroundColor: colors.greenLight },
  vehiclePhotoPreview: { width: 76, height: 54, borderRadius: radius.sm, backgroundColor: colors.gray200 },
  vehiclePhotoPlaceholder: { width: 76, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.greenLight },
  vehiclePhotoCopy: { flex: 1, minWidth: 0 },
  vehiclePhotoTitle: { color: colors.gray800, fontFamily: font.bold, fontSize: 11 },
  vehiclePhotoHint: { color: colors.gray500, fontFamily: font.medium, fontSize: 9, lineHeight: 13, marginTop: 3 },

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

  completeContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
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

});
