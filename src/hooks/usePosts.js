import { useState, useEffect } from 'react';
import { postService } from '../services/postService';
import { supabase } from '../config/supabase';

export const usePosts = (userId = null) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let result;
      if (userId) {
        // Fetch posts for specific user (for profile page)
        result = await postService.getPostsByUser(userId);
      } else {
        // Fetch all posts (for explore page)
        result = await postService.getPosts();
      }
      
      if (result.error) {
        setError(result.error);
        console.error('Error fetching posts:', result.error);
      } else {
        setPosts(result.data || []);
      }
    } catch (err) {
      setError(err);
      console.error('Unexpected error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (postId, currentUserId) => {
    try {
      const { error } = await postService.deletePost(postId, currentUserId);
      if (error) {
        console.error('Error deleting post:', error);
        return { success: false, error };
      }
      // Remove post from local state
      setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
      return { success: true };
    } catch (err) {
      console.error('Unexpected error deleting post:', err);
      return { success: false, error: err };
    }
  };

  const updatePost = async (postId, currentUserId, updates) => {
    try {
      const { data, error } = await postService.updatePost(postId, currentUserId, updates);
      if (error) {
        console.error('Error updating post:', error);
        return { success: false, error };
      }
      // Update post in local state
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId ? { ...post, ...data } : post
        )
      );
      return { success: true, data };
    } catch (err) {
      console.error('Unexpected error updating post:', err);
      return { success: false, error: err };
    }
  };

  // Refresh without triggering the loading spinner so the feed doesn't flash
  const silentRefetch = async () => {
    try {
      const result = userId
        ? await postService.getPostsByUser(userId)
        : await postService.getPosts();
      if (!result.error) setPosts(result.data || []);
    } catch (err) {
      console.error('usePosts silentRefetch error:', err);
    }
  };

  useEffect(() => {
    fetchPosts();

    let debounceTimer;

    const channel = supabase
      .channel(`posts-counts-${userId || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, fetchPosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, fetchPosts)
      // post_media INSERT fires after images are uploaded — debounce handles multi-image posts
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_media' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(silentRefetch, 800);
      })
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { posts, loading, error, refresh: fetchPosts, silentRefetch, deletePost, updatePost };
};