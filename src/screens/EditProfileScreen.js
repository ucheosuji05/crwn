import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { profileService } from '../services/profileService';
import { useTheme } from '../context/ThemeContext';

export default function EditProfileScreen({ onBack, onSave }) {
  const { user, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');

  // Hair profile fields
  const [hairType, setHairType] = useState('');
  const [porosity, setPorosity] = useState('');
  const [density, setDensity] = useState('');
  const [texture, setTexture] = useState('');
  const [length, setLength] = useState('');
  const [goals, setGoals] = useState([]);
  const [goalsInput, setGoalsInput] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    const { data, error } = await profileService.getProfile(user.id);

    if (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } else {
      // Set profile data
      setAvatarUrl(data.avatar_url || null);
      setFullName(data.full_name || '');
      setUsername(data.username || '');
      setBio(data.bio || '');
      setLocation(data.location || '');
      setPhone(data.phone || '');

      // Set hair profile data
      const hairProfile = data.hair_profiles?.[0];
      if (hairProfile) {
        setHairType(hairProfile.hair_type || '');
        setPorosity(hairProfile.porosity || '');
        setDensity(hairProfile.density || '');
        setTexture(hairProfile.texture || '');
        setLength(hairProfile.length || '');

        // Parse goals if it's a JSON string
        const goalsData = typeof hairProfile.goals === 'string'
          ? JSON.parse(hairProfile.goals || '[]')
          : hairProfile.goals || [];
        setGoals(goalsData);
        setGoalsInput(goalsData.join(', '));
      }
    }
    setLoading(false);
  };

  const pickImage = () => {
    if (Platform.OS === 'web') {
      chooseFromLibrary();
      return;
    }
    Alert.alert('Change Profile Picture', 'Choose an option', [
      { text: 'Take Photo',          onPress: takePhoto },
      { text: 'Choose from Library', onPress: chooseFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) uploadAvatar(result.assets[0].uri);
  };

  const chooseFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) uploadAvatar(result.assets[0].uri);
  };

  const uploadAvatar = async (uri) => {
    if (!user?.id) return;
    setUploading(true);
    const { url, error } = await profileService.uploadAvatar(user.id, uri);
    if (error) {
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } else {
      setAvatarUrl(url);
      await refreshProfile(user.id);
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!fullName.trim() || !username.trim()) {
      Alert.alert('Error', 'Name and username are required');
      return;
    }

    setSaving(true);

    // Update profile
    const { error: profileError } = await profileService.updateProfile(user.id, {
      full_name: fullName.trim(),
      username: username.trim().toLowerCase(),
      bio: bio.trim(),
      location: location.trim(),
      phone: phone.trim(),
    });

    if (profileError) {
      Alert.alert('Error', profileError.message || 'Failed to update profile');
      setSaving(false);
      return;
    }

    // Parse goals from comma-separated string
    const parsedGoals = goalsInput
      .split(',')
      .map(g => g.trim())
      .filter(g => g.length > 0);

    // Update hair profile
    const { error: hairError } = await profileService.updateHairProfile(user.id, {
      hair_type: hairType,
      porosity: porosity,
      density: density,
      texture: texture,
      length: length,
      goals: parsedGoals,
    });

    if (hairError) {
      console.error('Hair profile update error:', hairError);
      Alert.alert('Warning', 'Profile updated but hair profile update failed');
    }

    setSaving(false);
    Alert.alert('Success', 'Profile updated!', [
      {
        text: 'OK',
        onPress: () => {
          // Notify parent to refresh
          if (onSave) {
            onSave();
          }
          if (onBack) {
            onBack();
          }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          <Ionicons name="close" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.headerButton}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={styles.avatarWrap}>
            {uploading ? (
              <View style={styles.avatarCircle}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarCircle} />
            ) : (
              <View style={[styles.avatarCircle, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={40} color={colors.textMuted} />
              </View>
            )}
            <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.changePhotoText, { color: colors.primary }]}>Change Photo</Text>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={styles.label}>Username *</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself"
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="City, State"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor={colors.placeholder}
            keyboardType="phone-pad"
          />
        </View>

        {/* Hair Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hair Profile</Text>
          <Text style={styles.sectionDescription}>
            This information helps us personalize your experience
          </Text>

          <Text style={styles.label}>Hair Type</Text>
          <TextInput
            style={styles.input}
            value={hairType}
            onChangeText={setHairType}
            placeholder="e.g., Type 4C, 3B, Coily"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={styles.label}>Porosity</Text>
          <TextInput
            style={styles.input}
            value={porosity}
            onChangeText={setPorosity}
            placeholder="Low, Medium, High"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={styles.label}>Density</Text>
          <TextInput
            style={styles.input}
            value={density}
            onChangeText={setDensity}
            placeholder="Low, Medium, High"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={styles.label}>Texture</Text>
          <TextInput
            style={styles.input}
            value={texture}
            onChangeText={setTexture}
            placeholder="e.g., Coarse, Fine, Medium"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={styles.label}>Length</Text>
          <TextInput
            style={styles.input}
            value={length}
            onChangeText={setLength}
            placeholder="e.g., Short, Shoulder Length, Long"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={styles.label}>Hair Goals</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={goalsInput}
            onChangeText={setGoalsInput}
            placeholder="e.g., Hair growth, Damage repair, Moisture retention (separate with commas)"
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.helpText}>
            Separate multiple goals with commas
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.surface,
  },
  headerButton: {
    padding: 4,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
  },
  saveText: {
    fontSize: 16,
    fontFamily: 'Figtree_600SemiBold',
    color: c.primary,
    textAlign: 'right',
  },
  scrollView: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 8,
    borderBottomColor: c.surfaceAlt,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholder: {
    backgroundColor: c.borderLight,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.surface,
  },
  changePhotoText: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
  },
  section: {
    padding: 16,
    borderBottomWidth: 8,
    borderBottomColor: c.surfaceAlt,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: c.textSecondary,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
    color: c.text,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: c.text,
    backgroundColor: c.surface,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
