import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { profileService } from '../services/profileService';

// Same layout pattern as AddServiceScreen.js, mirroring OnboardingScreen.js's
// question-title/input-row structure — requirements have no onboarding-flow
// precedent of their own, so this follows the services step's structure.
export default function AddRequirementScreen({ route, navigation }) {
  const { stylistId, existingRequirements } = route.params || {};
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = text.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const next = [...(Array.isArray(existingRequirements) ? existingRequirements : []), text.trim()];
    const { error } = await profileService.updateProfile(stylistId, { requirements: next });
    setSaving(false);
    if (error) {
      Alert.alert('Error', 'Could not add this requirement. Please try again.');
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Requirement</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.questionTitle}>Add a requirement</Text>
          <Text style={styles.questionSubtitle}>Let clients know what they need to do before their appointment.</Text>

          <Text style={styles.fieldLabel}>Requirement</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={text}
            onChangeText={setText}
            placeholder="e.g. Arrive with hair washed and detangled"
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoFocus
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, canSave && styles.saveBtnActive]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Add Requirement</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Figtree_700Bold', color: c.text },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  questionTitle: { fontSize: 24, fontFamily: 'LibreBaskerville_700Bold', color: c.text, marginBottom: 10 },
  questionSubtitle: { fontSize: 14, fontFamily: 'Figtree_400Regular', color: c.textSecondary, marginBottom: 24, lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: c.textSecondary, marginBottom: 8, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 14,
    fontSize: 14, color: c.text, fontFamily: 'Figtree_400Regular',
    marginBottom: 16,
  },
  textArea: { minHeight: 90 },
  footer: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 },
  saveBtn: { backgroundColor: c.borderLight, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnActive: { backgroundColor: c.primary },
  saveBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
});
