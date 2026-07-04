import { Platform } from 'react-native';
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

export const postService = {
  // Get all posts (for Explore page)
  async getPosts(limit = 20, offset = 0, excludeUserIds = []) {
    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (id, username, full_name, avatar_url, is_stylist, hair_profiles(hair_type)),
        stylists:profiles!posts_stylist_id_fkey (id, username, full_name),
        post_media (id, media_url, media_type, position),
        likes(count),
        comments(count)
      `)
      .or('is_public.eq.true,is_public.is.null')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (excludeUserIds.length > 0) {
      query = query.not('user_id', 'in', `(${excludeUserIds.join(',')})`);
    }

    const { data, error } = await query;

    const sorted = data?.map(p => ({
      ...p,
      post_media: (p.post_media || []).sort((a, b) => a.position - b.position),
    }));
    return { data: sorted ?? data, error };
  },

  // Get a single post by ID (used by PostDetailScreen)
  async getPostById(postId) {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (id, username, full_name, avatar_url, is_stylist),
        stylists:profiles!posts_stylist_id_fkey (id, username, full_name),
        post_media (id, media_url, media_type, position),
        likes(count),
        comments(count)
      `)
      .eq('id', postId)
      .single();

    if (data) {
      data.post_media = (data.post_media || []).sort((a, b) => a.position - b.position);
    }
    return { data, error };
  },

  // Get posts that contain a given hashtag tag (for FilteredExploreScreen)
  async getPostsByTag(tag) {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (id, username, full_name, avatar_url, is_stylist),
        stylists:profiles!posts_stylist_id_fkey (id, username, full_name),
        post_media (id, media_url, media_type, position),
        likes(count),
        comments(count)
      `)
      .contains('tags', [tag])
      .or('is_public.eq.true,is_public.is.null')
      .order('created_at', { ascending: false });

    const sorted = data?.map(p => ({
      ...p,
      post_media: (p.post_media || []).sort((a, b) => a.position - b.position),
    }));
    return { data: sorted ?? data, error };
  },

  // Get posts by specific user (for Profile page)
  async getPostsByUser(userId) {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (id, username, full_name, avatar_url, is_stylist),
        stylists:profiles!posts_stylist_id_fkey (id, username, full_name),
        post_media (id, media_url, media_type, position),
        likes(count),
        comments(count)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const sorted = data?.map(p => ({
      ...p,
      post_media: (p.post_media || []).sort((a, b) => a.position - b.position),
    }));
    return { data: sorted ?? data, error };
  },

  // Create post — routed through the server so the service role key bypasses
  // Supabase RLS (anon client has no session, so auth.uid() would be null).
  async createPost(postData, mediaFiles = []) {
    const token = getAuthToken();
    if (!token) return { data: null, error: { message: 'Not authenticated' } };

    try {
      // Insert post
      const postRes = await fetch(`${AUTH_URL}/api/posts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: postData.title,
          description: postData.description,
          stylistId: postData.stylistId || null,
          tags: postData.tags || [],
        }),
      });
      if (!postRes.ok) {
        const body = await postRes.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to create post');
      }
      const { post } = await postRes.json();

      // Upload media files
      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i];

        let uploadData;
        let contentType;
        let fileExt;

        if (Platform.OS === 'web') {
          const response = await fetch(file.uri);
          const blob = await response.blob();
          contentType = blob.type || 'image/jpeg';
          // HEIC/HEIF is not renderable in web browsers — treat as JPEG
          // (the ensureJpeg() step in CreatePostScreen should have already
          //  converted these, but guard here too just in case)
          if (contentType.includes('heic') || contentType.includes('heif')) {
            contentType = 'image/jpeg';
          }
          fileExt = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
          uploadData = blob;
        } else {
          fileExt = file.uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
          // HEIC should have been converted by ensureJpeg() before reaching here,
          // but normalise the extension/type if it somehow wasn't.
          if (fileExt === 'heic' || fileExt === 'heif') {
            fileExt = 'jpg';
          }
          contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
          uploadData = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', file.uri);
            xhr.responseType = 'arraybuffer';
            xhr.onload = () => resolve(xhr.response);
            xhr.onerror = reject;
            xhr.send();
          });
        }

        const mediaRes = await fetch(
          `${AUTH_URL}/api/posts/${post.id}/media?ext=${encodeURIComponent(fileExt)}&position=${i}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': contentType,
            },
            body: uploadData,
          }
        );
        if (!mediaRes.ok) {
          const body = await mediaRes.json().catch(() => ({}));
          console.error('Media upload failed for image', i, JSON.stringify(body));
          throw new Error(body.message || 'Failed to upload image');
        }
      }

      return { data: post, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete post — routed through the server so the service role key bypasses
  // Supabase RLS (anon client has no session, so auth.uid() would be null).
  async deletePost(postId) {
    const token = getAuthToken();
    if (!token) return { error: { message: 'Not authenticated' } };

    try {
      const res = await fetch(`${AUTH_URL}/api/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { error: { message: body.message || 'Delete failed' } };
      return { error: null };
    } catch (err) {
      return { error: { message: err.message || 'Network error' } };
    }
  },

  // Update post
  async updatePost(postId, userId, updates) {
    const { data, error } = await supabase
      .from('posts')
      .update({
        title: updates.title,
        description: updates.description,
        stylist_id: updates.stylistId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('user_id', userId)
      .select()
      .single();

    return { data, error };
  },

  // Like post
  async likePost(userId, postId) {
    try {
      const res = await authedFetch(`/api/posts/${encodeURIComponent(postId)}/like`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      return { data: null, error: res.ok ? null : { message: body.message || 'Failed to like' } };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  // Unlike post
  async unlikePost(userId, postId) {
    try {
      const res = await authedFetch(`/api/posts/${encodeURIComponent(postId)}/like`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      return { error: res.ok ? null : { message: body.message || 'Failed to unlike' } };
    } catch (err) {
      return { error: { message: err.message } };
    }
  },

  // Check if user liked post
  async hasLiked(userId, postId) {
    const { data, error } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();

    return { liked: !!data, error };
  },

  // Bookmark post
  async bookmarkPost(userId, postId) {
    try {
      const res = await authedFetch(`/api/posts/${encodeURIComponent(postId)}/bookmark`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      return { data: null, error: res.ok ? null : { message: body.message || 'Failed to bookmark' } };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  // Remove bookmark
  async removeBookmark(userId, postId) {
    try {
      const res = await authedFetch(`/api/posts/${encodeURIComponent(postId)}/bookmark`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      return { error: res.ok ? null : { message: body.message || 'Failed to remove bookmark' } };
    } catch (err) {
      return { error: { message: err.message } };
    }
  },

  // Check if user bookmarked post
  async hasBookmarked(userId, postId) {
    const { data } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();
    return { bookmarked: !!data };
  },

  // Get top-level comments for a post (excludes replies)
  async getComments(postId) {
    // Try filtering top-level only (requires parent_id column)
    let { data, error } = await supabase
      .from('comments')
      .select(`*, profiles:user_id (id, username, avatar_url, full_name)`)
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: true });
    // Graceful fallback if parent_id column isn't migrated yet
    if (error?.code === '42703') {
      ({ data, error } = await supabase
        .from('comments')
        .select(`*, profiles:user_id (id, username, avatar_url, full_name)`)
        .eq('post_id', postId)
        .order('created_at', { ascending: true }));
    }
    return { data, error };
  },

  // Get paginated replies for a parent comment
  async getReplies(postId, parentId, offset = 0, limit = 9) {
    try {
      const { data, error, count } = await supabase
        .from('comments')
        .select(`*, profiles:user_id (id, username, avatar_url, full_name)`, { count: 'exact' })
        .eq('post_id', postId)
        .eq('parent_id', parentId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);
      if (error?.code === '42703') return { data: [], total: 0, error: null };
      return { data: data || [], total: count ?? 0, error };
    } catch (_) { return { data: [], total: 0, error: null }; }
  },

  // Batch-fetch reply counts for a list of comment IDs
  async getReplyCounts(commentIds) {
    if (!commentIds.length) return {};
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('parent_id')
        .in('parent_id', commentIds);
      if (error) return {};
      const counts = {};
      for (const row of (data || [])) {
        counts[row.parent_id] = (counts[row.parent_id] || 0) + 1;
      }
      return counts;
    } catch (_) { return {}; }
  },

  // Add a comment or reply (parentId = null for top-level)
  async addComment(userId, postId, content, parentId = null) {
    try {
      const res = await authedFetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, parentId: parentId || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { data: null, error: { message: body.message || 'Failed to add comment' } };
      return { data: body.data || null, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  // Like / unlike a comment
  async likeComment(userId, commentId) {
    try {
      const res = await authedFetch(`/api/comments/${encodeURIComponent(commentId)}/like`, { method: 'POST' });
      return { error: res.ok ? null : { message: 'Failed to like comment' } };
    } catch (_) { return { error: null }; }
  },

  async unlikeComment(userId, commentId) {
    try {
      const res = await authedFetch(`/api/comments/${encodeURIComponent(commentId)}/like`, { method: 'DELETE' });
      return { error: res.ok ? null : { message: 'Failed to unlike comment' } };
    } catch (_) { return { error: null }; }
  },

  // Which of the given comment IDs has the user liked?
  async getMyCommentLikes(userId, commentIds) {
    if (!commentIds.length) return [];
    try {
      const { data } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', userId)
        .in('comment_id', commentIds);
      return (data || []).map(r => r.comment_id);
    } catch (_) { return []; }
  },

  // Batch like counts for a list of comment IDs
  async getCommentLikeCounts(commentIds) {
    if (!commentIds.length) return {};
    try {
      const { data } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .in('comment_id', commentIds);
      if (!data) return {};
      const counts = {};
      for (const row of data) {
        counts[row.comment_id] = (counts[row.comment_id] || 0) + 1;
      }
      return counts;
    } catch (_) { return {}; }
  },

  // Delete a comment
  async deleteComment(commentId, userId) {
    try {
      const res = await authedFetch(`/api/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      return { error: res.ok ? null : { message: body.message || 'Failed to delete comment' } };
    } catch (err) {
      return { error: { message: err.message } };
    }
  },

  // Search users by username prefix (for @mention suggestions)
  async searchUsers(query, limit = 6) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, is_stylist')
      .ilike('username', `${query}%`)
      .limit(limit);
    return data || [];
  },

  // Get posts where a specific stylist was tagged
  async getTaggedPosts(stylistId) {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (id, username, full_name, avatar_url),
        post_media (id, media_url, media_type, position),
        likes(count),
        comments(count)
      `)
      .eq('stylist_id', stylistId)
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    const sorted = data?.map(p => ({
      ...p,
      post_media: (p.post_media || []).sort((a, b) => a.position - b.position),
    }));
    return { data: sorted ?? data, error };
  },

  // Get bookmarked posts
  async getBookmarkedPosts(userId) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select(`
        *,
        posts (
          *,
          profiles:user_id (id, username, full_name, avatar_url),
          stylists:profiles!posts_stylist_id_fkey (id, username, full_name),
          post_media (id, media_url, media_type, position),
          likes(count),
          comments(count)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Sort each post's media by position (same as other queries)
    const sorted = data?.map(b => ({
      ...b,
      posts: b.posts ? {
        ...b.posts,
        post_media: (b.posts.post_media || []).sort((a, b) => a.position - b.position),
      } : b.posts,
    }));
    return { data: sorted ?? data, error };
  },
};