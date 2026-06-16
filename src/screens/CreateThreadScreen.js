import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Globe } from 'lucide-react-native';
import { useAuth } from '../hooks/useAuth';
import { threadService } from '../services/threadService';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PUBLISH_BTN_COLOR = '#4B5945';
const OCHRE = '#B35D2B';

const CATEGORIES = [
  'Styling',
  'Hair Health',
  'Product Recommendations',
  'Beginners',
  'Other',
];

const GUIDELINES = [
  'Be respectful.',
  'Be helpful.',
  'Share facts, not misinformation.',
  'Keep content relevant to textured hair.',
  'No hate, harassment, or spam.',
  'Respect privacy.',
  'Celebrate every hair journey.',
];

export default function CreateThreadScreen({ onBack, onThreadCreated }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [category, setCategory]         = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [title, setTitle]               = useState('');
  const [body, setBody]                 = useState('');
  const [loading, setLoading]           = useState(false);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);

  const isValid = category && title.trim().length >= 5 && body.trim().length >= 10;

  const handlePost = async () => {
    if (!isValid || loading) return;
    if (!user) {
      Alert.alert('Sign in required', 'You need to be signed in to post.');
      return;
    }
    setLoading(true);
    const { data, error } = await threadService.createThread({
      category,
      title: title.trim(),
      body: body.trim(),
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', 'Could not create your discussion. Please try again.');
      return;
    }
    onThreadCreated?.(data);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Create Post</Text>
          <Text style={styles.headerSub}>Community</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Category dropdown ── */}
        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            onPress={() => setDropdownOpen(v => !v)}
            activeOpacity={0.85}
          >
            <Text style={[styles.dropdownTriggerText, !category && styles.dropdownPlaceholder]}>
              {category || 'Select a category'}
            </Text>
            <Ionicons
              name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {dropdownOpen && (
            <View style={styles.dropdownList}>
              {CATEGORIES.map((cat, i) => {
                const isSelected = cat === category;
                const isLast = i === CATEGORIES.length - 1;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.dropdownItem, !isLast && styles.dropdownItemBorder, isSelected && styles.dropdownItemSelected]}
                    onPress={() => { setCategory(cat); setDropdownOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Title ── */}
        <View style={styles.section}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="What's your question or topic?"
            placeholderTextColor={colors.placeholder}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            returnKeyType="next"
          />
          <Text style={styles.count}>{title.length}/100</Text>
        </View>

        {/* ── Description ── */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.bodyInput]}
            placeholder="Share more details about your question or experience..."
            placeholderTextColor={colors.placeholder}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={6}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.count}>{body.length}/500</Text>
        </View>

        {/* ── Post Guidelines button ── */}
        <View style={styles.guidelinesRow}>
          <TouchableOpacity
            style={styles.guidelinesBtn}
            onPress={() => setGuidelinesOpen(true)}
            activeOpacity={0.8}
          >
            <Globe size={15} color="#fff" strokeWidth={2} />
            <Text style={styles.guidelinesBtnText}>POST GUIDELINES</Text>
            <Ionicons name="chevron-down" size={13} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Publish button ── */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity
          style={[styles.publishBtn, { opacity: isValid && !loading ? 1 : 0.5 }]}
          onPress={handlePost}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.publishBtnText}>Publish</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── Post Guidelines modal ── */}
      <Modal
        visible={guidelinesOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setGuidelinesOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setGuidelinesOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Globe size={22} color={OCHRE} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Community Post</Text>
                <Text style={styles.modalSubtitle}>Guidelines</Text>
              </View>
              <TouchableOpacity onPress={() => setGuidelinesOpen(false)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Guidelines list */}
            <View style={styles.modalBody}>
              {GUIDELINES.map((g, i) => (
                <View key={i} style={styles.guidelineRow}>
                  <Text style={styles.guidelineCheck}>✓</Text>
                  <Text style={styles.guidelineText}>{g}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  root:          { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderLight,
    backgroundColor: c.background,
  },
  closeBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter:  { alignItems: 'center', flex: 1 },
  headerTitle:   { fontSize: 16, fontFamily: 'Figtree_700Bold', color: c.text },
  headerSub:     { fontSize: 12, fontFamily: 'Figtree_500Medium', color: c.accent, marginTop: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  section:       { paddingHorizontal: 20, paddingTop: 20 },
  label:         { fontSize: 14, fontFamily: 'Figtree_600SemiBold', color: c.text, marginBottom: 10 },
  count:         { fontSize: 12, color: c.textMuted, marginTop: 6, textAlign: 'right' },

  // ── Category dropdown ──
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surfaceAlt,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dropdownTriggerText: { fontSize: 14, fontFamily: 'Figtree_600SemiBold', color: OCHRE },
  dropdownPlaceholder: { color: c.placeholder, fontFamily: 'Figtree_500Medium' },
  dropdownList: {
    marginTop: 4,
    backgroundColor: c.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(179, 93, 43, 0.08)',
  },
  dropdownItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderLight,
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
    color: c.text,
  },
  dropdownItemActive: {
    color: OCHRE,
    fontFamily: 'Figtree_600SemiBold',
  },

  // ── Inputs ──
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
  bodyInput: { minHeight: 160, textAlignVertical: 'top' },

  // ── Post Guidelines button ──
  guidelinesRow: { paddingHorizontal: 20, paddingTop: 20 },
  guidelinesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: OCHRE,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  guidelinesBtnText: {
    fontSize: 12,
    fontFamily: 'Figtree_700Bold',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // ── Publish button ──
  bottom: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderLight,
    backgroundColor: c.background,
  },
  publishBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: PUBLISH_BTN_COLOR,
  },
  publishBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Figtree_700Bold' },

  // ── Guidelines modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0ece8',
  },
  modalIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FEF3E2',
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle:    { fontSize: 15, fontFamily: 'Figtree_700Bold', color: '#111' },
  modalSubtitle: { fontSize: 12, fontFamily: 'Figtree_400Regular', color: '#888', marginTop: 1 },
  modalClose: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  modalBody:     { paddingHorizontal: 20, paddingVertical: 18, gap: 12 },
  guidelineRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  guidelineCheck: { fontSize: 14, color: OCHRE, fontFamily: 'Figtree_700Bold', lineHeight: 20 },
  guidelineText:  { flex: 1, fontSize: 14, fontFamily: 'Figtree_400Regular', color: '#222', lineHeight: 20 },
});
