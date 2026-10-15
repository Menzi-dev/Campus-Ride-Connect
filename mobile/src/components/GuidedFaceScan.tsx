// Native face-scan entry: explain that this guided scan must be opened through the secure web
// client. This component does not perform the browser landmark checks.
// Where: mobile/src/components/GuidedFaceScan.tsx.
// How: GuidedFaceScan() renders native guidance to open the secure web flow. GuidedFaceScan.web.tsx
// contains the working browser camera and landmark scan.
/** Defines shared face-scan results and the native fallback; the web file implements the scanner. */
import React from 'react';
import { Text, View } from 'react-native';
export type FaceScanResult = { image: string; method: string; completedAt: string; challenges: string[] };
export default function GuidedFaceScan(_props: { onComplete: (result: FaceScanResult) => void; purpose?: 'enrollment' | 'ride' }) {
  return <View style={{ padding: 24 }}><Text>Guided face scanning is currently available in the web app. Open the secure HTTPS link in your browser to enroll.</Text></View>;
}
