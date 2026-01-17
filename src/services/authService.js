import { supabase } from '../config/supabase';

export const authService = {
  async signUp(email, password, userData) {
    try {
      console.log('AuthService: Starting signup for', email);
      
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      console.log('AuthService: Auth signup response', { authData, authError });

      if (authError) {
        console.error('AuthService: Auth error', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('No user returned from signup');
      }

      console.log('AuthService: User created, ID:', authData.user.id);

      // Create profile
      try {
        const profileData = {
          id: authData.user.id,
          email: email,
          username: userData.username || email.split('@')[0],
          full_name: userData.name || '',
          phone: userData.phone || null,
          date_of_birth: userData.dob || null,
          location: userData.location || null,
        };

        console.log('AuthService: Creating profile with data', profileData);

        const { error: profileError } = await supabase
          .from('profiles')
          .insert([profileData]);

        if (profileError) {
          console.error('AuthService: Profile creation error', profileError);
          throw profileError;
        }

        console.log('AuthService: Profile created successfully');

        // Create hair profile if provided
        if (userData.hairType) {
          console.log('AuthService: Creating hair profile');
          
          const { error: hairError } = await supabase
            .from('hair_profiles')
            .insert([{
              user_id: authData.user.id,
              hair_type: userData.hairType,
            }]);

          if (hairError) {
            console.error('AuthService: Hair profile error', hairError);
            // Don't throw - hair profile is optional
          }
        }
      } catch (dbError) {
        console.error('AuthService: Database error during profile creation', dbError);
        // The user was created but profile failed - they can still login
        // You might want to handle this differently
        return { 
          user: authData.user, 
          error: new Error('Account created but profile setup failed. Please contact support.') 
        };
      }

      console.log('AuthService: Signup complete');
      return { user: authData.user, error: null };
    } catch (error) {
      console.error('AuthService: Unexpected error', error);
      return { user: null, error };
    }
  },

  async signIn(email, password) {
    try {
      console.log('AuthService: Signing in', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('AuthService: Sign in response', { data, error });

      if (error) {
        console.error('AuthService: Sign in error', error);
      }

      return { user: data?.user, session: data?.session, error };
    } catch (error) {
      console.error('AuthService: Unexpected sign in error', error);
      return { user: null, session: null, error };
    }
  },

  async signOut() {
    try {
      console.log('AuthService: Signing out');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('AuthService: Sign out error', error);
      }
      
      return { error };
    } catch (error) {
      console.error('AuthService: Unexpected sign out error', error);
      return { error };
    }
  },

  async getCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch (error) {
      console.error('AuthService: Get current user error', error);
      return null;
    }
  },

  async getSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('AuthService: Get session error', error);
      return null;
    }
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};