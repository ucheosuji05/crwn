import { supabase } from '../config/supabase';

export const postService = {
  // Get all posts (for Explore page)
  async getPosts(limit = 20, offset = 0) {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        stylists:stylist_id (
          id,
          username,
          business_name
        ),
        post_media (
          id,
          media_url,
          media_type,
          position
        )
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data, error };
  },

  // Get posts by specific user (for Profile page)
  async getPostsByUser(userId) {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        stylists:stylist_id (
          id,
          username,
          business_name
        ),
        post_media (
          id,
          media_url,
          media_type,
          position
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return { data, error };
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
        }])
        .select()
        .single();

      if (postError) throw postError;

      // Upload media files
      if (mediaFiles.length > 0) {
        for (let i = 0; i < mediaFiles.length; i++) {
          const file = mediaFiles[i];
          const fileName = `${userId}/${post.id}/${Date.now()}-${i}.jpg`;

          const response = await fetch(file.uri);
          const blob = await response.blob();

          const { error: uploadError } = await supabase.storage
            .from('post-media')
            .upload(fileName, blob, {
              contentType: 'image/jpeg',
            });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('post-media')
            .getPublicUrl(fileName);

          await supabase.from('post_media').insert([{
            post_id: post.id,
            media_url: urlData.publicUrl,
            media_type: 'image',
            position: i,
          }]);
        }
      }

      return { data: post, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete post
  async deletePost(postId, userId) {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId);

    return { error };
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
      .single();

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

  // Get bookmarked posts
  async getBookmarkedPosts(userId) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select(`
        *,
        posts (
          *,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          post_media (
            id,
            media_url,
            media_type,
            position
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return { data, error };
  },
};