import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { profileService } from '../services/profileService';

export default function UserHeader() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      // No user - stop loading
      setLoading(false);
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user?.id) {
      console.log('UserHeader: No user ID, skipping fetch');
      setLoading(false);
      return;
    }

    console.log('UserHeader: Fetching profile for user:', user.id);
    setLoading(true);
    
    try {
      const { data, error } = await profileService.getProfile(user.id);
      
      if (error) {
        console.error('UserHeader: Error fetching profile:', error);
        // If profile doesn't exist, use data from auth user
        setProfile({
          full_name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
          email: user.email,
          avatar_url: null,
          followers_count: 0,
          following_count: 0,
          bio: null,
        });
      } else {
        console.log('UserHeader: Profile fetched successfully:', data);
        setProfile(data);
      }
    } catch (err) {
      console.error('UserHeader: Unexpected error:', err);
      // Fallback profile
      setProfile({
        full_name: user.email?.split('@')[0] || 'User',
        username: user.email?.split('@')[0] || 'user',
        email: user.email,
        avatar_url: null,
        followers_count: 0,
        following_count: 0,
        bio: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    Alert.alert(
      'Change Profile Picture',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: takePhoto
        },
        {
          text: 'Choose from Library',
          onPress: chooseFromLibrary
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const chooseFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri) => {
    if (!user?.id) return;
    
    setUploading(true);
    const { url, error } = await profileService.uploadAvatar(user.id, uri);
    
    if (error) {
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
      console.error('Upload error:', error);
    } else {
      setProfile(prev => ({ ...prev, avatar_url: url }));
      Alert.alert('Success', 'Profile picture updated!');
    }
    setUploading(false);
  };

  // Show loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5D1F1F" />
      </View>
    );
  }

  // Get display values with fallbacks
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const displayUsername = profile?.username || user?.email?.split('@')[0] || 'user';

  return (
    <View style={styles.wrapper}>
      {/* Gradient Header Background with Safe Area */}
      <LinearGradient
        colors={['#8B4513', '#D2691E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientHeader}
      >
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          {/* Avatar positioned on gradient */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
              {uploading ? (
                <View style={styles.avatar}>
                  <ActivityIndicator size="small" color="#5D1F1F" />
                </View>
              ) : profile?.avatar_url ? (
                <Image 
                  source={{ uri: profile.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#9ca3af" />
                </View>
              )}
              {/* Camera icon overlay */}
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Profile Content - White Background */}
      <View style={styles.container}>
        {/* Name and Username */}
        <View style={styles.nameSection}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.username}>@{displayUsername}</Text>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{profile?.followers_count || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{profile?.following_count || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Share Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Bio Section */}
        {profile?.bio && (
          <View style={styles.bioSection}>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FDF9F0'
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDF9F0',
  },
  gradientHeader: {
    width: '100%'
  },
  safeArea: {
    justifyContent: 'flex-end',
    paddingBottom: 20
  },
  avatarSection: {
    alignItems: 'center'
  },
  avatarContainer: {
    position: 'relative'
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#e5e7eb',
    borderWidth: 4,
    borderColor: '#FDF9F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#e5e7eb',
    borderWidth: 4,
    borderColor: '#FDF9F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#5D1F1F',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FDF9F0'
  },
  container: {
    paddingHorizontal: 16,
    backgroundColor: '#FDF9F0',
    paddingTop: 12
  },
  nameSection: {
    alignItems: 'center',
    marginBottom: 16
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4
  },
  username: {
    fontSize: 15,
    color: '#6b7280'
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    marginBottom: 16
  },
  stat: {
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280'
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#FDF9F0',
    alignItems: 'center'
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827'
  },
  bioSection: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    textAlign: 'center'
  }
});
