import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar, Image, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck, MapPin, Siren } from 'lucide-react-native';
import { colors, radius, spacing, font } from '../theme/theme';

const LOGO = require('../assets/icon.png');

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
  const { width, height } = useWindowDimensions();
  const logoSize = Math.min(290, width * 0.64, height * 0.31);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const featuresAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rise = (val: Animated.Value, delay: number) =>
      Animated.timing(val, { toValue: 1, duration: 450, delay, useNativeDriver: true });

    Animated.stagger(120, [
      rise(logoAnim, 0),
      rise(featuresAnim, 0),
    ]).start();

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: SPLASH_DURATION,
      useNativeDriver: false,
    }).start();

    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, SPLASH_DURATION);

    return () => {
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
        colors={['#F1FBF6', colors.white, '#F6F9FF']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + spacing.xxl }]}>
        <Animated.View
          style={[styles.logoWrap, { width: logoSize, height: logoSize }, fadeUp(logoAnim)]}
        >
          <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[styles.featuresRow, fadeUp(featuresAnim)]}>
          <Feature
            iconBg={colors.greenLight}
            icon={<ShieldCheck size={17} color={colors.green} strokeWidth={2.2} />}
            label="Verified Students"
          />
          <View style={styles.featureSeparator} />
          <Feature
            iconBg={colors.blueLight}
            icon={<MapPin size={17} color={colors.blue} strokeWidth={2.2} />}
            label="Live Tracking"
          />
          <View style={styles.featureSeparator} />
          <Feature
            iconBg={colors.redLight}
            icon={<Siren size={17} color={colors.red} strokeWidth={2.2} />}
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
    <View style={styles.featureItem}>
      <View style={[styles.featureIconCircle, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.white, overflow: 'hidden' },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray100,
    borderRadius: radius.md,
    shadowColor: colors.gray900,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  featureIconCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureSeparator: {
    width: 1,
    height: 36,
    backgroundColor: colors.gray200,
  },
  featureText: {
    fontFamily: font.semibold,
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray800,
    textAlign: 'center',
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
