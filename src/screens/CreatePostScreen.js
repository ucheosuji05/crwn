import React, { useState, useMemo, useRef, useCallback } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  PanResponder,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { postService } from '../services/postService';
import { stylistService } from '../services/stylistService';
import { useTheme } from '../context/ThemeContext';

const PUBLISH_BTN_COLOR = '#4B5945';
const PHOTO_W = s(100);
const PHOTO_H = s(120);
const PHOTO_GAP = 10;
const PHOTO_STEP = PHOTO_W + PHOTO_GAP;

// ─── Drag-to-reorder photo row ────────────────────────────────────────────────

function DraggablePhotoRow({ images, onReorder, onRemove, styles }) {
  // Refs: stable between renders, no re-render on change
  const activeIdxRef = useRef(-1);
  const imagesRef    = useRef(images);
  imagesRef.current  = images;
  const dragAnim     = useRef(new Animated.Value(0)).current;

  // State: drive visual updates
  const [draggingIdx, setDraggingIdx] = useState(-1);
  const [hoverSlot,   setHoverSlot]   = useState(-1);

  // One PanResponder per slot, created once and cached
  const panRefs = useRef([]);

  const makePanResponder = useCallback((index) => PanResponder.create({
    // Don't claim on start — let ScrollView and TouchableOpacity do their thing
    onStartShouldSetPanResponder:            () => false,
    onStartShouldSetPanResponderCapture:     () => false,
    // Only claim move events once the long-press activated this slot
    onMoveShouldSetPanResponder: (_, gs) =>
      activeIdxRef.current === index && (Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2),
    onMoveShouldSetPanResponderCapture:      () => false,

    onPanResponderGrant: () => {
      dragAnim.setValue(0);
    },
    onPanResponderMove: (_, gs) => {
      if (activeIdxRef.current !== index) return;
      dragAnim.setValue(gs.dx);
      const slot = Math.max(0, Math.min(
        imagesRef.current.length - 1,
        Math.round((index * PHOTO_STEP + gs.dx) / PHOTO_STEP)
      ));
      setHoverSlot(slot);
    },
    onPanResponderRelease: (_, gs) => {
      if (activeIdxRef.current !== index) return;
      const dropSlot = Math.max(0, Math.min(
        imagesRef.current.length - 1,
        Math.round((index * PHOTO_STEP + gs.dx) / PHOTO_STEP)
      ));

      Animated.spring(dragAnim, {
        toValue: 0, useNativeDriver: true, tension: 80, friction: 8,
      }).start();

      if (dropSlot !== index) {
        const next = [...imagesRef.current];
        const [moved] = next.splice(index, 1);
        next.splice(dropSlot, 0, moved);
        onReorder(next);
      }

      activeIdxRef.current = -1;
      setDraggingIdx(-1);
      setHoverSlot(-1);
    },
    onPanResponderTerminate: () => {
      Animated.spring(dragAnim, { toValue: 0, useNativeDriver: true }).start();
      activeIdxRef.current = -1;
      setDraggingIdx(-1);
      setHoverSlot(-1);
    },
  }), []);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={draggingIdx === -1}
      style={{ marginBottom: 12 }}
      contentContainerStyle={{ paddingRight: 4 }}
    >
      {images.map((img, index) => {
        if (!panRefs.current[index]) {
          panRefs.current[index] = makePanResponder(index);
        }

        const isDragging = index === draggingIdx;

        // Non-dragging items shift to visually make room
        let displaceX = 0;
        if (draggingIdx !== -1 && !isDragging) {
          const d = draggingIdx, h = hoverSlot;
          if (d < h && index > d && index <= h) displaceX = -PHOTO_STEP;
          else if (d > h && index < d && index >= h) displaceX = PHOTO_STEP;
        }

        return (
          <Animated.View
            key={img.uri || index}
            style={[
              styles.imageItem,
              {
                transform: [{
                  translateX: isDragging ? dragAnim : displaceX,
                }],
                zIndex:     isDragging ? 100 : 1,
                opacity:    isDragging ? 0.85 : 1,
              },
              isDragging && {
                shadowColor:   '#000',
                shadowOpacity: 0.2,
                shadowRadius:  10,
                elevation:     10,
              },
            ]}
            {...panRefs.current[index].panHandlers}
          >
            {/* Long-press area — activates drag */}
            <TouchableOpacity
              activeOpacity={0.9}
              delayLongPress={180}
              onLongPress={() => {
                activeIdxRef.current = index;
                setDraggingIdx(index);
                setHoverSlot(index);
              }}
            >
              <Image source={{ uri: img.uri }} style={styles.thumbnail} />
              {index === 0 && (
                <View style={styles.coverBadge}>
                  <Text style={styles.coverBadgeText}>Cover</Text>
                </View>
              )}
              {isDragging && (
                <View style={styles.dragOverlay}>
                  <Ionicons name="reorder-three-outline" size={22} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {/* Remove button — separate from long-press area */}
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => onRemove(index)}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Ionicons name="close-circle" size={22} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CreatePostScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [title, setTitle]           = useState('');
  const [caption, setCaption]       = useState('');
  const [images, setImages]         = useState([]);
  const [tags, setTags]             = useState([]);
  const [tagInput, setTagInput]     = useState('');
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

  const clearStylist = () => {
    setSelectedStylist(null);
    setStylistQuery('');
    setStylistResults([]);
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
      {
        title: title.trim(),
        description: caption.trim(),
        stylistId: selectedStylist?.id || null,
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

  const canPublish = images.length > 0 && title.trim() && !loading;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Create Post</Text>
            <Text style={styles.headerSub}>Explore</Text>
          </View>
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
            <Text style={styles.label}>
              Photos <Text style={styles.required}>*</Text>
            </Text>

            {images.length > 0 && (
              <DraggablePhotoRow
                images={images}
                onReorder={setImages}
                onRemove={removeImage}
                styles={styles}
              />
            )}

            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.photoBtn} onPress={pickImages}>
                <Ionicons name="images-outline" size={20} color={colors.text} />
                <Text style={styles.photoBtnText}>Add Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={20} color={colors.text} />
                <Text style={styles.photoBtnText}>Take Photo</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.subLabel}>Max 10</Text>
          </View>

          {/* ── Title ── */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Please write your title here"
              placeholderTextColor={colors.placeholder}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <Text style={styles.count}>{title.length}/100</Text>
          </View>

          {/* ── Tags ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Tags</Text>
            <View style={styles.tagRow}>
              <TextInput
                style={[styles.input, styles.rowInput]}
                placeholder="Add a tag"
                placeholderTextColor={colors.placeholder}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                returnKeyType="done"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.addBtn, { opacity: tagInput.trim() ? 1 : 0.4 }]}
                onPress={addTag}
                disabled={!tagInput.trim()}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={styles.chipRow}>
                {tags.map((tag, i) => (
                  <TouchableOpacity key={i} style={styles.chip} onPress={() => removeTag(tag)}>
                    <Text style={styles.chipText}>#{tag.toUpperCase()}</Text>
                    <Ionicons name="close" size={12} color="#F5DFB8" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.count}>{tagInput.length}/100</Text>
          </View>

          {/* ── Service Provider Tag ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Service Provider Tag</Text>
            <View style={styles.tagRow}>
              {selectedStylist ? (
                <View style={[styles.input, styles.rowInput, styles.stylistSelectedRow]}>
                  <Text style={styles.stylistSelectedText} numberOfLines={1}>
                    @{selectedStylist.full_name || selectedStylist.username}
                  </Text>
                  <TouchableOpacity onPress={clearStylist} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TextInput
                  style={[styles.input, styles.rowInput]}
                  placeholder="Tag your service provider"
                  placeholderTextColor={colors.placeholder}
                  value={stylistQuery}
                  onChangeText={handleStylistSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
              <TouchableOpacity
                style={[styles.addBtn, { opacity: stylistResults.length > 0 && !selectedStylist ? 1 : 0.4 }]}
                onPress={() => {
                  if (stylistResults.length > 0 && !selectedStylist) {
                    setSelectedStylist(stylistResults[0]);
                    setStylistResults([]);
                  }
                }}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {stylistSearching && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
            )}
            {stylistResults.length > 0 && !selectedStylist && (
              <View style={styles.dropdown}>
                {stylistResults.slice(0, 5).map((stylist) => (
                  <TouchableOpacity
                    key={stylist.id}
                    style={styles.dropdownItem}
                    onPress={() => { setSelectedStylist(stylist); setStylistResults([]); }}
                  >
                    <Text style={styles.dropdownName} numberOfLines={1}>
                      {stylist.full_name || stylist.username}
                    </Text>
                    {stylist.username && (
                      <Text style={styles.dropdownHandle}>@{stylist.username}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.count}>{stylistQuery.length}/100</Text>
          </View>

          {/* ── Caption ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Caption</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Share more details about your post"
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={4}
              value={caption}
              onChangeText={setCaption}
              maxLength={300}
              textAlignVertical="top"
            />
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Publish button */}
        <View style={[styles.bottom, { borderTopColor: colors.borderLight }]}>
          <TouchableOpacity
            style={[styles.publishBtn, { opacity: canPublish ? 1 : 0.5 }]}
            onPress={handlePost}
            disabled={!canPublish}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.publishBtnText}>Publish</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderLight,
  },
  closeBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 16, fontFamily: 'Figtree_700Bold', color: c.text },
  headerSub:   { fontSize: 12, fontFamily: 'Figtree_500Medium', color: c.accent, marginTop: 1 },
  scrollContent: { paddingBottom: 20 },
  section:     { paddingHorizontal: 20, paddingTop: 20 },
  label:       { fontSize: 14, fontFamily: 'Figtree_600SemiBold', color: c.text, marginBottom: 10 },
  required:    { color: '#ef4444' },
  subLabel:    { fontSize: 12, color: c.textMuted, marginTop: 6 },
  count:       { fontSize: 12, color: c.textMuted, marginTop: 6, textAlign: 'right' },
  input: {
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: c.surfaceAlt,
    color: c.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
  },
  multilineInput: { minHeight: 110, textAlignVertical: 'top' },
  photoButtons: { flexDirection: 'row', gap: 12 },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceAlt,
  },
  photoBtnText: { fontSize: 14, fontFamily: 'Figtree_500Medium', color: c.text },

  // ── Photo drag row ──
  imageItem:      { width: PHOTO_W, marginRight: PHOTO_GAP, position: 'relative' },
  thumbnail:      { width: PHOTO_W, height: PHOTO_H, borderRadius: 10, backgroundColor: c.borderLight },
  removeImageBtn: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 11,
  },
  coverBadge: {
    position: 'absolute', bottom: 5, left: 5,
    backgroundColor: c.primary, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  coverBadgeText: { color: '#fff', fontSize: 10, fontFamily: 'Figtree_600SemiBold' },
  dragOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Tags / chips ──
  tagRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowInput:    { flex: 1 },
  addBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#B35D2B',
    alignItems: 'center', justifyContent: 'center',
  },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(93, 31, 31, 0.8)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  },
  chipText:    { fontSize: 12, fontFamily: 'Figtree_600SemiBold', color: '#F5DFB8' },

  // ── Stylist ──
  stylistSelectedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13,
  },
  stylistSelectedText: { flex: 1, fontSize: 14, fontFamily: 'Figtree_500Medium', color: c.text },
  dropdown: {
    marginTop: 4, borderWidth: 1, borderColor: c.border,
    borderRadius: 10, overflow: 'hidden', backgroundColor: c.surface,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderLight,
  },
  dropdownName:   { fontSize: 14, fontFamily: 'Figtree_500Medium', color: c.text, flex: 1 },
  dropdownHandle: { fontSize: 12, color: c.textMuted },

  // ── Bottom ──
  bottom: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: c.background,
  },
  publishBtn: {
    paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    backgroundColor: PUBLISH_BTN_COLOR,
  },
  publishBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Figtree_700Bold' },
});
