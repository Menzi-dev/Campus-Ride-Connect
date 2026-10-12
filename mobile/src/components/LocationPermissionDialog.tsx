import React, { useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function LocationPermissionDialog({ message, onClose, onRetry }: {
  message: string | null; onClose: () => void; onRetry: () => void;
}) {
  const [settingsError, setSettingsError] = useState('');
  const web = Platform.OS === 'web';
  const iphone = web && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const instructions = web
    ? iphone
      ? '1. Open iPhone Settings → Privacy & Security → Location Services and turn it on.\n\n2. Select the browser you are using (such as Edge or Safari Websites). Allow location while using it and enable Precise Location.\n\n3. In the browser’s settings for this website, allow Location. If you opened this link inside WhatsApp, open it in Safari or Edge.\n\n4. Return here and tap Try Again.'
      : 'Turn on Location in your device settings. Allow location for your browser, then allow Location in this website’s permissions. Return here and tap Try Again.'
    : 'Enable location access for CampusConnect and turn on your device’s location services. Return here and tap Try Again.';

  return <Modal visible={message !== null} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View style={styles.card} accessibilityViewIsModal>
        <ScrollView>
          <Text style={styles.title} accessibilityRole="header">Enable your location</Text>
          <Text style={styles.body}>Use your current location to set your pickup.</Text>
          <Text style={styles.body}>{message}</Text>
          <Text style={styles.body}>{instructions}</Text>
          {web && <Text style={styles.hint}>Your browser cannot open phone settings directly. Please open Settings yourself.</Text>}
          {!!settingsError && <Text style={styles.body}>{settingsError}</Text>}
          {!web && <Pressable accessibilityRole="button" style={styles.primary} onPress={async () => {
            try {
              if (Platform.OS === 'android' && message?.includes('services are turned off')) {
                await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
              } else {
                await Linking.openSettings();
              }
            } catch { setSettingsError('Could not open settings. Please open your device Settings manually.'); }
          }}><Text style={styles.primaryText}>Open Settings</Text></Pressable>}
          <Pressable accessibilityRole="button" style={styles.primary} onPress={onRetry}><Text style={styles.primaryText}>Try Again / Allow Location</Text></Pressable>
          <Pressable accessibilityRole="button" style={styles.secondary} onPress={onClose}><Text style={styles.secondaryText}>Choose pickup manually</Text></Pressable>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, maxHeight: '90%', backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  title: { fontSize: 23, fontWeight: '700', color: '#18212b', marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, color: '#334155', marginBottom: 14 },
  hint: { fontSize: 13, lineHeight: 19, color: '#64748b', marginBottom: 18 },
  primary: { padding: 15, backgroundColor: '#00a651', borderRadius: 12, alignItems: 'center', marginTop: 10 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary: { padding: 15, alignItems: 'center' },
  secondaryText: { color: '#475569', fontSize: 15 },
});
