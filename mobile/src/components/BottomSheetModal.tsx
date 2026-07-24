import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { colors, radius, spacing, font } from '../theme/theme';

type BottomSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function BottomSheetModal({ visible, onClose, title, subtitle, children }: BottomSheetModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.divider} />
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.white,
    maxHeight: '70%',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 18,
  },
  handle: {
    width: 56,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.gray200,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: font.extrabold,
    fontSize: 18,
    color: colors.gray900,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.gray500,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginBottom: spacing.lg,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  closeButton: {
    marginTop: spacing.sm,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
  },
  closeText: {
    fontFamily: font.semibold,
    color: colors.gray700,
    fontSize: 14,
  },
});
