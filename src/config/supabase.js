import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Replace with your actual Supabase credentials
const SUPABASE_URL = 'https://iyfpmxejxgxypjnoivyz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5ZnBteGVqeGd4eXBqbm9pdnl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMTE1OTUsImV4cCI6MjA3OTU4NzU5NX0._2LSVnN3ZY8mtU9JUwmKJpNDgsBohrNMak7fTyuiXnM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
