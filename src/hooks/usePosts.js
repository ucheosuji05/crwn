import { useState, useEffect } from 'react';
import { postService } from '../services/postService';

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

  useEffect(() => {
    fetchPosts();
  }, [userId]);

  return { posts, loading, error, refresh: fetchPosts };
};