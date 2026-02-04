import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../config/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: Initializing...');
    
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('AuthProvider: Initial session -', session ? session.user.email : 'none');
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('AuthProvider: Auth event -', event);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Sign up function
  const signUp = async (email, password, userData) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        return { user: null, error: authError };
      }

      if (!authData.user) {
        return { user: null, error: new Error('No user returned') };
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          email: email,
          username: userData.username || email.split('@')[0],
          full_name: userData.name || '',
        }]);

      if (profileError) {
        console.error('Profile creation error:', profileError);
      }

      return { user: authData.user, error: null };
    } catch (error) {
      return { user: null, error };
    }
  };

  // Sign in function
  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, session: null, error };
      }

      return { user: data?.user, session: data?.session, error: null };
    } catch (error) {
      return { user: null, session: null, error };
    }
  };

  // Sign out function - clears state immediately
  const signOut = () => {
    console.log('useAuth signOut: Clearing state...');
    
    // Clear state FIRST (triggers immediate re-render)
    setUser(null);
    setSession(null);
    
    // Then call supabase (fire and forget)
    supabase.auth.signOut().catch((err) => {
      console.log('Supabase signOut error (ignored):', err);
    });
    
    console.log('useAuth signOut: Done');
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};