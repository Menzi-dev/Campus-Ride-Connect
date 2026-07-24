import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { colors, radius, spacing, font } from '../theme/theme';

type ToastColor = 'green' | 'red' | 'blue' | 'yellow';

type ToastContextValue = {
  showToast: (message: string, color?: ToastColor) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; color: ToastColor } | null>(null);
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((message: string, color: ToastColor = 'green') => {
    setToast({ message, color });
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return;
    }

    const hideTimer = setTimeout(() => setVisible(false), 2600);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    return () => clearTimeout(hideTimer);
  }, [visible, opacity]);

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toast && (
        <Animated.View style={[styles.toast, { opacity }, toastStyles[toast.color]]} pointerEvents="none">
          <Text style={styles.message}>{toast.message}</Text>
          <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeArea} activeOpacity={0.8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const toastStyles = StyleSheet.create({
  green: { backgroundColor: colors.green },
  red: { backgroundColor: colors.red },
  blue: { backgroundColor: colors.blue },
  yellow: { backgroundColor: colors.yellow },
});

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.xxl,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  message: {
    flex: 1,
    color: colors.white,
    fontFamily: font.semibold,
    fontSize: 14,
  },
  closeArea: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  closeText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
