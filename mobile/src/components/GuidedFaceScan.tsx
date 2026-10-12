import React from 'react';
import { Text, View } from 'react-native';
export type FaceScanResult = { image: string; method: string; completedAt: string; challenges: string[] };
export default function GuidedFaceScan(_props: { onComplete: (result: FaceScanResult) => void; purpose?: 'enrollment' | 'ride' }) {
  return <View style={{ padding: 24 }}><Text>Guided face scanning is currently available in the web app. Open the secure HTTPS link in your browser to enroll.</Text></View>;
}
