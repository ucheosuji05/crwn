import { supabase } from '../config/supabase';
import { getAuthToken } from '../lib/auth-client';
import { AUTH_URL } from '../lib/auth-url';

async function authedFetch(path, options = {}) {
  const token = getAuthToken();
  return fetch(`${AUTH_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

export const threadService = {

  // ─────────────────────────────────────────────
  // THREADS
  // ─────────────────────────────────────────────

  /**
   * Fetch all threads, newest first.
   * Includes author profile, upvote count, and reply count via aggregate joins.
   */
  async getThreads({ limit = 50, offset = 0 } = {}) {
    const { data, error } = await supabase
      .from('threads')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url,
          is_stylist
        ),
        upvotes:thread_upvotes(count),
        replies:thread_replies(count)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data, error };
  },

  /**
   * Fetch a single thread by id with full details.
   */
  async getThread(threadId) {
    const { data, error } = await supabase
      .from('threads')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url,
          is_stylist
        ),
        upvotes:thread_upvotes(count),
        replies:thread_replies(count)
      `)
      .eq('id', threadId)
      .single();

    return { data, error };
  },

  /**
   * Create a new thread. Routed through the server so the service role key
   * bypasses Supabase RLS (anon client has no session, so auth.uid() would
   * be null and the insert policy `auth.uid() = user_id` would reject it).
   * Returns the full thread row with profile joined.
   */
  async createThread({ category, title, body }) {
    const res = await authedFetch('/api/threads', {
      method: 'POST',
      body: JSON.stringify({ category, title, body }),
    });
    const responseBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: { message: responseBody.message || 'Failed to create thread' } };
    }

    const { data, error } = await supabase
      .from('threads')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url,
          is_stylist
        ),
        upvotes:thread_upvotes(count),
        replies:thread_replies(count)
      `)
      .eq('id', responseBody.thread.id)
      .single();

    return { data, error };
  },

  /**
   * Delete a thread. Only succeeds if user_id matches (RLS enforced too).
   */
  async deleteThread(threadId, userId) {
    const { error } = await supabase
      .from('threads')
      .delete()
      .eq('id', threadId)
      .eq('user_id', userId);

    return { error };
  },

  // ─────────────────────────────────────────────
  // THREAD UPVOTES
  // ─────────────────────────────────────────────

  /**
   * Returns all thread IDs the user has upvoted.
   * Used to hydrate upvote state for a list of threads in one query.
   */
  async getUpvotedThreadIds() {
    try {
      const res = await authedFetch('/api/threads/upvotes');
      const body = await res.json().catch(() => ({ ids: [] }));
      return { ids: body.ids || [], error: null };
    } catch {
      return { ids: [], error: null };
    }
  },

  async upvoteThread(userId, threadId) {
    try {
      const res = await authedFetch(`/api/threads/${encodeURIComponent(threadId)}/upvote`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      return { data: null, error: res.ok ? null : { message: body.message || 'Failed to upvote' } };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  async removeThreadUpvote(userId, threadId) {
    try {
      const res = await authedFetch(`/api/threads/${encodeURIComponent(threadId)}/upvote`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      return { error: res.ok ? null : { message: body.message || 'Failed to remove upvote' } };
    } catch (err) {
      return { error: { message: err.message } };
    }
  },

  // ─────────────────────────────────────────────
  // REPLIES
  // ─────────────────────────────────────────────

  /**
   * Fetch all replies for a thread, oldest first.
   * Includes author profile and upvote count.
   */
  async getReplies(threadId) {
    const { data, error } = await supabase
      .from('thread_replies')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url,
          is_stylist
        ),
        upvotes:thread_reply_upvotes(count)
      `)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    return { data, error };
  },

  /**
   * Post a new reply to a thread.
   * Returns the full reply row with profile joined.
   */
  async createReply(userId, threadId, body, parentId = null) {
    const insertData = { user_id: userId, thread_id: threadId, body };
    if (parentId) insertData.parent_id = parentId;

    const { data, error } = await supabase
      .from('thread_replies')
      .insert([insertData])
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url,
          is_stylist
        ),
        upvotes:thread_reply_upvotes(count)
      `)
      .single();

    return { data, error };
  },

  async deleteReply(replyId, userId) {
    const { error } = await supabase
      .from('thread_replies')
      .delete()
      .eq('id', replyId)
      .eq('user_id', userId);

    return { error };
  },

  // ─────────────────────────────────────────────
  // REPLY UPVOTES
  // ─────────────────────────────────────────────

  /**
   * Returns all reply IDs the user has upvoted within a thread.
   */
  async getUpvotedReplyIds(userId, threadId) {
    const { data, error } = await supabase
      .from('thread_reply_upvotes')
      .select('reply_id, thread_replies!inner(thread_id)')
      .eq('user_id', userId)
      .eq('thread_replies.thread_id', threadId);

    const ids = (data || []).map((row) => row.reply_id);
    return { ids, error };
  },

  async upvoteReply(userId, replyId) {
    const { data, error } = await supabase
      .from('thread_reply_upvotes')
      .insert([{ user_id: userId, reply_id: replyId }])
      .select()
      .single();

    return { data, error };
  },

  async removeReplyUpvote(userId, replyId) {
    const { error } = await supabase
      .from('thread_reply_upvotes')
      .delete()
      .eq('user_id', userId)
      .eq('reply_id', replyId);

    return { error };
  },
};