import { supabase } from '../config/supabase';

export const profileService = {
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        hair_profiles (*)
      `)
      .eq('id', userId)
      .single();

    return { data, error };
  },

  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    return { data, error };
  },

  async updateHairProfile(userId, hairData) {
    const { data, error } = await supabase
      .from('hair_profiles')
      .upsert({
        user_id: userId,
        ...hairData,
      })
      .select()
      .single();

    return { data, error };
  },

  async uploadAvatar(userId, fileUri) {
    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      const fileName = `${userId}-${Date.now()}.jpg`;

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      await this.updateProfile(userId, { avatar_url: urlData.publicUrl });

      return { url: urlData.publicUrl, error: null };
    } catch (error) {
      return { url: null, error };
    }
  },

  async followUser(followerId, followingId) {
    const { data, error } = await supabase
      .from('follows')
      .insert([{ follower_id: followerId, following_id: followingId }])
      .select()
      .single();

    return { data, error };
  },

  async unfollowUser(followerId, followingId) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    return { error };
  },
};