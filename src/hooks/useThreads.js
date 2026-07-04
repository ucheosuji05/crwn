import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { threadService } from '../services/threadService';
import { supabase } from '../config/supabase';
import { useAuth } from './useAuth';
import { useBlock } from '../context/BlockContext';

/**
 * useThreads
 *
 * Fetches all threads from Supabase and, if a user is logged in,
 * also fetches the set of thread IDs they have already upvoted.
 * Client-side filtering (category, search) is done in ThreadList
 * to avoid re-fetching on every keystroke or tab switch.
 */
export const useThreads = () => {
  const { user } = useAuth();
  const { allHiddenIds } = useBlock();

  const [threads, setThreads] = useState([]);
  const [upvotedIds, setUpvotedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const debounceTimer = useRef(null);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [threadsResult, upvotesResult] = await Promise.all([
      threadService.getThreads(),
      threadService.getUpvotedThreadIds(),
    ]);

    if (threadsResult.error) {
      setError(threadsResult.error);
      console.error('Error fetching threads:', threadsResult.error);
    } else {
      setThreads(threadsResult.data || []);
    }

    setUpvotedIds(new Set(upvotesResult.ids || []));
    setLoading(false);
  }, [user]);

  // Silent refresh (no loading spinner) used by realtime handlers
  const silentRefetch = useCallback(async () => {
    const [threadsResult, upvotesResult] = await Promise.all([
      threadService.getThreads(),
      threadService.getUpvotedThreadIds(),
    ]);
    if (!threadsResult.error) setThreads(threadsResult.data || []);
    setUpvotedIds(new Set(upvotesResult.ids || []));
  }, [user]);

  useEffect(() => {
    fetchThreads();

    const debounce = (fn, ms) => {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(fn, ms);
    };

    const channel = supabase
      .channel('threads-realtime')
      // New thread posted by anyone
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threads' },
        () => debounce(silentRefetch, 500))
      // Thread edited
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'threads' },
        () => debounce(silentRefetch, 400))
      // Thread deleted — remove from state immediately
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'threads' },
        (payload) => {
          if (payload.old?.id) removeThread(payload.old.id);
        })
      // Upvote added/removed — refresh counts
      .on('postgres_changes', { event: '*', schema: 'public', table: 'thread_upvotes' },
        () => debounce(silentRefetch, 300))
      // Reply added/removed — refresh reply counts
      .on('postgres_changes', { event: '*', schema: 'public', table: 'thread_replies' },
        () => debounce(silentRefetch, 300))
      .subscribe();

    return () => {
      clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, [fetchThreads, silentRefetch]);

  /**
   * Optimistically update a thread's upvote count and the upvotedIds set.
   * Called from ThreadCard after a successful (or optimistic) toggle.
   */
  const toggleUpvoteLocally = useCallback((threadId, isNowUpvoted) => {
    setUpvotedIds((prev) => {
      const next = new Set(prev);
      if (isNowUpvoted) next.add(threadId);
      else next.delete(threadId);
      return next;
    });
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        const currentCount = Number(t.upvotes?.[0]?.count ?? 0);
        return {
          ...t,
          upvotes: [{ count: isNowUpvoted ? currentCount + 1 : currentCount - 1 }],
        };
      })
    );
  }, []);

  /**
   * Prepend a freshly created thread to the list without refetching.
   */
  const prependThread = useCallback((thread) => {
    setThreads((prev) => [thread, ...prev]);
  }, []);

  /**
   * Remove a thread from the list after it has been deleted.
   */
  const removeThread = useCallback((threadId) => {
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
  }, []);

  const visibleThreads = useMemo(
    () => threads.filter(t => !allHiddenIds.has(t.user_id)),
    [threads, allHiddenIds]
  );

  return {
    threads: visibleThreads,
    upvotedIds,
    loading,
    error,
    refresh: fetchThreads,
    toggleUpvoteLocally,
    prependThread,
    removeThread,
  };
};