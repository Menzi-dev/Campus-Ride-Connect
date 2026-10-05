import React, { useEffect } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { RiderTab, isRiderTab } from './BottomNav';
import { needsTopInset, needsBottomInset } from '../navigation/screenChrome';

type Props = {
  routeName: string;
  onSelectTab: (tab: RiderTab) => void;
  children: React.ReactNode;
};

/** The navigator can shrink; the shared rider dock never participates in page scrolling. */
export default function AppLayout({ routeName, onSelectTab, children }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rider = isRiderTab(routeName);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const viewport = document.querySelector('meta[name="viewport"]');
    const content = viewport?.getAttribute('content') || 'width=device-width, initial-scale=1';
    if (viewport && !content.includes('viewport-fit=')) {
      viewport.setAttribute('content', `${content}, viewport-fit=cover`);
    }
  }, []);

  return (
    <View style={[styles.viewport, Platform.OS === 'web' && { height, flex: undefined }]}>
      <View style={[styles.frame, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <View testID="app-page-area" style={[styles.pages, { paddingTop: needsTopInset(routeName) ? insets.top : 0, paddingBottom: needsBottomInset(routeName) ? insets.bottom : 0 }]}>
          {children}
        </View>
        {rider && <BottomNav active={routeName} onSelectTab={onSelectTab} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, minHeight: 0, minWidth: 0, width: '100%', backgroundColor: '#f3f4f6' },
  frame: { flex: 1, minHeight: 0, minWidth: 0, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  pages: { flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' },
});
