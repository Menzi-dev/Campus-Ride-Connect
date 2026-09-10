import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ArrowLeft, Send } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../services/ApiClient';
import { colors, font, spacing } from '../theme/theme';
import { useToast } from '../components/Toast';

type RootStackParamList = { Chat: { rideId: string; otherPartyName?: string } };
type Message = { id: number; senderId: number; message: string; sentAt: string; senderName?: string };

export default function ChatScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const response = await apiClient.get(`/rides/${route.params.rideId}/messages`);
      setMessages(response.data || []);
    } catch (error: any) {
      if (showLoader) showToast(error?.response?.data?.error || 'Could not load messages', 'red');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [route.params.rideId, showToast]);

  useEffect(() => {
    AsyncStorage.getItem('user').then((value) => {
      if (value) setUserId(Number(JSON.parse(value).id ?? JSON.parse(value).userId));
    });
    loadMessages(true);
    const interval = setInterval(() => loadMessages(), 3000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const sendMessage = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      const response = await apiClient.post(`/rides/${route.params.rideId}/messages`, { message });
      setMessages((current) => [...current, response.data]);
      setDraft('');
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Could not send message', 'red');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={styles.title}>{route.params.otherPartyName || 'Ride messages'}</Text>
        <View style={styles.headerSpacer} />
      </View>
      {loading ? <ActivityIndicator style={styles.loader} color={colors.green} /> : (
        <FlatList
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const mine = item.senderId === userId;
            return <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}><Text style={styles.message}>{item.message}</Text><Text style={styles.time}>{new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View>;
          }}
          ListEmptyComponent={<Text style={styles.empty}>No messages yet.</Text>}
        />
      )}
      <View style={styles.composer}>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Type a message" placeholderTextColor={colors.gray400} style={styles.input} maxLength={1000} multiline />
        <TouchableOpacity onPress={sendMessage} disabled={!draft.trim() || sending} style={styles.send} accessibilityLabel="Send message">
          {sending ? <ActivityIndicator color={colors.white} size="small" /> : <Send size={18} color={colors.white} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { padding: spacing.lg, paddingTop: spacing.xxl, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  title: { flex: 1, textAlign: 'center', fontFamily: font.bold, fontSize: 17, color: colors.gray900 },
  headerSpacer: { width: 22 },
  loader: { marginTop: spacing.xxl },
  list: { padding: spacing.lg, flexGrow: 1, justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', padding: spacing.md, borderRadius: 16, marginBottom: spacing.sm },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.green },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200 },
  message: { fontFamily: font.regular, fontSize: 15, color: colors.gray900 },
  time: { alignSelf: 'flex-end', marginTop: 4, fontFamily: font.regular, fontSize: 10, color: colors.gray500 },
  empty: { textAlign: 'center', color: colors.gray500, fontFamily: font.regular },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray200 },
  input: { flex: 1, maxHeight: 100, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 12, backgroundColor: colors.gray100, color: colors.gray900, fontFamily: font.regular },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green },
});