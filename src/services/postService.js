import { supabase } from '../config/supabase';

export const postService = {
  // Get all posts (for Explore page)
  async getPosts(limit = 20, offset = 0) {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (id, username, full_name, avatar_url),
        stylists:profiles!posts_stylist_id_fkey (id, username, full_name),
        post_media (id, media_url, media_type, position),
        likes(count),
        comments(count)
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
        profiles:user_id (id, username, full_name, avatar_url),
        stylists:profiles!posts_stylist_id_fkey (id, username, full_name),
        post_media (id, media_url, media_type, position),
        likes(count),
        comments(count)
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
          const fileName = `${userId}/${post.id}/${Date.now()}-${i}.jpg`;

          const response = await fetch(file.uri);
          const arrayBuffer = await response.arrayBuffer();
          console.log(`Image ${i} buffer size:`, arrayBuffer.byteLength);

          const { error: uploadError } = await supabase.storage
            .from('post-media')
            .upload(fileName, arrayBuffer, {
              contentType: 'image/jpeg',
            });

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

  // Check if user bookmarked post
  async hasBookmarked(userId, postId) {
    const { data } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .single();
    return { bookmarked: !!data };
  },

  // Get comments for a post
  async getComments(postId) {
    const { data, error } = await supabase
      .from('comments')
      .select(`*, profiles:user_id (id, username, avatar_url, full_name)`)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    return { data, error };
  },

  // Add a comment
  async addComment(userId, postId, content) {
    const { data, error } = await supabase
      .from('comments')
      .insert([{ user_id: userId, post_id: postId, content }])
      .select(`*, profiles:user_id (id, username, avatar_url, full_name)`)
      .single();
    return { data, error };
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