import { supabase } from '../config/supabase';

/**
 * Stylist service — requires these additions in Supabase SQL Editor:
 * ─────────────────────────────────────────────────────────────────
 *
 * -- 1. Add stylist flag + info to profiles
 * ALTER TABLE profiles
 *   ADD COLUMN IF NOT EXISTS is_stylist boolean DEFAULT false,
 *   ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}',
 *   ADD COLUMN IF NOT EXISTS city text,
 *   ADD COLUMN IF NOT EXISTS state text,
 *   ADD COLUMN IF NOT EXISTS portfolio_photos text[] DEFAULT '{}',
 *   ADD COLUMN IF NOT EXISTS rating numeric(3,1) DEFAULT 0,
 *   ADD COLUMN IF NOT EXISTS review_count int DEFAULT 0;
 *
 * -- 2. Index for fast stylist queries
 * CREATE INDEX IF NOT EXISTS idx_profiles_is_stylist ON profiles(is_stylist)
 *   WHERE is_stylist = true;
 *
 * -- 3. RLS — anyone can view stylist profiles
 * CREATE POLICY "public can view stylists" ON profiles
 *   FOR SELECT USING (is_stylist = true OR auth.uid() = id);
 *
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Fetch up to 3 recent post-media URLs for each stylist id in `ids`.
 * Returns a map: { [stylistId]: string[] }
 */
async function fetchPostPhotos(ids) {
  if (!ids?.length) return {};
  try {
    // Pull the most recent posts for these stylists (including their first media item)
    const { data: posts } = await supabase
      .from('posts')
      .select('user_id, created_at, post_media(media_url, position)')
      .in('user_id', ids)
      .or('is_public.eq.true,is_public.is.null')
      .order('created_at', { ascending: false })
      .limit(ids.length * 8); // fetch enough to get 3 photos per stylist

    if (!posts?.length) return {};

    const map = {};
    for (const post of posts) {
      const sid = post.user_id;
      if (!map[sid]) map[sid] = [];
      if (map[sid].length >= 3) continue; // already have 3 for this stylist
      // pick the first (position=0) media from this post
      const sorted = (post.post_media || []).sort((a, b) => a.position - b.position);
      const url = sorted[0]?.media_url;
      if (url) map[sid].push(url);
    }
    return map;
  } catch (_) {
    return {};
  }
}

export const stylistService = {

  /**
   * Fetch all verified stylists, optionally filtered by specialty.
   * Returns { data: [], error, isEmpty: bool }
   * isEmpty = true means the table exists but has no rows (different from a DB error).
   */
  async getStylists({ specialty } = {}) {
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, city, state, location, specialties, portfolio_photos, rating, review_count')
        .eq('is_stylist', true)
        .order('rating', { ascending: false });

      if (specialty && specialty !== 'All') {
        query = query.contains('specialties', [specialty]);
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
          return { data: [], error: null, isEmpty: true, notMigrated: true };
        }
        return { data: [], error, isEmpty: true };
      }

      if (!data?.length) return { data: [], error: null, isEmpty: true };

      // Attach recent post photos for each stylist
      const postPhotos = await fetchPostPhotos(data.map(s => s.id));
      return {
        data: data.map(s => ({ ...s, post_photos: postPhotos[s.id] || [] })),
        error: null,
        isEmpty: false,
      };
    } catch (err) {
      return { data: [], error: err, isEmpty: true };
    }
  },

  /**
   * Search stylists by name, city/state, or specialty.
   */
  async searchStylists(query) {
    if (!query?.trim()) return this.getStylists();

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, city, state, location, specialties, portfolio_photos, rating, review_count')
        .eq('is_stylist', true)
        .or(`full_name.ilike.%${query}%,username.ilike.%${query}%,city.ilike.%${query}%,state.ilike.%${query}%,specialties::text.ilike.%${query}%`);

      if (error) return { data: [], error, isEmpty: true };
      if (!data?.length) return { data: [], error: null, isEmpty: true };

      // Attach recent post photos
      const postPhotos = await fetchPostPhotos(data.map(s => s.id));
      return {
        data: data.map(s => ({ ...s, post_photos: postPhotos[s.id] || [] })),
        error: null,
        isEmpty: false,
      };
    } catch (err) {
      return { data: [], error: err, isEmpty: true };
    }
  },

  /**
   * Mark the current user's profile as a stylist and set their info.
   * Called during stylist onboarding.
   */
  async registerAsStylist(userId, { specialties, city, state, portfolioPhotos }) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        is_stylist: true,
        specialties,
        city,
        state,
        portfolio_photos: portfolioPhotos || [],
        rating: 0,
        review_count: 0,
      })
      .eq('id', userId)
      .select()
      .single();

    return { data, error };
  },

  /**
   * Add a portfolio photo URL to a stylist's profile.
   */
  async addPortfolioPhoto(userId, photoUrl) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('portfolio_photos')
      .eq('id', userId)
      .single();

    const current = profile?.portfolio_photos || [];
    const updated = [...current, photoUrl];

    const { error } = await supabase
      .from('profiles')
      .update({ portfolio_photos: updated })
      .eq('id', userId);

    return { error };
  },
};

/**
 * Normalize a raw profile row into the shape the StylistsScreen expects.
 *
 * Photo priority:
 *   1. post_photos  — images from the stylist's actual posts (most current work)
 *   2. portfolio_photos — manually uploaded portfolio images
 *   3. avatar_url padding — used only when nothing else is available
 */
export function normalizeStylist(row) {
  const postPhotos      = row.post_photos      || [];
  const portfolioPhotos = row.portfolio_photos || [];

  // Merge: post photos first, then portfolio; deduplicate
  const merged = [...new Set([...postPhotos, ...portfolioPhotos])];

  const photos =
    merged.length >= 3
      ? merged.slice(0, 3)
      : [
          ...merged,
          // pad with avatar if still short
          ...(row.avatar_url ? Array(3).fill(row.avatar_url) : []),
        ].slice(0, 3);

  return {
    id:          row.id,
    name:        row.full_name || row.username || 'Stylist',
    location:    row.city && row.state
                   ? `${row.city}, ${row.state}`
                   : row.location || '',
    rating:      row.rating      ?? 0,
    reviewCount: row.review_count ?? 0,
    specialties: row.specialties  || [],
    photos,
    avatarUrl:   row.avatar_url,
  };
}
