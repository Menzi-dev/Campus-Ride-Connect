import React from 'react';
import { ScrollView, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';

/** Preserve a dialog's design while keeping its actions reachable on short screens. */
export default function ScrollableCard({ style, children }: { style: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const {
    padding, paddingHorizontal, paddingVertical, paddingTop, paddingBottom, paddingLeft, paddingRight,
    alignItems, justifyContent, gap, rowGap, columnGap, ...frame
  } = StyleSheet.flatten(style) || {};
  return (
    <View style={[frame, { maxHeight: '90%', flexShrink: 1, minHeight: 0, overflow: 'hidden' }]}>
      <ScrollView
        style={{ flexGrow: 0, flexShrink: 1, minHeight: 0, width: '100%' }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding, paddingHorizontal, paddingVertical, paddingTop, paddingBottom, paddingLeft, paddingRight, alignItems, justifyContent, gap, rowGap, columnGap }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
