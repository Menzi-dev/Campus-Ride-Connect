import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { ArrowLeft, Check, Star } from 'lucide-react-native';
import { colors, font, radius, shadow, spacing } from '../theme/theme';
import apiClient from '../services/ApiClient';

type RootStackParamList = {
  Home: { skipActiveRideRestore?: boolean } | undefined;
  RatingDriver: { rideId: string; driverName?: string; returnToHistory?: boolean };
};

export default function RatingDriverScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RatingDriver'>>();
  const [selectedRating, setSelectedRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submitRating = async () => {
    if (selectedRating < 1 || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/rides/${route.params.rideId}/rating`, { rating: selectedRating });
      setSubmitted(true);
      setTimeout(() => {
        if (route.params.returnToHistory) {
          navigation.goBack();
          return;
        }
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home', params: { skipActiveRideRestore: true } }],
        });
      }, 2200);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || 'Could not submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.thankYouCard}>
          <View style={styles.successIcon}><Check size={32} color={colors.white} /></View>
          <Text style={styles.title}>Thank you for rating!</Text>
          <Text style={styles.subtitle}>Your feedback helps keep CampusConnect safe.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate your ride</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>TRIP COMPLETED</Text>
        <Text style={styles.title}>Rate our driver</Text>
        <Text style={styles.subtitle}>
          How was your ride{route.params.driverName ? ` with ${route.params.driverName}` : ''}?
        </Text>

        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => setSelectedRating(value)}
              style={styles.starButton}
              accessibilityLabel={`${value} star rating`}
            >
              <Star
                size={38}
                color={value <= selectedRating ? colors.orange : colors.gray300}
                fill={value <= selectedRating ? colors.orange : 'transparent'}
              />
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitButton, selectedRating === 0 && styles.disabledButton]}
          onPress={submitRating}
          disabled={selectedRating === 0 || submitting}
        >
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Submit rating</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    ...shadow.sm,
  },
  backButton: { padding: spacing.sm },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.gray900, fontFamily: font.bold, fontSize: 18 },
  headerSpacer: { width: 38 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  eyebrow: { color: colors.greenDark, fontFamily: font.bold, fontSize: 11, letterSpacing: 1 },
  title: { marginTop: spacing.md, color: colors.gray900, fontFamily: font.bold, fontSize: 28, textAlign: 'center' },
  subtitle: { marginTop: spacing.sm, color: colors.gray500, fontFamily: font.regular, fontSize: 15, textAlign: 'center' },
  stars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  starButton: { paddingHorizontal: spacing.xs },
  submitButton: {
    width: '100%',
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.green,
    marginTop: spacing.md,
  },
  disabledButton: { backgroundColor: colors.gray300 },
  submitText: { color: colors.white, fontFamily: font.bold, fontSize: 16 },
  error: { marginBottom: spacing.md, color: colors.red, fontFamily: font.medium, textAlign: 'center' },
  thankYouCard: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: spacing.xxxl },
  successIcon: { alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.green },
});
