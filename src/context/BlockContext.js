import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../hooks/useAuth';

const BlockContext = createContext({
  blockedIds: new Set(),    // users I have blocked
  allHiddenIds: new Set(),  // blockedIds ∪ users who have blocked me
  blockUser: async () => null,
  unblockUser: async () => null,
  isBlocked: () => false,   // true only if I explicitly blocked them (shows profile banner)
});

export function BlockProvider({ children }) {
  const { user } = useAuth();
  const [blockedIds, setBlockedIds]     = useState(new Set()); // I blocked them
  const [blockedByIds, setBlockedByIds] = useState(new Set()); // they blocked me

  useEffect(() => {
    if (!user?.id) {
      setBlockedIds(new Set());
      setBlockedByIds(new Set());
      return;
    }
    // Load both directions in parallel
    Promise.all([
      supabase.from('user_blocks').select('blocked_id').eq('blocker_id', user.id),
      supabase.from('user_blocks').select('blocker_id').eq('blocked_id', user.id),
    ]).then(([outgoing, incoming]) => {
      setBlockedIds(new Set((outgoing.data || []).map(r => r.blocked_id)));
      setBlockedByIds(new Set((incoming.data || []).map(r => r.blocker_id)));
    });
  }, [user?.id]);

  // Union of both sets — used for all feed/content filtering
  const allHiddenIds = useMemo(
    () => new Set([...blockedIds, ...blockedByIds]),
    [blockedIds, blockedByIds]
  );

  const blockUser = useCallback(async (userId) => {
    if (!user?.id || !userId) return null;
    const { error } = await supabase
      .from('user_blocks')
      .insert({ blocker_id: user.id, blocked_id: userId });
    if (!error) {
      setBlockedIds(prev => new Set([...prev, userId]));
    }
    return error;
  }, [user?.id]);

  const unblockUser = useCallback(async (userId) => {
    if (!user?.id || !userId) return null;
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', userId);
    if (!error) {
      setBlockedIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
    return error;
  }, [user?.id]);

  // Only true if I explicitly blocked them (drives the profile "You've blocked this user" banner)
  const isBlocked = useCallback((userId) => blockedIds.has(userId), [blockedIds]);

  return (
    <BlockContext.Provider value={{ blockedIds, allHiddenIds, blockUser, unblockUser, isBlocked }}>
      {children}
    </BlockContext.Provider>
  );
}

export const useBlock = () => useContext(BlockContext);
