import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { ArrowLeft, Check, Star } from 'lucide-react-native';
import { colors, font, radius, spacing } from '../theme/theme';
import apiClient from '../services/ApiClient';

type RootStackParamList = {
  Home: { skipActiveRideRestore?: boolean } | undefined;
  RatingDriver: { rideId: string; driverName?: string; returnToHistory?: boolean };
};

export default function RatingDriverScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RatingDriver'>>();
  const [selectedRating, setSelectedRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submitRating = async () => {
    if (selectedRating < 1 || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/rides/${route.params.rideId}/rating`, {
        rating: selectedRating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
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

      <KeyboardAvoidingView style={{ flex: 1, minHeight: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
      <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
              disabled={submitting}
              style={styles.starButton}
              accessibilityRole="button"
              accessibilityLabel={`${value} star rating`}
            >
              <Star
                size={44}
                color={value <= selectedRating ? colors.orange : colors.gray300}
                fill={value <= selectedRating ? colors.orange : 'transparent'}
              />
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          testID="ride-rating-comment"
          style={styles.commentInput}
          placeholder="Add a comment (optional)"
          placeholderTextColor={colors.gray400}
          accessibilityLabel="Add a comment (optional)"
          value={comment}
          onChangeText={setComment}
          editable={!submitting}
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitButton, selectedRating === 0 && styles.disabledButton]}
          onPress={submitRating}
          disabled={selectedRating === 0 || submitting}
          accessibilityRole="button"
          accessibilityLabel="Submit rating"
        >
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Submit rating</Text>}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 76,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  backButton: { padding: spacing.sm },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.gray900, fontFamily: font.medium, fontSize: 18 },
  headerSpacer: { width: 38 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  eyebrow: { color: colors.greenDark, fontFamily: font.medium, fontSize: 14, letterSpacing: 1 },
  title: { marginTop: spacing.xxl, color: colors.gray900, fontFamily: font.regular, fontSize: 32, textAlign: 'center' },
  subtitle: { marginTop: spacing.md, color: colors.gray500, fontFamily: font.regular, fontSize: 17, textAlign: 'center' },
  stars: { width: '100%', maxWidth: 440, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.xxxl },
  starButton: { padding: spacing.xs, minWidth: 44 },
  commentInput: { width: '100%', minHeight: 136, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.lg, padding: spacing.lg, fontFamily: font.regular, fontSize: 16, color: colors.gray900, backgroundColor: colors.white, marginBottom: spacing.xl },
  submitButton: {
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.green,
  },
  disabledButton: { backgroundColor: colors.gray300 },
  submitText: { color: colors.white, fontFamily: font.bold, fontSize: 16 },
  error: { marginBottom: spacing.md, color: colors.red, fontFamily: font.medium, textAlign: 'center' },
  thankYouCard: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: spacing.xxxl },
  successIcon: { alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.green },
});
