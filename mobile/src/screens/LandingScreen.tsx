import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Navigation, ShieldCheck, MapPin, Siren } from 'lucide-react-native';
import { colors, radius, spacing, font } from '../theme/theme';

const { width } = Dimensions.get('window');

type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  CreateAccount: undefined;
  Home: undefined;
};

const SPLASH_DURATION = 2400;

export default function LandingScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const logoAnim = useRef(new Animated.Value(0)).current;
  const nameAnim = useRef(new Animated.Value(0)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const featuresAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Pulsing "live" ring behind the logo
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const rise = (val: Animated.Value, delay: number) =>
      Animated.timing(val, { toValue: 1, duration: 450, delay, useNativeDriver: true });

    Animated.stagger(120, [
      rise(logoAnim, 0),
      rise(nameAnim, 0),
      rise(taglineAnim, 0),
      rise(featuresAnim, 0),
    ]).start();

    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.45, duration: 1400, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    pulseLoop.start();

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: SPLASH_DURATION,
      useNativeDriver: false,
    }).start();

    pulseLoop.start();

    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, SPLASH_DURATION);

    return () => {
      pulseLoop.stop();
      clearTimeout(timer);
    };
  }, []);

  const fadeUp = (val: Animated.Value) => ({
    opacity: val,
    transform: [{ translateY: val.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  });

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <LinearGradient
        colors={[colors.white, '#F3FBF6', colors.white]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft background blobs, on-brand but subtle */}
      <View style={[styles.blob, styles.blobGreen]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobBlue]} pointerEvents="none" />

      <View style={[styles.content, { paddingTop: insets.top + spacing.xxl }]}>
        {/* LOGO with live pulse ring */}
        <Animated.View style={[styles.logoWrap, fadeUp(logoAnim)]}>
          <Animated.View
            style={[
              styles.pulseRing,
              { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
            ]}
          />
          <LinearGradient
            colors={[colors.green, colors.greenDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoCircle}
          >
            <Navigation size={40} color={colors.white} strokeWidth={2} fill={colors.white} />
          </LinearGradient>
        </Animated.View>

        {/* APP NAME */}
        <Animated.Text style={[styles.logoText, fadeUp(nameAnim)]}>CampusConnect</Animated.Text>

        {/* TAGLINE */}
        <Animated.Text style={[styles.tagline, fadeUp(taglineAnim)]}>
          Safe campus rides, always
        </Animated.Text>

        {/* FEATURES */}
        <Animated.View style={[styles.featuresRow, fadeUp(featuresAnim)]}>
          <Feature
            iconBg={colors.greenLight}
            icon={<ShieldCheck size={14} color={colors.green} strokeWidth={2.2} />}
            label="Verified Students"
          />
          <Feature
            iconBg={colors.blueLight}
            icon={<MapPin size={14} color={colors.blue} strokeWidth={2.2} />}
            label="Live Tracking"
          />
          <Feature
            iconBg={colors.redLight}
            icon={<Siren size={14} color={colors.red} strokeWidth={2.2} />}
            label="SOS Alert"
          />
        </Animated.View>
      </View>

      {/* PROGRESS LOADER */}
      <View style={[styles.loaderWrap, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <Text style={styles.loaderLabel}>Getting things ready</Text>
      </View>
    </View>
  );
}

function Feature({
  icon,
  iconBg,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
}) {
  return (
    <View style={styles.featurePill}>
      <View style={[styles.featureIconCircle, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, overflow: 'hidden' },

  blob: { position: 'absolute', borderRadius: 999 },
  blobGreen: {
    width: width * 1.2,
    height: width * 1.2,
    backgroundColor: 'rgba(34,197,94,0.10)',
    top: -width * 0.6,
    left: -width * 0.4,
  },
  blobBlue: {
    width: width * 0.95,
    height: width * 0.95,
    backgroundColor: 'rgba(37,99,235,0.08)',
    bottom: -width * 0.5,
    right: -width * 0.35,
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },

  logoWrap: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.green,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: radius.lg + 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },

  logoText: {
    fontFamily: font.extrabold,
    fontSize: 32,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  tagline: {
    fontFamily: font.medium,
    fontSize: 15,
    fontWeight: '500',
    color: colors.gray500,
    marginBottom: spacing.xxxl + 4,
  },

  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray100,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  featureIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontFamily: font.semibold,
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.gray700,
  },

  loaderWrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl * 1.5,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray100,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.green,
  },
  loaderLabel: {
    fontFamily: font.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray400,
  },
});
