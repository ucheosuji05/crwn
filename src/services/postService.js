import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

export const postService = {
  // Get all posts (for Explore page)
  async getPosts(limit = 20, offset = 0) {
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
      .or('is_public.eq.true,is_public.is.null')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

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

  // Create post
  async createPost(userId, postData, mediaFiles = []) {
    try {
      // Insert post
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert([{
          user_id: userId,
          title: postData.title,
          description: postData.description,
          stylist_id: postData.stylistId || null,
          tags: postData.tags || [],
          is_public: true,
        }])
        .select()
        .single();

      if (postError) throw postError;

      // Upload media files
      if (mediaFiles.length > 0) {
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

          const fileName = `${userId}/${post.id}/${Date.now()}-${i}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('post-media')
            .upload(fileName, uploadData, { contentType });

          if (uploadError) {
            console.error('Media upload failed for image', i, JSON.stringify(uploadError));
            throw uploadError;
          }

          const { data: urlData } = supabase.storage
            .from('post-media')
            .getPublicUrl(fileName);

          const { error: mediaInsertError } = await supabase.from('post_media').insert([{
            post_id: post.id,
            media_url: urlData.publicUrl,
            media_type: 'image',
            position: i,
          }]);

          if (mediaInsertError) {
            console.error('post_media insert failed:', JSON.stringify(mediaInsertError));
            throw mediaInsertError;
          }
        }
      }

      return { data: post, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete post
  async deletePost(postId, userId) {
    // Delete related rows first to avoid FK violations if CASCADE isn't set
    await supabase.from('post_media').delete().eq('post_id', postId);
    await supabase.from('likes').delete().eq('post_id', postId);
    await supabase.from('comments').delete().eq('post_id', postId);
    await supabase.from('bookmarks').delete().eq('post_id', postId);

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId);

    return { error };
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
    const { data, error } = await supabase
      .from('likes')
      .insert([{ user_id: userId, post_id: postId }])
      .select()
      .single();

    return { data, error };
  },

  // Unlike post
  async unlikePost(userId, postId) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('user_id', userId)
      .eq('post_id', postId);

    return { error };
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
    const { data, error } = await supabase
      .from('bookmarks')
      .insert([{ user_id: userId, post_id: postId }])
      .select()
      .single();

    return { data, error };
  },

  // Remove bookmark
  async removeBookmark(userId, postId) {
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('post_id', postId);

    return { error };
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
    const { data, error } = await supabase
      .from('comments')
      .insert([{ user_id: userId, post_id: postId, content, parent_id: parentId || null }])
      .select(`*, profiles:user_id (id, username, avatar_url, full_name)`)
      .single();
    return { data, error };
  },

  // Like / unlike a comment
  async likeComment(userId, commentId) {
    try {
      const { error } = await supabase
        .from('comment_likes')
        .insert([{ user_id: userId, comment_id: commentId }]);
      return { error };
    } catch (_) { return { error: null }; }
  },

  async unlikeComment(userId, commentId) {
    try {
      const { error } = await supabase
        .from('comment_likes')
        .delete()
        .eq('user_id', userId)
        .eq('comment_id', commentId);
      return { error };
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
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId);
    return { error };
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