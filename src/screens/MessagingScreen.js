import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { useUnreadCount } from '../context/UnreadCountContext';
import { messagingService } from '../services/messagingService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateString) {
  if (!dateString) return '';
  const diff = Date.now() - new Date(dateString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins < 1)   return 'now';
  if (mins < 60)  return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7)   return `${days}d`;
  return new Date(dateString).toLocaleDateString();
}

function formatTimestamp(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const datePart = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

function Avatar({ uri, name, size = 48 }) {
  const { colors } = useTheme();
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[{ backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: '#fff', fontFamily: 'Figtree_700Bold', fontSize: size * 0.38 }}>
        {(name || '?')[0].toUpperCase()}
      </Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MessagingScreen() {
  const navigation  = useNavigation();
  const route       = useRoute();
  const { user }    = useAuth();
  const { colors }  = useTheme();
  const { refreshMessages } = useUnreadCount();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Inbox state
  const [conversations, setConversations] = useState([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [unreadConvoIds, setUnreadConvoIds] = useState(new Set());

  // Active chat state
  const [activeConvo, setActiveConvo]   = useState(null); // { id, otherUser }
  const [messages, setMessages]         = useState([]);
  const [loadingMsgs, setLoadingMsgs]   = useState(false);
  const [messageText, setMessageText]   = useState('');
  const [sending, setSending]           = useState(false);

  // New message modal state
  const [newMsgVisible, setNewMsgVisible]   = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState([]);
  const [searchLoading, setSearchLoading]   = useState(false);

  const flatListRef = useRef(null);
  const channelRef  = useRef(null);
  const convoChannelRef = useRef(null);

  // ── Load conversations ──────────────────────────────────────────────────────

  const computeUnreadIds = useCallback(async (convos, userId) => {
    const ids = new Set();
    await Promise.all(
      convos.map(async (c) => {
        if (!c.last_sender_id || c.last_sender_id === userId) return;
        const readAt = await AsyncStorage.getItem(`@msg_read_${c.id}`);
        if (!readAt || new Date(c.last_message_at) > new Date(readAt)) {
          ids.add(c.id);
        }
      })
    );
    setUnreadConvoIds(ids);
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    setLoadingConvos(true);
    const { data } = await messagingService.getConversations(user.id);
    if (data) {
      setConversations(data);
      computeUnreadIds(data, user.id);
    }
    setLoadingConvos(false);
  }, [user?.id, computeUnreadIds]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Subscribe to conversation updates (inbox refreshes when new message arrives)
  useEffect(() => {
    if (!user?.id) return;
    const channel = messagingService.subscribeToConversations(user.id, () => {
      loadConversations();
    });
    convoChannelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [user?.id, loadConversations]);

  // ── Open a conversation ─────────────────────────────────────────────────────

  const openConversation = async (convo) => {
    const otherUser =
      convo.participant1_id === user.id ? convo.participant2 : convo.participant1;

    // Mark as read before any async work so the subscription's computeUnreadIds
    // sees the updated AsyncStorage timestamp if it fires during getMessages()
    await messagingService.markConversationRead(convo.id);
    setUnreadConvoIds(prev => { const next = new Set(prev); next.delete(convo.id); return next; });
    refreshMessages();

    setActiveConvo({ id: convo.id, otherUser });
    setMessages([]);
    setLoadingMsgs(true);

    const { data } = await messagingService.getMessages(convo.id);
    setMessages(data || []);
    setLoadingMsgs(false);

    // Subscribe to new messages
    if (channelRef.current) channelRef.current.unsubscribe();
    const channel = messagingService.subscribeToMessages(convo.id, (payload) => {
      const newMsg = payload.new;
      setMessages(prev => {
        // Already have this exact message ID — skip
        if (prev.find(m => m.id === newMsg.id)) return prev;

        // If it's our own message, swap out the optimistic placeholder
        // (identified by the opt- prefix + matching content)
        if (newMsg.sender_id === user.id) {
          const optIdx = prev.findIndex(
            m => typeof m.id === 'string' && m.id.startsWith('opt-') && m.content === newMsg.content
          );
          if (optIdx !== -1) {
            const next = [...prev];
            next[optIdx] = newMsg;
            return next;
          }
        }

        return [...prev, newMsg];
      });
    });
    channelRef.current = channel;
  };

  // Scroll to bottom whenever messages update
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages]);

  // Unsubscribe from message channel when leaving chat
  const closeChat = () => {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setActiveConvo(null);
    setMessages([]);
    setMessageText('');
  };

  // ── Send message ────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!messageText.trim() || sending || !activeConvo) return;
    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    // Optimistic insert — realtime will replace this with the real message
    const optimisticId = `opt-${Date.now()}`;
    const optimistic = {
      id: optimisticId,
      conversation_id: activeConvo.id,
      sender_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    const { error } = await messagingService.sendMessage(activeConvo.id, user.id, text);
    if (error) {
      // Roll back on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setMessageText(text);
    }
    // On success: the realtime subscription replaces the optimistic with the real row
    setSending(false);
  };

  // ── New message — user search ───────────────────────────────────────────────

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await messagingService.searchUsers(searchQuery, user.id);
      setSearchResults(data || []);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, user?.id]);

  const startConversation = async (otherUser) => {
    setNewMsgVisible(false);
    setSearchQuery('');
    setSearchResults([]);

    const { data, error } = await messagingService.getOrCreateConversation(user.id, otherUser.id);
    if (error || !data) return;

    // Build a synthetic convo object so we can open the chat immediately
    const syntheticConvo = {
      ...data,
      participant1: data.participant1_id === user.id ? { id: user.id } : otherUser,
      participant2: data.participant2_id === user.id ? { id: user.id } : otherUser,
    };
    openConversation(syntheticConvo);

    // Refresh inbox
    loadConversations();
  };

  // ── Auto-open conversation when navigated with recipientId param ──────────────
  useEffect(() => {
    const recipientId   = route.params?.recipientId;
    const recipientName = route.params?.recipientName;
    if (!recipientId || !user?.id) return;

    // Clear the params immediately so navigating back and forward doesn't re-open
    navigation.setParams({ recipientId: undefined, recipientName: undefined });

    startConversation({ id: recipientId, full_name: recipientName, username: recipientName });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.recipientId]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getOtherUser = (convo) =>
    convo.participant1_id === user.id ? convo.participant2 : convo.participant1;

  // ── Render: Chat view ───────────────────────────────────────────────────────

  if (activeConvo) {
    return (
      <SafeAreaView style={[styles.safeArea, Platform.OS === 'web' && { height: '100vh', maxHeight: '100vh' }]} edges={['top']}>
        {/* Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity
            onPress={closeChat}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.chatHeaderName} numberOfLines={1}>
            {activeConvo.otherUser?.full_name || activeConvo.otherUser?.username || 'User'}
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('UserProfile', { viewedUserId: activeConvo.otherUser?.id })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Avatar
              uri={activeConvo.otherUser?.avatar_url}
              name={activeConvo.otherUser?.full_name || activeConvo.otherUser?.username}
              size={36}
            />
          </TouchableOpacity>
        </View>

        {/* Messages — flex: 1 + minHeight: 0 + overflow hidden pins list inside viewport on web */}
        <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {loadingMsgs ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyChat}>No messages yet. Say hi!</Text>
              }
              renderItem={({ item, index }) => {
                const isMine = item.sender_id === user.id;
                const prevMsg = messages[index - 1];
                const showTime =
                  !prevMsg ||
                  new Date(item.created_at) - new Date(prevMsg.created_at) > 5 * 60 * 1000;

                return (
                  <View>
                    {showTime && (
                      <Text style={styles.msgTimeSeparator}>
                        {formatTimestamp(item.created_at)}
                      </Text>
                    )}
                    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                          {item.content}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>

        {/* Input — always pinned to bottom */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.inputRow, { paddingBottom: insets.bottom > 0 ? insets.bottom - 16 : 10 }]}>
            <TextInput
              style={styles.chatInput}
              placeholder="Message..."
              placeholderTextColor={colors.placeholder}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !messageText.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!messageText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color={messageText.trim() ? '#fff' : '#d1d5db'} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Render: Inbox ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Messages</Text>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setNewMsgVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="create-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Conversation list */}
      {loadingConvos ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>
            Start a conversation with someone in the community.
          </Text>
          <TouchableOpacity style={styles.newMsgBtn} onPress={() => setNewMsgVisible(true)}>
            <Text style={styles.newMsgBtnText}>New Message</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          extraData={unreadConvoIds}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loadingConvos}
              onRefresh={loadConversations}
              tintColor="#5D1F1F"
              colors={['#5D1F1F']}
            />
          }
          renderItem={({ item }) => {
            const other = getOtherUser(item);
            const isUnread = unreadConvoIds.has(item.id);
            return (
              <TouchableOpacity
                style={[styles.convoRow, isUnread && styles.convoRowUnread]}
                onPress={() => openConversation(item)}
                activeOpacity={0.7}
              >
                <Avatar
                  uri={other?.avatar_url}
                  name={other?.full_name || other?.username}
                  size={50}
                />
                <View style={styles.convoInfo}>
                  <Text style={[styles.convoName, isUnread && styles.convoNameUnread]} numberOfLines={1}>
                    {other?.full_name || other?.username || 'User'}
                  </Text>
                  <Text style={[styles.convoPreview, isUnread && styles.convoPreviewUnread]} numberOfLines={1}>
                    {item.last_message || 'Start the conversation'}
                  </Text>
                </View>
                <View style={styles.convoMeta}>
                  <Text style={styles.convoTime}>{timeAgo(item.last_message_at)}</Text>
                  {isUnread && <View style={styles.unreadDot} />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* New Message Modal */}
      <Modal
        visible={newMsgVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setNewMsgVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Message</Text>
            <TouchableOpacity
              onPress={() => { setNewMsgVisible(false); setSearchQuery(''); setSearchResults([]); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchInputRow}>
            <Ionicons name="search-outline" size={18} color="#9ca3af" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or username..."
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {searchLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                searchQuery.trim().length > 0 ? (
                  <Text style={styles.searchEmpty}>No users found for "{searchQuery}"</Text>
                ) : null
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchRow}
                  onPress={() => startConversation(item)}
                  activeOpacity={0.7}
                >
                  <Avatar uri={item.avatar_url} name={item.full_name || item.username} size={44} />
                  <View style={styles.searchRowText}>
                    <Text style={styles.searchRowName}>{item.full_name || item.username}</Text>
                    {item.username && (
                      <Text style={styles.searchRowUsername}>@{item.username}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.border} />
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.surface },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
    backgroundColor: c.surface,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'LibreBaskerville_700Bold',
    color: c.text,
  },

  // ── Avatar fallback ──
  avatarFallback: {
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontFamily: 'Figtree_700Bold',
  },

  // ── Empty state ──
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  newMsgBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  newMsgBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
  },

  // ── Conversation row ──
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
    backgroundColor: c.surface,
    gap: 12,
  },
  convoRowUnread: { backgroundColor: c.unread },
  convoInfo: { flex: 1 },
  convoName: {
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
    marginBottom: 3,
  },
  convoNameUnread: { color: c.primary },
  convoPreview: {
    fontSize: 13,
    color: c.textMuted,
  },
  convoPreviewUnread: {
    color: c.textSecondary,
    fontFamily: 'Figtree_500Medium',
  },
  convoMeta: { alignItems: 'flex-end', gap: 6 },
  convoTime: {
    fontSize: 12,
    color: c.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.primary,
  },

  // ── Chat header ──
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
    backgroundColor: c.surface,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
  },

  // ── Messages list ──
  messagesList: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  emptyChat: {
    textAlign: 'center',
    color: c.textMuted,
    fontSize: 14,
    marginTop: 60,
  },
  msgTimeSeparator: {
    textAlign: 'center',
    fontSize: 11,
    color: c.textMuted,
    marginVertical: 10,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: c.isDark ? '#C8860A' : c.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: c.surfaceAlt,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    color: c.text,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: '#fff',
  },

  // ── Input row ──
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: c.borderLight,
    gap: 8,
    backgroundColor: c.surface,
  },
  chatInput: {
    flex: 1,
    backgroundColor: c.inputBackground,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: c.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: c.border,
  },

  // ── New message modal ──
  modalSafe: { flex: 1, backgroundColor: c.surface },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
    backgroundColor: c.surface,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: c.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: c.text,
  },
  searchEmpty: {
    textAlign: 'center',
    color: c.textMuted,
    fontSize: 14,
    marginTop: 24,
    paddingHorizontal: 24,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
    backgroundColor: c.surface,
  },
  searchRowText: { flex: 1 },
  searchRowName: {
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
  },
  searchRowUsername: {
    fontSize: 13,
    color: c.textMuted,
    marginTop: 1,
  },
});
