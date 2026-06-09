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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { threadService } from '../services/threadService';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORIES =[
  'Low Porosity',
  'High Porosity',
  'Protective Styles',
  'Styling Tips',
  'Beginner',
  'Product Reviews',
  'Hair Health',
  'General',
];

/**
 * CreateThreadScreen
 *
 * Props:
 *   onBack()                 — go back without creating
 *   onThreadCreated(thread)  — called with the new thread row after successful creation
 */
export default function CreateThreadScreen({ onBack, onThreadCreated }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [category, setCategory] = useState('');
  const [title, setTitle]       = useState('');
  const [body, setBody]         = useState('');
  const [loading, setLoading]   = useState(false);

  const isValid = category && title.trim().length >= 5 && body.trim().length >= 10;

  const handlePost = async () => {
    if (!isValid || loading) return;
    if (!user) {
      Alert.alert('Sign in required', 'You need to be signed in to post.');
      return;
    }

    setLoading(true);
    const { data, error } = await threadService.createThread(user.id, {
      category,
      title: title.trim(),
      body: body.trim(),
    });
    setLoading(false);

    if (error) {
      Alert.alert('Error', 'Could not create your discussion. Please try again.');
      console.error('Create thread error:', error);
      return;
    }

    onThreadCreated?.(data);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Discussion</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Category ── */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Category <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const active = cat === category;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, active && styles.catChipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Title ── */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Ask a question or share a topic..."
            placeholderTextColor={colors.placeholder}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            returnKeyType="next"
          />
          <Text style={styles.charCount}>{title.length}/120</Text>
        </View>

        {/* ── Body ── */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Details <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.bodyInput}
            placeholder="Share more context, your experience, or what you're looking for..."
            placeholderTextColor={colors.placeholder}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={6}
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{body.length}/1000</Text>
        </View>
      </ScrollView>

      {/* ── Post button ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.postBtn, (!isValid || loading) && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={!isValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.postBtnText}>Post Discussion</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ece8',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  section: {
    backgroundColor: c.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0ece8',
  },
  label: {
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
    marginBottom: 10,
  },
  required: {
    color: '#ef4444',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f0ee',
    borderWidth: 1,
    borderColor: c.border,
  },
  catChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  catChipText: {
    fontSize: 13,
    color: c.textSecondary,
    fontFamily: 'Figtree_500Medium',
  },
  catChipTextActive: {
    color: '#fff',
  },
  titleInput: {
    fontSize: 16,
    padding: 14,
    backgroundColor: c.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
  },
  bodyInput: {
    fontSize: 15,
    padding: 14,
    backgroundColor: c.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    minHeight: 130,
    color: c.text,
  },
  charCount: {
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0ece8',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 5,
  },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.primary,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: c.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  postBtnDisabled: {
    backgroundColor: c.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  postBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
  },
});
