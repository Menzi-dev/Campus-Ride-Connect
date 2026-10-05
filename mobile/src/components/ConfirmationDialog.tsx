import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from './Button';
import ScrollableCard from './ScrollableCard';
import { colors, font, radius, spacing } from '../theme/theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmationDialog({ visible, title, message, confirmLabel, cancelLabel = 'Cancel', busy = false, destructive = false, onConfirm, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onCancel()}>
      <View style={[styles.overlay, { paddingTop: spacing.lg + insets.top, paddingBottom: spacing.lg + insets.bottom }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && onCancel()} accessibilityLabel="Close confirmation" />
        <ScrollableCard style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={busy} style={styles.action} />
            <Button label={confirmLabel} variant={destructive ? 'red' : 'green'} onPress={onConfirm} disabled={busy} loading={busy} style={styles.action} />
          </View>
        </ScrollableCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, backgroundColor: 'rgba(17,24,39,0.45)' },
  card: { width: '100%', maxWidth: 420, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.white },
  title: { fontFamily: font.bold, fontSize: 20, color: colors.gray900 },
  message: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.gray600, marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  action: { flexGrow: 1, flexBasis: 120, minWidth: 0 },
});
