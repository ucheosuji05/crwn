import { useState, useEffect, useRef, useMemo } from 'react';
import { postService } from '../services/postService';
import { supabase } from '../config/supabase';
import { useBlock } from '../context/BlockContext';

const PAGE_SIZE = 20;

export const usePosts = (userId = null) => {
  const { allHiddenIds } = useBlock();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const offsetRef = useRef(0); // track current offset without re-renders

  const hiddenIdsRef = useRef(allHiddenIds);
  useEffect(() => { hiddenIdsRef.current = allHiddenIds; }, [allHiddenIds]);

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    offsetRef.current = 0;

    try {
      let result;
      if (userId) {
        result = await postService.getPostsByUser(userId);
      } else {
        result = await postService.getPosts(PAGE_SIZE, 0, Array.from(hiddenIdsRef.current));
      }

      if (result.error) {
        setError(result.error);
        console.error('Error fetching posts:', result.error);
      } else {
        const fetched = result.data || [];
        setPosts(fetched);
        offsetRef.current = fetched.length;
        setHasMore(!userId && fetched.length === PAGE_SIZE);
      }
    } catch (err) {
      setError(err);
      console.error('Unexpected error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load the next page — only used for the explore feed (userId === null)
  const loadMore = async () => {
    if (userId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { data, error: err } = await postService.getPosts(PAGE_SIZE, offsetRef.current, Array.from(hiddenIdsRef.current));
      if (!err && data) {
        const fetched = data || [];
        setPosts(prev => {
          // Deduplicate by id in case realtime inserted something
          const existingIds = new Set(prev.map(p => p.id));
          const newItems = fetched.filter(p => !existingIds.has(p.id));
          return [...prev, ...newItems];
        });
        offsetRef.current += fetched.length;
        setHasMore(fetched.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error('usePosts loadMore error:', err);
    } finally {
      setLoadingMore(false);
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
        : await postService.getPosts(PAGE_SIZE, 0, Array.from(hiddenIdsRef.current));
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
      // New post created — silently refresh so the feed picks it up immediately
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(silentRefetch, 600);
      })
      // post_media INSERT fires after images are uploaded — debounce handles multi-image posts
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_media' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(silentRefetch, 800);
      })
      // post_media edits/deletes (e.g. image removed from post)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'post_media' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(silentRefetch, 600);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_media' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(silentRefetch, 600);
      })
      // Post deleted by anyone — remove it from state immediately
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
        if (payload.old?.id) {
          setPosts(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      // Post caption/description edited
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(silentRefetch, 600);
      })
      // When any profile (name, avatar, username) changes, silently refresh so
      // the post author info stays up to date everywhere
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(silentRefetch, 600);
      })
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Filter out hidden users (blocked by me or blocking me) for instant feed update
  const visiblePosts = useMemo(
    () => posts.filter(p => !allHiddenIds.has(p.user_id)),
    [posts, allHiddenIds]
  );

  return { posts: visiblePosts, loading, loadingMore, hasMore, loadMore, error, refresh: fetchPosts, silentRefetch, deletePost, updatePost };
};