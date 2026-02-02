import  React, { useState, useEffect } from 'react';
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
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { profileService } from '../services/profileService';

export default function EditProfileScreen({ onBack }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
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
      }
    }
    setLoading(false);
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

    // Update hair profile
    if (hairType || porosity || density) {
      const { error: hairError } = await profileService.updateHairProfile(user.id, {
        hair_type: hairType,
        porosity: porosity,
        density: density,
      });

      if (hairError) {
        console.error('Hair profile update error:', hairError);
      }
    }

    setSaving(false);
    Alert.alert('Success', 'Profile updated!', [
      { text: 'OK', onPress: onBack }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5D1F1F" />
      </View>
    );
  }

  return (
    <View style={styles.fullContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#5D1F1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Username *</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="City, State"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
            />
          </View>

          {/* Hair Profile */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hair Profile</Text>
            
            <Text style={styles.label}>Hair Type</Text>
            <TextInput
              style={styles.input}
              value={hairType}
              onChangeText={setHairType}
              placeholder="e.g., 3B, 4A, Relaxed"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Porosity</Text>
            <TextInput
              style={styles.input}
              value={porosity}
              onChangeText={setPorosity}
              placeholder="Low, Medium, High"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Density</Text>
            <TextInput
              style={styles.input}
              value={density}
              onChangeText={setDensity}
              placeholder="Low, Medium, High"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: '#FDF9F0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDF9F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5D1F1F',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
