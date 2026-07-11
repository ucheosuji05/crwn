import { supabase } from '../config/supabase';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const analyticsService = {
  // ── Posts created by this stylist with full metrics ─────────────────────────
  async getProviderPosts(stylistId) {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, title, description, tags, created_at,
        profiles:user_id (id, username, full_name, avatar_url),
        post_media (id, media_url, media_type, position),
        likes(count),
        comments(count)
      `)
      .eq('user_id', stylistId)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error };

    const sorted = (data || []).map(p => ({
      ...p,
      post_media: (p.post_media || []).sort((a, b) => a.position - b.position),
      likes_count:    Array.isArray(p.likes)    ? (p.likes[0]?.count    ?? 0) : 0,
      comments_count: Array.isArray(p.comments) ? (p.comments[0]?.count ?? 0) : 0,
    }));

    return { data: sorted, error: null };
  },

  // ── Bookmark counts for a list of post IDs ──────────────────────────────────
  async getBookmarkCounts(postIds) {
    if (!postIds?.length) return {};
    const { data, error } = await supabase
      .from('bookmarks')
      .select('post_id')
      .in('post_id', postIds);
    if (error || !data) return {};
    return data.reduce((acc, { post_id }) => {
      acc[post_id] = (acc[post_id] || 0) + 1;
      return acc;
    }, {});
  },

  // ── Likes received on tagged posts per day for the last 7 days ─────────────
  async getWeeklyActivity(postIds) {
    const result = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        day:   DAY_LABELS[d.getDay()],
        date:  d.toISOString().split('T')[0],
        count: 0,
      };
    });

    if (!postIds?.length) return result;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('likes')
      .select('created_at')
      .in('post_id', postIds)
      .gte('created_at', sevenDaysAgo);

    (data || []).forEach(({ created_at }) => {
      const dateStr = created_at.split('T')[0];
      const entry = result.find(r => r.date === dateStr);
      if (entry) entry.count++;
    });

    return result;
  },

  // ── Most recent comments across all tagged posts ────────────────────────────
  async getRecentComments(postIds, limit = 6) {
    if (!postIds?.length) return { data: [], error: null };
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id, content, created_at, post_id,
        profiles:user_id (id, username, avatar_url, full_name)
      `)
      .in('post_id', postIds)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data: data || [], error };
  },

  // ── Real follower count for a stylist ──────────────────────────────────────
  async getFollowerCount(stylistId) {
    const { count } = await supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', stylistId);
    return count ?? 0;
  },

  // ── Aggregate stats derived from posts + bookings ───────────────────────────
  computeAggregateStats(posts, bookmarkCounts, bookings, followerCount = 0) {
    const totalCrowns   = posts.reduce((s, p) => s + (p.likes_count    || 0), 0);
    const totalComments = posts.reduce((s, p) => s + (p.comments_count || 0), 0);
    const totalSaves    = Object.values(bookmarkCounts).reduce((s, n) => s + n, 0);
    const totalBookings = bookings.length;

    // Avg per-post engagement rate, with bookings weighted 5× as a monetized conversion.
    // Formula: (content_engagements + bookings × 5) / (reach × numPosts) × 100
    // This averages per-post so one viral post doesn't skew the overall number.
    const reach    = Math.max(followerCount, 1);
    const numPosts = Math.max(posts.length, 1);
    const weightedEngagements = totalCrowns + totalComments + totalSaves + totalBookings * 5;
    const engagementRate = ((weightedEngagements / (reach * numPosts)) * 100).toFixed(1);

    return { totalCrowns, totalSaves, totalBookings, engagementRate, totalComments, followerCount };
  },

  // ── Per-post engagement metrics ─────────────────────────────────────────────
  computePostMetrics(post, bookmarkCount, followerCount = 0) {
    const likes    = post.likes_count    || 0;
    const comments = post.comments_count || 0;
    const saves    = bookmarkCount       || 0;
    const reach    = Math.max(followerCount, 1);
    const rate     = (((likes + saves + comments) / reach) * 100).toFixed(1);
    return { likes, comments, saves, reach, rate };
  },
};
