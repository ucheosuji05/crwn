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
  Modal,
  FlatList,
} from 'react-native';

const US_STATES = [
  { abbr: 'AL', name: 'Alabama' }, { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' }, { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' }, { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' }, { abbr: 'DE', name: 'Delaware' },
  { abbr: 'FL', name: 'Florida' }, { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' }, { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' }, { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' }, { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' }, { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' }, { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' }, { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' }, { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' }, { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' }, { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' }, { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' }, { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' }, { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' }, { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' }, { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' }, { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' }, { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' }, { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' }, { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' }, { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' }, { abbr: 'WY', name: 'Wyoming' },
  { abbr: 'DC', name: 'Washington D.C.' },
];
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
  const [originalUsername, setOriginalUsername] = useState('');
  const [bio, setBio] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locStateAbbr, setLocStateAbbr] = useState('');
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [phone, setPhone] = useState('');


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
      setOriginalUsername(data.username || '');
      setBio(data.bio || '');
      const loc = data.location || '';
      const commaIdx = loc.lastIndexOf(', ');
      if (commaIdx !== -1) {
        setLocCity(loc.slice(0, commaIdx));
        setLocStateAbbr(loc.slice(commaIdx + 2));
      } else {
        setLocCity(loc);
      }
      setPhone(data.phone || '');

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

    const newUsername = username.trim().toLowerCase();
    if (newUsername !== originalUsername) {
      const { available } = await profileService.checkUsernameAvailable(newUsername, user.id);
      if (!available) {
        Alert.alert('Username taken', 'That username is already in use. Please choose a different one.');
        setSaving(false);
        return;
      }
    }

    // Update profile
    const { error: profileError } = await profileService.updateProfile(user.id, {
      full_name: fullName.trim(),
      username: username.trim().toLowerCase(),
      bio: bio.trim(),
      location: locCity.trim() && locStateAbbr ? `${locCity.trim()}, ${locStateAbbr}` : locCity.trim(),
      phone: phone.trim(),
    });

    if (profileError) {
      Alert.alert('Error', profileError.message || 'Failed to update profile');
      setSaving(false);
      return;
    }

    // Refresh AuthContext so every component reading profile stays in sync
    await refreshProfile(user.id);

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

          <Text style={styles.label}>State</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => { setStateSearch(''); setShowStatePicker(true); }}
          >
            <Text style={[styles.input, styles.pickerButtonText, !locStateAbbr && { color: colors.placeholder }]}>
              {locStateAbbr
                ? `${US_STATES.find(s => s.abbr === locStateAbbr)?.name} (${locStateAbbr})`
                : 'Select a state'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.placeholder} style={{ marginRight: 12 }} />
          </TouchableOpacity>

          {locStateAbbr ? (
            <>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={locCity}
                onChangeText={setLocCity}
                placeholder="Enter your city"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="words"
              />
            </>
          ) : null}

          <Modal
            visible={showStatePicker}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowStatePicker(false)}
          >
            <View style={styles.pickerModal}>
              <View style={styles.pickerModalHeader}>
                <Text style={styles.pickerModalTitle}>Select State</Text>
                <TouchableOpacity onPress={() => setShowStatePicker(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.pickerSearchWrap}>
                <Ionicons name="search" size={16} color={colors.placeholder} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                  placeholder="Search states…"
                  placeholderTextColor={colors.placeholder}
                  value={stateSearch}
                  onChangeText={setStateSearch}
                  autoFocus
                />
              </View>
              <FlatList
                data={stateSearch
                  ? US_STATES.filter(s =>
                      s.name.toLowerCase().includes(stateSearch.toLowerCase()) ||
                      s.abbr.toLowerCase().includes(stateSearch.toLowerCase()))
                  : US_STATES}
                keyExtractor={item => item.abbr}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, item.abbr === locStateAbbr && styles.pickerItemSelected]}
                    onPress={() => {
                      setLocStateAbbr(item.abbr);
                      setLocCity('');
                      setStateSearch('');
                      setShowStatePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, item.abbr === locStateAbbr && { color: colors.primary }]}>
                      {item.name}
                    </Text>
                    <Text style={styles.pickerItemAbbr}>{item.abbr}</Text>
                    {item.abbr === locStateAbbr && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.pickerSep} />}
              />
            </View>
          </Modal>

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

  // State picker
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: c.inputBackground || c.surface,
  },
  pickerButtonText: {
    flex: 1,
    marginBottom: 0,
    borderWidth: 0,
  },
  pickerModal: {
    flex: 1,
    backgroundColor: c.background,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  pickerModalTitle: {
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
  },
  pickerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    backgroundColor: c.inputBackground || c.surface,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerItemSelected: {
    backgroundColor: c.primaryLight || '#FDF1EE',
  },
  pickerItemText: {
    flex: 1,
    fontSize: 16,
    color: c.text,
    fontFamily: 'Figtree_400Regular',
  },
  pickerItemAbbr: {
    fontSize: 14,
    color: c.textMuted,
    fontFamily: 'Figtree_500Medium',
    marginRight: 8,
  },
  pickerSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginLeft: 16,
  },
});
