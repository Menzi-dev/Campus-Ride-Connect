import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
type ChatScreenProps = { rideId?: string; otherPartyName?: string; onClose?: () => void };

export default function ChatScreen({ rideId: rideIdProp, otherPartyName: otherPartyNameProp, onClose }: ChatScreenProps = {}) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const rideId = rideIdProp || route.params?.rideId;
  const otherPartyName = otherPartyNameProp || route.params?.otherPartyName;
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const seenMessageIdsRef = useRef<Set<number>>(new Set());

  const loadMessages = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const response = await apiClient.get(`/rides/${rideId}/messages`);
      const data: Message[] = response.data || [];
      setLoadError('');
      const isFirstLoad = seenMessageIdsRef.current.size === 0;
      const incoming = data.filter((message) => message.senderId !== userId && !seenMessageIdsRef.current.has(message.id));
      data.forEach((message) => seenMessageIdsRef.current.add(message.id));
      setMessages(data);
      if (!isFirstLoad && incoming.length > 0) {
        const latest = incoming[incoming.length - 1];
        showToast(`${latest.senderName || 'New message'}: ${latest.message}`, 'blue');
      }
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Could not load messages';
      setLoadError(message);
      if (showLoader) showToast(message, 'red');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [rideId, showToast, userId]);

  const refreshMessages = async () => {
    setRefreshing(true);
    try {
      await loadMessages();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem('user').then((value) => {
      if (value) setUserId(Number(JSON.parse(value).id ?? JSON.parse(value).userId));
    });
    loadMessages(true);
    const interval = setInterval(() => loadMessages(), 3000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  const sendMessage = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      const response = await apiClient.post(`/rides/${rideId}/messages`, { message });
      seenMessageIdsRef.current.add(response.data.id);
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
        <TouchableOpacity onPress={onClose || (() => navigation.goBack())} accessibilityLabel="Close messages">
          <ArrowLeft size={22} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={styles.title}>{otherPartyName || 'Ride messages'}</Text>
        <View style={styles.headerSpacer} />
      </View>
      {loading ? <ActivityIndicator style={styles.loader} color={colors.green} /> : (
        <FlatList
          ref={listRef}
          data={messages}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshMessages} tintColor={colors.green} />}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const mine = item.senderId === userId;
            const previous = messages[index - 1];
            const showSender = !mine && (!previous || previous.senderId !== item.senderId);
            return (
              <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
                {!mine && <View style={styles.avatar}><Text style={styles.avatarText}>{(item.senderName || '?').slice(0, 1).toUpperCase()}</Text></View>}
                <View style={{ maxWidth: '74%' }}>
                  {showSender && <Text style={styles.senderName}>{item.senderName || 'Them'}</Text>}
                  <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    <Text style={[styles.message, mine && styles.messageMine]}>{item.message}</Text>
                    <Text style={[styles.time, mine && styles.timeMine]}>{new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{loadError ? 'Chat unavailable' : 'No messages yet'}</Text>
              <Text style={styles.empty}>{loadError || 'Say hello to your driver.'}</Text>
              {loadError ? <TouchableOpacity onPress={refreshMessages} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></TouchableOpacity> : null}
            </View>
          }
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
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: spacing.sm },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 11, color: colors.greenDark },
  senderName: { fontFamily: font.medium, fontSize: 11, color: colors.gray400, marginBottom: 3, marginLeft: 4 },
  bubble: { padding: spacing.md, borderRadius: 16 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.green, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, borderBottomLeftRadius: 4 },
  message: { fontFamily: font.regular, fontSize: 15, color: colors.gray900 },
  messageMine: { color: colors.white },
  time: { alignSelf: 'flex-end', marginTop: 4, fontFamily: font.regular, fontSize: 10, color: colors.gray500 },
  timeMine: { color: 'rgba(255,255,255,0.8)' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { textAlign: 'center', color: colors.gray800, fontFamily: font.bold, fontSize: 16, marginBottom: 4 },
  empty: { textAlign: 'center', color: colors.gray500, fontFamily: font.regular },
  retryButton: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 999, backgroundColor: colors.green },
  retryText: { color: colors.white, fontFamily: font.semibold, fontSize: 13 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray200 },
  input: { flex: 1, maxHeight: 100, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 12, backgroundColor: colors.gray100, color: colors.gray900, fontFamily: font.regular },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green },
});