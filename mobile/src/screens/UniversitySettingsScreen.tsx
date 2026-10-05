import ConfirmationDialog from '../components/ConfirmationDialog';
import { useToast } from '../components/Toast';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, Building2, Check, ChevronRight, Clock3, Mail, Phone, Save, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { NavigationAction, useFocusEffect, useNavigation, usePreventRemove } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import apiClient from '../services/ApiClient';
import { colors, font, radius, shadow, spacing } from '../theme/theme';

type RootStackParamList = { AdminDashboard: undefined; UniversitySettings: undefined };
type Settings = {
  universityName: string;
  emailDomain: string;
  campusSecurityPhone: string;
  sosResponseTimeSeconds: number;
  firstYearPriorityMatching: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  universityName: 'Sol Plaatje University',
  emailDomain: '@spu.ac.za',
  campusSecurityPhone: '+27 11 559 4555',
  sosResponseTimeSeconds: 60,
  firstYearPriorityMatching: true,
};

export default function UniversitySettingsScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();
  const [leaveAction, setLeaveAction] = useState<NavigationAction | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const loadSettings = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const response = await apiClient.get('/admin/settings');
      setSettings({ ...DEFAULT_SETTINGS, ...response.data });
      setDirty(false);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load university settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadSettings(); }, [loadSettings]));

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  usePreventRemove(dirty, ({ data }) => setLeaveAction(data.action));

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('AdminDashboard');
  };

  const saveSettings = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiClient.put('/admin/settings', settings);
      setSettings({ ...DEFAULT_SETTINGS, ...response.data });
      setDirty(false);
      setError(null);
      showToast('University settings were updated successfully.', 'green');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not save university settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={colors.green} /><Text style={styles.loadingText}>Loading settings...</Text></View>;

  return <View style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={handleBack} accessibilityLabel="Back to admin dashboard"><ArrowLeft size={19} color={colors.greenDark} /><Text style={styles.backText}>Back</Text></TouchableOpacity>
      <View style={styles.headerRow}><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.title}>University Settings</Text><Text style={styles.subtitle}>Manage platform details and safety rules</Text></View><View style={styles.headerIcon}><ShieldCheck size={22} color={colors.greenDark} /></View></View>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadSettings(true)} tintColor={colors.green} />} contentContainerStyle={styles.content}>
      {error && <View style={styles.errorBanner}><TriangleAlert size={16} color={colors.red} /><Text style={styles.errorText}>{error}</Text></View>}
      <Text style={styles.sectionLabel}>INSTITUTION</Text>
      <SettingInput icon={<Building2 size={18} color={colors.gray500} />} label="University Name" value={settings.universityName} onChangeText={(value) => update('universityName', value)} />
      <SettingInput icon={<Mail size={18} color={colors.gray500} />} label="Email Domain" value={settings.emailDomain} onChangeText={(value) => update('emailDomain', value)} autoCapitalize="none" keyboardType="email-address" />
      <Text style={styles.sectionLabel}>SAFETY</Text>
      <SettingInput icon={<Phone size={18} color={colors.gray500} />} label="Campus Security" value={settings.campusSecurityPhone} onChangeText={(value) => update('campusSecurityPhone', value)} keyboardType="phone-pad" />
      <SettingInput icon={<Clock3 size={18} color={colors.gray500} />} label="SOS Response Time" value={String(settings.sosResponseTimeSeconds)} onChangeText={(value) => update('sosResponseTimeSeconds', Math.max(1, Number(value.replace(/[^0-9]/g, '')) || 0))} keyboardType="number-pad" suffix="seconds" />
      <View style={styles.toggleRow}><View style={styles.toggleCopy}><Text style={styles.toggleTitle}>First-Year Priority Matching</Text><Text style={styles.toggleSubtitle}>Match new students with top-rated drivers</Text></View><Switch value={settings.firstYearPriorityMatching} onValueChange={(value) => update('firstYearPriorityMatching', value)} trackColor={{ false: colors.gray300, true: colors.green }} thumbColor={colors.white} /></View>
      <TouchableOpacity style={[styles.saveButton, saving && styles.disabledButton]} onPress={saveSettings} disabled={saving}><>{saving ? <ActivityIndicator color={colors.white} /> : <Save size={17} color={colors.white} />}<Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Settings'}</Text></></TouchableOpacity>
      {dirty && <View style={styles.unsavedRow}><Check size={14} color={colors.orange} /><Text style={styles.unsavedText}>Unsaved changes</Text></View>}
    </ScrollView>
    <ConfirmationDialog
      visible={leaveAction !== null}
      title="Unsaved changes"
      message="Leave without saving your changes?"
      confirmLabel="Leave"
      cancelLabel="Stay"
      onCancel={() => setLeaveAction(null)}
      onConfirm={() => {
        const action = leaveAction;
        setLeaveAction(null);
        if (action) navigation.dispatch(action);
      }}
    />
  </View>;
}

function SettingInput({ icon, label, value, onChangeText, ...props }: { icon: React.ReactNode; label: string; value: string; onChangeText: (value: string) => void; suffix?: string; [key: string]: any }) {
  const suffix = props.suffix;
  return <View style={styles.inputCard}><View style={styles.inputIcon}>{icon}</View><View style={styles.inputContent}><Text style={styles.inputLabel}>{label}</Text><View style={styles.valueRow}><TextInput value={value} onChangeText={onChangeText} style={styles.input} accessibilityLabel={label} {...props} /><ChevronRight size={18} color={colors.gray300} /></View></View>{suffix && <Text style={styles.suffix}>{suffix}</Text>}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.gray50 }, centered: { alignItems: 'center', justifyContent: 'center' }, loadingText: { color: colors.gray500, fontFamily: font.medium, marginTop: spacing.md },
  header: { backgroundColor: colors.white, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: spacing.sm }, backText: { color: colors.greenDark, fontFamily: font.semibold, fontSize: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 24 }, subtitle: { color: colors.gray500, fontFamily: font.regular, fontSize: 12, marginTop: 3 }, headerIcon: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl }, sectionLabel: { color: colors.gray400, fontFamily: font.bold, fontSize: 11, letterSpacing: 0.7, marginTop: spacing.lg, marginBottom: spacing.sm },
  inputCard: { minHeight: 68, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', ...shadow.sm }, inputIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.gray50, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }, inputContent: { flex: 1, minWidth: 0 }, inputLabel: { color: colors.gray400, fontFamily: font.bold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }, valueRow: { flexDirection: 'row', alignItems: 'center' }, input: { flex: 1, color: colors.gray900, fontFamily: font.semibold, fontSize: 14, paddingVertical: 3, paddingHorizontal: 0 }, suffix: { color: colors.gray500, fontFamily: font.medium, fontSize: 11, marginLeft: spacing.xs },
  toggleRow: { backgroundColor: colors.white, borderRadius: radius.lg, minHeight: 68, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadow.sm }, toggleCopy: { flex: 1, paddingRight: spacing.md }, toggleTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 13 }, toggleSubtitle: { color: colors.gray500, fontFamily: font.regular, fontSize: 11, marginTop: 3 },
  saveButton: { minHeight: 48, borderRadius: radius.full, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginTop: spacing.xl, ...shadow.sm }, disabledButton: { opacity: 0.65 }, saveText: { color: colors.white, fontFamily: font.bold, fontSize: 14 }, unsavedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: spacing.md }, unsavedText: { color: colors.orange, fontFamily: font.medium, fontSize: 12 }, errorBanner: { backgroundColor: colors.redLight, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, errorText: { flex: 1, color: colors.red, fontFamily: font.medium, fontSize: 12 },
});
