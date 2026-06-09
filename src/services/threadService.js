import { supabase } from '../config/supabase';

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
   * Create a new thread.
   * Returns the full thread row with profile joined.
   */
  async createThread(userId, { category, title, body }) {
    const { data, error } = await supabase
      .from('threads')
      .insert([{ user_id: userId, category, title, body }])
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
  async getUpvotedThreadIds(userId) {
    const { data, error } = await supabase
      .from('thread_upvotes')
      .select('thread_id')
      .eq('user_id', userId);

    const ids = (data || []).map((row) => row.thread_id);
    return { ids, error };
  },

  async upvoteThread(userId, threadId) {
    const { data, error } = await supabase
      .from('thread_upvotes')
      .insert([{ user_id: userId, thread_id: threadId }])
      .select()
      .single();

    return { data, error };
  },

  async removeThreadUpvote(userId, threadId) {
    const { error } = await supabase
      .from('thread_upvotes')
      .delete()
      .eq('user_id', userId)
      .eq('thread_id', threadId);

    return { error };
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