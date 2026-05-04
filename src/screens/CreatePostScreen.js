import React, { useState, useMemo } from 'react';
import { s } from '../utils/responsive';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { postService } from '../services/postService';
import { stylistService } from '../services/stylistService';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';

export default function CreatePostScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [showStylistTag, setShowStylistTag] = useState(false);
  const [stylistQuery, setStylistQuery] = useState('');
  const [stylistResults, setStylistResults] = useState([]);
  const [selectedStylist, setSelectedStylist] = useState(null);
  const [stylistSearching, setStylistSearching] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      aspect: [4, 5],
      quality: 0.8,
      selectionLimit: 10, // Max 10 images
    });

    if (!result.canceled) {
      setImages([...images, ...result.assets]);
    }
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
      aspect: [4, 5],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages([...images, result.assets[0]]);
    }
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleStylistSearch = async (query) => {
    setStylistQuery(query);
    setSelectedStylist(null);
    if (!query.trim()) { setStylistResults([]); return; }
    setStylistSearching(true);
    const { data } = await stylistService.searchStylists(query);
    setStylistResults(data || []);
    setStylistSearching(false);
  };

  const handlePost = async () => {
    if (images.length === 0) {
      Alert.alert('No images', 'Please add at least one photo to your post.');
      return;
    }

    if (!title.trim()) {
      Alert.alert('No title', 'Please add a title to your post.');
      return;
    }

    setLoading(true);

    const { data, error } = await postService.createPost(
      user.id,
      {
        title: title.trim(),
        description: description.trim(),
        stylistId: showStylistTag ? (selectedStylist?.id || null) : null,
        tags,
      },
      images
    );

    setLoading(false);

    if (error) {
      Alert.alert('Error', 'Failed to create post. Please try again.');
      console.error('Post creation error:', error);
      return;
    }

    navigation?.goBack();
  };

  const renderImageItem = ({ item, index }) => (
    <View style={styles.imageItem}>
      <Image source={{ uri: item.uri }} style={styles.thumbnail} />
      <TouchableOpacity
        style={styles.removeImageButton}
        onPress={() => removeImage(index)}
      >
        <Ionicons name="close-circle" size={24} color="#ef4444" />
      </TouchableOpacity>
      {index === 0 && (
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeText}>Cover</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={90}
    >
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.closeButton}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>New Post</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >

        {/* Title Input */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Give your post a catchy title..."
            placeholderTextColor={colors.placeholder}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <Text style={styles.charCount}>{title.length}/100</Text>
        </View>

        {/* Images Section */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Photos <Text style={styles.required}>*</Text>
          </Text>

          {images.length > 0 && (
            <FlatList
              data={images}
              renderItem={renderImageItem}
              keyExtractor={(item, index) => index.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imagesList}
              contentContainerStyle={styles.imagesListContent}
            />
          )}

          <View style={styles.imageButtons}>
            <TouchableOpacity
              style={styles.imageButton}
              onPress={pickImages}
            >
              <Ionicons name="images-outline" size={24} color={colors.primary} />
              <Text style={styles.imageButtonText}>Choose Photos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.imageButton}
              onPress={takePhoto}
            >
              <Ionicons name="camera-outline" size={24} color={colors.primary} />
              <Text style={styles.imageButtonText}>Take Photo</Text>
            </TouchableOpacity>
          </View>

          {images.length > 0 && (
            <Text style={styles.imageCount}>
              {images.length} {images.length === 1 ? 'photo' : 'photos'} selected (max 10)
            </Text>
          )}
        </View>

        {/* Description Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Tell us about your hairstyle, products used, your experience..."
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={6}
            value={description}
            onChangeText={setDescription}
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/1000</Text>
        </View>

        {/* Tags Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Tags</Text>
          <Text style={styles.hint}>
            Add tags to help others find your post (e.g., silkpress, braids, naturalhair)
          </Text>

          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                  <TouchableOpacity onPress={() => removeTag(tag)}>
                    <Ionicons name="close" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.tagInputContainer}>
            <TextInput
              style={styles.tagInput}
              placeholder="Add a tag..."
              placeholderTextColor={colors.placeholder}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              returnKeyType="done"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.addTagButton}
              onPress={addTag}
              disabled={!tagInput.trim()}
            >
              <Ionicons
                name="add-circle"
                size={28}
                color={tagInput.trim() ? colors.primary : colors.border}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stylist Tag Section */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Ionicons name="cut-outline" size={18} color={colors.primary} />
              <Text style={styles.switchLabelText}>Tag a stylist</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, showStylistTag && styles.toggleOn]}
              onPress={() => {
                setShowStylistTag(v => !v);
                setStylistQuery('');
                setStylistResults([]);
                setSelectedStylist(null);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleThumb, showStylistTag && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>

          {showStylistTag && (
            <View style={{ marginTop: 12 }}>
              {selectedStylist ? (
                <View style={styles.selectedStylist}>
                  <Ionicons name="cut-outline" size={16} color={colors.primary} />
                  <Text style={styles.selectedStylistText} numberOfLines={1}>
                    {selectedStylist.full_name || selectedStylist.username}
                  </Text>
                  <TouchableOpacity onPress={() => { setSelectedStylist(null); setStylistQuery(''); setStylistResults([]); }}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.titleInput}
                    placeholder="Search stylist by name..."
                    placeholderTextColor={colors.placeholder}
                    value={stylistQuery}
                    onChangeText={handleStylistSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {stylistSearching && (
                    <Text style={styles.stylistSearchHint}>Searching...</Text>
                  )}
                  {stylistResults.length > 0 && (
                    <View style={styles.stylistDropdown}>
                      {stylistResults.slice(0, 5).map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          style={styles.stylistOption}
                          onPress={() => {
                            setSelectedStylist(s);
                            setStylistResults([]);
                          }}
                        >
                          <Text style={styles.stylistOptionName} numberOfLines={1}>
                            {s.full_name || s.username}
                          </Text>
                          {s.username && (
                            <Text style={styles.stylistOptionHandle} numberOfLines={1}>
                              @{s.username}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {!stylistSearching && stylistQuery.trim().length > 0 && stylistResults.length === 0 && (
                    <Text style={styles.stylistSearchHint}>No stylists found</Text>
                  )}
                </>
              )}
            </View>
          )}
        </View>

        {/* Spacer for bottom button */}
        <View style={styles.spacer} />
      </ScrollView>

      {/* Post Button - Fixed at bottom */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.postButton,
            (images.length === 0 || !title.trim() || loading) && styles.postButtonDisabled
          ]}
          onPress={handlePost}
          disabled={images.length === 0 || !title.trim() || loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={styles.postButtonText}>Posting...</Text>
            </View>
          ) : (
            <View style={styles.loadingContainer}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.postButtonText}>Post</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: c.textSecondary,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  hint: {
    fontSize: 13,
    color: c.textMuted,
    marginBottom: 12,
  },
  titleInput: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: c.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
  },
  descriptionInput: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: c.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    minHeight: 100,
    color: c.text,
  },
  charCount: {
    fontSize: 11,
    color: c.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  imageButtonText: {
    fontSize: 15,
    color: c.primary,
    fontFamily: 'Figtree_600SemiBold',
  },
  imagesList: {
    marginBottom: 12,
  },
  imagesListContent: {
    paddingRight: 20,
  },
  imageItem: {
    marginRight: 12,
    position: 'relative',
  },
  thumbnail: {
    width: s(120),
    height: s(150),
    borderRadius: 12,
    backgroundColor: c.borderLight,
  },
  removeImageButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: c.surface,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: c.primary, //rgba(59, 130, 246, 0.9)', //change this
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  coverBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Figtree_600SemiBold',
  },
  imageCount: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  tagText: {
    fontSize: 14,
    color: c.primary,
    fontFamily: 'Figtree_500Medium',
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: c.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
  },
  addTagButton: {
    padding: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchLabelText: {
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.border,
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: c.primary,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  selectedStylist: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectedStylistText: {
    flex: 1,
    fontSize: 15,
    color: c.primary,
    fontFamily: 'Figtree_600SemiBold',
  },
  stylistDropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: c.surface,
  },
  stylistOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stylistOptionName: {
    fontSize: 15,
    color: c.text,
    fontFamily: 'Figtree_500Medium',
    flex: 1,
  },
  stylistOptionHandle: {
    fontSize: 13,
    color: c.textMuted,
  },
  stylistSearchHint: {
    fontSize: 13,
    color: c.textMuted,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  spacer: {
    height: 20,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: c.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  postButton: {
    backgroundColor: c.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  postButtonDisabled: {
    backgroundColor: c.textMuted,
    opacity: 0.6,
    shadowOpacity: 0,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Figtree_700Bold',
  },
});
