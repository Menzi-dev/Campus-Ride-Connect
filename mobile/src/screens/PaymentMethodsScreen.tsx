import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Banknote, Check, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Plus, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, font, radius, shadow, spacing } from '../theme/theme';

type CardRecord = {
  id: string;
  label: string;
  lastFour: string;
  brand: string;
  expiry: string;
  cardholder: string;
  isDefault?: boolean;
};

const DEFAULT_CARD_KEY = 'saved_cards';
const DEFAULT_PAYMENT_KEY = 'default_payment_method';
const MAX_SAVED_CARDS = 3;

export default function PaymentMethodsScreen() {
  const navigation = useNavigation();
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [addCardVisible, setAddCardVisible] = useState(false);
  const [cardholder, setCardholder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardError, setCardError] = useState('');

  useEffect(() => {
    loadSavedCards();
  }, []);

  const loadSavedCards = async () => {
    try {
      const stored = await AsyncStorage.getItem(DEFAULT_CARD_KEY);
      const selected = await AsyncStorage.getItem(DEFAULT_PAYMENT_KEY);
      const parsed = stored ? (JSON.parse(stored) as CardRecord[]) : [];

      if (parsed.length) {
        setCards(parsed);
        setPaymentMethod(selected === 'CARD' ? 'CARD' : 'CASH');
      } else {
        setCards([]);
        setPaymentMethod('CASH');
      }
    } catch {
      setCards([]);
      setPaymentMethod('CASH');
    }
  };

  const saveCards = async (nextCards: CardRecord[]) => {
    await AsyncStorage.setItem(DEFAULT_CARD_KEY, JSON.stringify(nextCards));
    setCards(nextCards);
  };

  const handleAddCard = async () => {
    if (cards.length >= MAX_SAVED_CARDS) return;

    const cleanNumber = cardNumber.replace(/\D/g, '');
    const expiryDigits = expiry.replace(/\D/g, '');
    const normalizedExpiry = expiryDigits.length === 3
      ? `0${expiryDigits[0]}/${expiryDigits.slice(1)}`
      : expiryDigits.length === 4
        ? `${expiryDigits.slice(0, 2)}/${expiryDigits.slice(2)}`
        : expiry.trim();
    const expiryMatch = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(normalizedExpiry);
    const expiryDate = expiryMatch ? new Date(2000 + Number(expiryMatch[2]), Number(expiryMatch[1]), 0) : null;
    const expiryValid = Boolean(expiryDate && expiryDate >= new Date(new Date().getFullYear(), new Date().getMonth(), 1));

    if (!cardholder.trim()) {
      setCardError('Enter the name shown on the card.');
      return;
    }
    if (!/^\d{12,19}$/.test(cleanNumber)) {
      setCardError('Enter a 12 to 19 digit card number.');
      return;
    }
    if (!expiryValid) {
      setCardError('Enter a future expiry date in MM/YY format, for example 03/28.');
      return;
    }
    if (!/^\d{2,4}$/.test(cvv)) {
      setCardError('Enter the security code using 2 to 4 digits.');
      return;
    }

    const lastFour = cleanNumber.slice(-4);
    const brand = cleanNumber.startsWith('4') ? 'Visa' : cleanNumber.startsWith('5') ? 'Mastercard' : 'Card';
    const newCard: CardRecord = {
      id: Date.now().toString(),
      label: `${brand} ending in ${lastFour}`,
      lastFour,
      brand,
      expiry: normalizedExpiry,
      cardholder: cardholder.trim(),
      isDefault: true,
    };

    const nextCards = [...cards.map((card) => ({ ...card, isDefault: false })), newCard];
    try {
      await saveCards(nextCards);
      await AsyncStorage.setItem(DEFAULT_PAYMENT_KEY, 'CARD');
    } catch {
      setCardError('Could not save this card on your device. Please try again.');
      return;
    }
    setPaymentMethod('CARD');
    setCardholder('');
    setCardNumber('');
    setExpiry('');
    setCvv('');
    setCardError('');
    setAddCardVisible(false);
  };

  const setDefaultCard = async (cardId: string) => {
    const nextCards = cards.map((card) => ({ ...card, isDefault: card.id === cardId }));
    await saveCards(nextCards);
    await AsyncStorage.setItem(DEFAULT_PAYMENT_KEY, 'CARD');
    setPaymentMethod('CARD');
  };

  const handleDeleteCard = async (cardId: string) => {
    const currentDefault = cards.find((card) => card.isDefault) || cards[0];
    const removingDefault = currentDefault?.id === cardId;
    const remainingCards = cards.filter((card) => card.id !== cardId);
    const nextCards = remainingCards.map((card, index) => ({
      ...card,
      isDefault: removingDefault ? index === 0 : card.id === currentDefault?.id,
    }));

    await saveCards(nextCards);
    if (nextCards.length === 0) {
      await AsyncStorage.setItem(DEFAULT_PAYMENT_KEY, 'CASH');
      setPaymentMethod('CASH');
    }
  };

  const confirmDeleteCard = (card: CardRecord) => {
    const message = `Remove ${card.label} from saved cards?`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) {
        void handleDeleteCard(card.id);
      }
      return;
    }

    Alert.alert('Delete saved card?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void handleDeleteCard(card.id); } },
    ]);
  };

  const defaultCard = useMemo(() => cards.find((card) => card.isDefault) || cards[0], [cards]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <ChevronLeft size={18} color={colors.greenDark} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Payment Methods</Text>
        <Text style={styles.subtitle}>Choose how you pay for your rides.</Text>

        <Text style={styles.section}>AVAILABLE PAYMENT</Text>

        <TouchableOpacity
          style={[styles.paymentCard, paymentMethod === 'CASH' && styles.activePaymentCard]}
          onPress={() => {
            setPaymentMethod('CASH');
            AsyncStorage.setItem(DEFAULT_PAYMENT_KEY, 'CASH');
          }}
        >
          <View style={[styles.paymentIcon, paymentMethod === 'CASH' && styles.invoiceActive]}>
            <Banknote size={24} color={colors.white} />
          </View>
          <View style={styles.paymentCopy}>
            <Text style={styles.paymentTitle}>Cash</Text>
            <Text style={styles.paymentSubtitle}>Pay the driver directly when ride ends</Text>
          </View>
          {paymentMethod === 'CASH' ? <CheckCircle2 size={22} color={colors.green} /> : <ChevronRight size={18} color={colors.gray400} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.paymentCard, paymentMethod === 'CARD' && styles.activePaymentCard]}
          onPress={() => {
            if (!defaultCard) {
              setAddCardVisible(true);
              return;
            }
            setPaymentMethod('CARD');
            AsyncStorage.setItem(DEFAULT_PAYMENT_KEY, 'CARD');
          }}
        >
          <View style={[styles.paymentIcon, paymentMethod === 'CARD' && styles.cardActive]}>
            <CreditCard size={24} color={colors.white} />
          </View>
          <View style={styles.paymentCopy}>
            <Text style={styles.paymentTitle}>Card</Text>
            <Text style={styles.paymentSubtitle}>{defaultCard ? `Using ${defaultCard.label}` : 'Add a saved card first'}</Text>
          </View>
          {paymentMethod === 'CARD' ? <CheckCircle2 size={22} color={colors.green} /> : <ChevronRight size={18} color={colors.gray400} />}
        </TouchableOpacity>

        <View style={styles.cardSectionHeader}>
          <Text style={styles.section}>SAVED CARDS</Text>
          <TouchableOpacity
            style={[styles.addButton, cards.length >= MAX_SAVED_CARDS && styles.addButtonDisabled]}
            onPress={() => setAddCardVisible(true)}
            disabled={cards.length >= MAX_SAVED_CARDS}
            accessibilityState={{ disabled: cards.length >= MAX_SAVED_CARDS }}
          >
            <Plus size={16} color={colors.greenDark} />
            <Text style={styles.addButtonText}>{cards.length >= MAX_SAVED_CARDS ? 'Maximum saved' : 'Add card'}</Text>
          </TouchableOpacity>
        </View>

        {cards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No saved card yet</Text>
            <Text style={styles.emptyText}>Add a card to pay faster on future rides. Cash stays available as the default until you save a card.</Text>
          </View>
        ) : (
          cards.map((card) => (
            <View key={card.id} style={[styles.savedCard, card.isDefault && styles.defaultSavedCard]}>
              <TouchableOpacity style={styles.savedCardContent} onPress={() => setDefaultCard(card.id)}>
                <View style={styles.cardBadge}>
                  <CreditCard size={18} color={colors.white} />
                </View>
                <View style={styles.savedCardText}>
                  <Text style={styles.savedLabel}>{card.label}</Text>
                  <Text style={styles.savedMeta}>Expiry {card.expiry}</Text>
                </View>
                <View style={styles.cardRight}>
                  {card.isDefault && <Text style={styles.defaultChip}>Default</Text>}
                  {card.isDefault ? <Check size={20} color={colors.green} /> : <ChevronRight size={18} color={colors.gray400} />}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => confirmDeleteCard(card)}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${card.label}`}
                hitSlop={8}
              >
                <Trash2 size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={styles.note}>
          <View style={styles.noteHeader}>
            <ShieldCheck size={16} color={colors.greenDark} />
            <Text style={styles.noteTitle}>Secure payment</Text>
          </View>
          <Text style={styles.noteText}>This demo saves only the card label, expiry, and last four digits on this device. The full card number and security code are not stored or charged.</Text>
        </View>
      </ScrollView>

      <Modal visible={addCardVisible} transparent animationType="slide" onRequestClose={() => setAddCardVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddCardVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add card</Text>
            <Text style={styles.modalSubtitle}>Save a card so you can choose it before ride payment.</Text>

            <Text style={styles.inputLabel}>Cardholder name</Text>
            <TextInput value={cardholder} onChangeText={(value) => { setCardholder(value); setCardError(''); }} placeholder="Full name" style={styles.input} />

            <Text style={styles.inputLabel}>Card number</Text>
            <TextInput
              value={cardNumber}
              onChangeText={(value) => { setCardNumber(value.replace(/[^0-9 ]/g, '').slice(0, 19)); setCardError(''); }}
              placeholder="1234 5678 9012 3456"
              keyboardType="numeric"
              style={styles.input}
            />

            <View style={styles.twoFieldRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Expiry</Text>
                <TextInput
                  value={expiry}
                  onChangeText={(value) => {
                    const digits = value.replace(/\D/g, '').slice(0, 4);
                    setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
                    setCardError('');
                  }}
                  placeholder="MM/YY"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>CVV</Text>
                <TextInput
                  value={cvv}
                  onChangeText={(value) => { setCvv(value.replace(/[^0-9]/g, '').slice(0, 4)); setCardError(''); }}
                  placeholder="123"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>

            {cardError ? <Text style={styles.cardError} accessibilityRole="alert">{cardError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryAction} onPress={() => setAddCardVisible(false)}>
                <Text style={styles.secondaryActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryAction} onPress={handleAddCard}>
                <Text style={styles.primaryActionText}>Save card</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: colors.greenDark, fontFamily: font.bold, fontSize: 13 },
  title: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 22, marginTop: spacing.lg },
  subtitle: { color: colors.gray600, fontFamily: font.medium, fontSize: 12, marginTop: 4 },
  section: { color: colors.gray600, fontFamily: font.bold, fontSize: 10, marginTop: spacing.xl, marginBottom: spacing.sm },
  paymentCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  activePaymentCard: { borderColor: colors.green, backgroundColor: '#F0FDF4' },
  paymentIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.gray700, alignItems: 'center', justifyContent: 'center' },
  invoiceActive: { backgroundColor: colors.green },
  cardActive: { backgroundColor: colors.blue },
  paymentCopy: { flex: 1 },
  paymentTitle: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 16 },
  paymentSubtitle: { color: colors.gray600, fontFamily: font.medium, fontSize: 11, marginTop: 3 },
  cardSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  addButtonDisabled: { opacity: 0.5 },
  addButtonText: { color: colors.greenDark, fontFamily: font.bold, fontSize: 12 },
  savedCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    marginBottom: spacing.sm,
  },
  savedCardContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deleteButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  defaultSavedCard: { borderColor: colors.green, backgroundColor: '#F0FDF4' },
  cardBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  savedCardText: { flex: 1 },
  savedLabel: { color: colors.gray900, fontFamily: font.bold, fontSize: 14 },
  savedMeta: { color: colors.gray600, fontFamily: font.medium, fontSize: 11, marginTop: 3 },
  cardRight: { alignItems: 'center', justifyContent: 'center' },
  defaultChip: { color: colors.greenDark, fontFamily: font.bold, fontSize: 10, marginBottom: 4 },
  emptyState: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  emptyTitle: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 15 },
  emptyText: { color: colors.gray600, fontFamily: font.medium, fontSize: 11, lineHeight: 17, marginTop: 6 },
  note: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, ...shadow.sm },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 13 },
  noteText: { color: colors.gray600, fontFamily: font.medium, fontSize: 11, marginTop: 5, lineHeight: 17 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: colors.gray200, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 22 },
  modalSubtitle: { color: colors.gray600, fontFamily: font.medium, fontSize: 12, marginTop: 4, marginBottom: spacing.md },
  inputLabel: { color: colors.gray700, fontFamily: font.bold, fontSize: 12, marginBottom: 8, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.gray900,
    fontFamily: font.medium,
    fontSize: 14,
    marginBottom: 8,
  },
  cardError: { color: '#B91C1C', fontFamily: font.medium, fontSize: 12, lineHeight: 17, marginTop: 2 },
  twoFieldRow: { flexDirection: 'row', alignItems: 'flex-start' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  secondaryAction: {
    flex: 1,
    marginRight: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryActionText: { color: colors.gray700, fontFamily: font.bold, fontSize: 14 },
  primaryAction: {
    flex: 1,
    marginLeft: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.green,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryActionText: { color: colors.white, fontFamily: font.bold, fontSize: 14 },
});
