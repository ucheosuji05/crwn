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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Scissors } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { postService } from '../services/postService';
import { stylistService } from '../services/stylistService';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';

export default function CreatePostScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [title, setTitle]           = useState('');
  const [caption, setCaption]       = useState('');
  const [images, setImages]         = useState([]);
  const [tags, setTags]             = useState([]);
  const [tagInput, setTagInput]     = useState('');
  const [showStylistTag, setShowStylistTag] = useState(false);
  const [stylistQuery, setStylistQuery]     = useState('');
  const [stylistResults, setStylistResults] = useState([]);
  const [selectedStylist, setSelectedStylist] = useState(null);
  const [stylistSearching, setStylistSearching] = useState(false);
  const [loading, setLoading]       = useState(false);

  const ensureJpeg = async (asset) => {
    const uri = asset.uri || '';
    const ext = uri.split('.').pop()?.toLowerCase().split('?')[0];
    const mimeType = asset.mimeType || asset.type || '';
    const isHeic = ext === 'heic' || ext === 'heif'
      || mimeType.includes('heic') || mimeType.includes('heif');
    if (!isHeic) return asset;
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri, [], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      return { ...asset, uri: result.uri, mimeType: 'image/jpeg' };
    } catch {
      return asset;
    }
  };

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
      quality: 0.85,
      selectionLimit: 10,
    });
    if (!result.canceled) {
      const converted = await Promise.all(result.assets.map(ensureJpeg));
      setImages(prev => [...prev, ...converted].slice(0, 10));
    }
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
      aspect: [4, 5],
      quality: 0.85,
    });
    if (!result.canceled) {
      const [converted] = await Promise.all([ensureJpeg(result.assets[0])]);
      setImages(prev => [...prev, converted].slice(0, 10));
    }
  };

  const removeImage = (index) => setImages(images.filter((_, i) => i !== index));

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => setTags(tags.filter(t => t !== tagToRemove));

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
      Alert.alert('No images', 'Please add at least one photo.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('No title', 'Please add a title.');
      return;
    }
    setLoading(true);
    const { error } = await postService.createPost(
      user.id,
      {
        title: title.trim(),
        description: caption.trim(),
        stylistId: showStylistTag ? (selectedStylist?.id || null) : null,
        tags,
      },
      images
    );
    setLoading(false);
    if (error) {
      Alert.alert('Error', 'Failed to create post. Please try again.');
      return;
    }
    navigation?.goBack();
  };

  const renderImageItem = ({ item, index }) => (
    <View style={styles.imageItem}>
      <Image source={{ uri: item.uri }} style={styles.thumbnail} />
      <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(index)}>
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
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>New Post</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Photos ── */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Photos <Text style={styles.required}>*</Text>
            </Text>

            {images.length > 0 && (
              <FlatList
                data={images}
                renderItem={renderImageItem}
                keyExtractor={(_, i) => i.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
              />
            )}

            <View style={styles.photoButtons}>
              <TouchableOpacity style={[styles.photoBtn, { borderColor: colors.primary }]} onPress={pickImages}>
                <Ionicons name="images-outline" size={20} color={colors.primary} />
                <Text style={[styles.photoBtnText, { color: colors.primary }]}>Choose Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.photoBtn, { borderColor: colors.primary }]} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={20} color={colors.primary} />
                <Text style={[styles.photoBtnText, { color: colors.primary }]}>Take Photo</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.subLabel, { color: colors.textMuted }]}>Max 10</Text>
          </View>

          {/* ── Title ── */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight, color: colors.text }]}
              placeholder="Please write your title here"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <Text style={[styles.count, { color: colors.textMuted }]}>{title.length} / 100</Text>
          </View>

          {/* ── Caption ── */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Caption</Text>
            <TextInput
              style={[styles.input, styles.multilineInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight, color: colors.text }]}
              placeholder="Please write your caption here"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={5}
              value={caption}
              onChangeText={setCaption}
              maxLength={300}
              textAlignVertical="top"
            />
            <Text style={[styles.count, { color: colors.textMuted }]}>{caption.length} / 300</Text>
          </View>

          {/* ── Tags ── */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Tags</Text>

            {tags.length > 0 && (
              <View style={styles.tagList}>
                {tags.map((tag, i) => (
                  <TouchableOpacity key={i} style={[styles.tag, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight }]} onPress={() => removeTag(tag)}>
                    <Text style={[styles.tagText, { color: colors.primary }]}>#{tag}</Text>
                    <Ionicons name="close" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.tagRow}>
              <TextInput
                style={[styles.input, styles.tagInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight, color: colors.text }]}
                placeholder="Add a tag"
                placeholderTextColor={colors.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                returnKeyType="done"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.addTagBtn, { backgroundColor: colors.primary, opacity: tagInput.trim() ? 1 : 0.4 }]}
                onPress={addTag}
                disabled={!tagInput.trim()}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.count, { color: colors.textMuted }]}>{tags.length} / 10</Text>
          </View>

          {/* ── Tag a stylist (optional) ── */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Scissors size={18} color={colors.primary} strokeWidth={1.5} />
                <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Tag a Stylist</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, showStylistTag && { backgroundColor: colors.primary }]}
                onPress={() => { setShowStylistTag(v => !v); setStylistQuery(''); setStylistResults([]); setSelectedStylist(null); }}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleThumb, showStylistTag && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            {showStylistTag && (
              <View style={{ marginTop: 12 }}>
                {selectedStylist ? (
                  <View style={[styles.selectedStylist, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight }]}>
                    <Scissors size={16} color={colors.primary} strokeWidth={1.5} />
                    <Text style={[styles.selectedStylistText, { color: colors.primary }]} numberOfLines={1}>
                      {selectedStylist.full_name || selectedStylist.username}
                    </Text>
                    <TouchableOpacity onPress={() => { setSelectedStylist(null); setStylistQuery(''); setStylistResults([]); }}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight, color: colors.text }]}
                      placeholder="Search stylist by name..."
                      placeholderTextColor={colors.textMuted}
                      value={stylistQuery}
                      onChangeText={handleStylistSearch}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {stylistSearching && <Text style={[styles.subLabel, { color: colors.textMuted }]}>Searching...</Text>}
                    {stylistResults.length > 0 && (
                      <View style={[styles.stylistDropdown, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        {stylistResults.slice(0, 5).map((s) => (
                          <TouchableOpacity key={s.id} style={[styles.stylistOption, { borderBottomColor: colors.borderLight }]} onPress={() => { setSelectedStylist(s); setStylistResults([]); }}>
                            <Text style={[styles.stylistName, { color: colors.text }]} numberOfLines={1}>{s.full_name || s.username}</Text>
                            {s.username && <Text style={[styles.stylistHandle, { color: colors.textMuted }]}>@{s.username}</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Share button */}
        <View style={[styles.bottom, { backgroundColor: colors.surface, borderTopColor: colors.borderLight }]}>
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.primary, opacity: (images.length === 0 || !title.trim() || loading) ? 0.5 : 1 }]}
            onPress={handlePost}
            disabled={images.length === 0 || !title.trim() || loading}
            activeOpacity={0.85}
          >
            <Text style={styles.shareBtnText}>{loading ? 'Sharing...' : 'Share'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontFamily: 'Figtree_700Bold' },
  scrollContent: { paddingBottom: 20 },
  section:     { paddingHorizontal: 20, paddingVertical: 18 },
  label:       { fontSize: 15, fontFamily: 'Figtree_600SemiBold', marginBottom: 10 },
  required:    { color: '#ef4444' },
  subLabel:    { fontSize: 12, marginTop: 6 },
  input: {
    fontSize: 15, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, color: c.text,
  },
  multilineInput: { minHeight: 110, textAlignVertical: 'top' },
  count:       { fontSize: 12, marginTop: 6, color: c.textMuted },
  photoButtons: { flexDirection: 'row', gap: 12 },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1,
    backgroundColor: 'transparent',
  },
  photoBtnText: { fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
  imageItem:   { marginRight: 12, position: 'relative' },
  thumbnail:   { width: s(120), height: s(150), borderRadius: 12, backgroundColor: c.borderLight },
  removeImageBtn: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: c.surface, borderRadius: 12,
  },
  coverBadge: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: c.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  coverBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Figtree_600SemiBold' },
  tagList:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  tagText:     { fontSize: 13, fontFamily: 'Figtree_500Medium' },
  tagRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tagInput:    { flex: 1 },
  addTagBtn:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: c.border, padding: 3, justifyContent: 'center',
  },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: c.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  toggleThumbOn:     { alignSelf: 'flex-end' },
  selectedStylist:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  selectedStylistText: { flex: 1, fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  stylistDropdown:   { marginTop: 4, borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  stylistOption:     { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stylistName:       { fontSize: 15, fontFamily: 'Figtree_500Medium', flex: 1 },
  stylistHandle:     { fontSize: 13 },
  bottom: {
    paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth,
  },
  shareBtn: {
    paddingVertical: 16, borderRadius: 12, alignItems: 'center',
  },
  shareBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Figtree_700Bold' },
});
