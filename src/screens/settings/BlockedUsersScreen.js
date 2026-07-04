import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useBlock } from '../../context/BlockContext';
import { supabase } from '../../config/supabase';

export default function BlockedUsersScreen({ onBack }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { unblockUser } = useBlock();

  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState(null);

  useEffect(() => {
    loadBlocked();
  }, []);

  const loadBlocked = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: blocks } = await supabase
        .from('user_blocks')
        .select('id, blocked_id, created_at')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });

      if (!blocks?.length) { setBlocked([]); setLoading(false); return; }

      const ids = blocks.map(b => b.blocked_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', ids);

      setBlocked(
        blocks.map(b => ({
          ...b,
          profile: profiles?.find(p => p.id === b.blocked_id) || null,
        }))
      );
    } catch (_) {}
    setLoading(false);
  };

  const handleUnblock = (item, name) => {
    Alert.alert(
      `Unblock ${name || 'user'}?`,
      'They will be able to see your profile and posts again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblocking(item.id);
            await unblockUser(item.blocked_id);
            setBlocked(prev => prev.filter(b => b.id !== item.id));
            setUnblocking(null);
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const name = item.profile?.full_name || item.profile?.username || 'Unknown user';
    const avatar = item.profile?.avatar_url;
    return (
      <View style={styles.row}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={18} color={colors.textMuted} />
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <TouchableOpacity
          style={styles.unblockBtn}
          onPress={() => handleUnblock(item, name)}
          disabled={unblocking === item.id}
        >
          {unblocking === item.id
            ? <ActivityIndicator size="small" color="#5D1F1F" />
            : <Text style={styles.unblockText}>Unblock</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Users</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : blocked.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="ban-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No blocked users</Text>
          <Text style={styles.emptySubText}>
            Users you block won't be able to find your profile or posts.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
    backgroundColor: c.background,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Figtree_600SemiBold', color: c.text },
  placeholder: { width: 40 },
  loader: { marginTop: 40 },
  list: { paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderLight,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: c.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Figtree_500Medium',
    color: c.text,
  },
  unblockBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5D1F1F',
    minWidth: 80,
    alignItems: 'center',
  },
  unblockText: {
    fontSize: 13,
    fontFamily: 'Figtree_600SemiBold',
    color: '#5D1F1F',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 17,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: 'Figtree_400Regular',
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
