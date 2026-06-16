import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../config/supabase';
import CommunityGuidelines from './CommunityGuidelines';

const DEFAULTS = {
  profileVisibility: 'public',
  hidePhotos: false,
  anonymousMode: false,
  blurPhotos: false,
};

export default function PrivacySettings({ onBack }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('privacy_settings')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.privacy_settings) {
          setSettings({ ...DEFAULTS, ...data.privacy_settings });
        }
        setLoading(false);
      });
  }, [user?.id]);

  const updateSetting = async (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ privacy_settings: updated })
      .eq('id', user.id);
    setSaving(false);
  };

  const visibilityOptions = [
    { value: 'public', label: 'Public', description: 'Anyone can see your profile' },
    { value: 'community', label: 'Community Only', description: 'Only CRWN members can see your profile' },
    { value: 'private', label: 'Private', description: 'Only people you approve can see your profile' },
  ];

  if (showGuidelines) {
    return <CommunityGuidelines onBack={() => setShowGuidelines(false)} />;
  }

  return (
    <View style={styles.fullContainer}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.detailTitle}>Privacy & Safety</Text>
        <View style={styles.statusArea}>
          {saving && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Trust + Protection</Text>
            <Text style={styles.headerDescription}>
              Your safety is our priority. Control who sees your content and how you interact.
            </Text>
          </View>

          {/* Profile Visibility */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile Visibility</Text>
            {visibilityOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.radioOption}
                onPress={() => updateSetting('profileVisibility', option.value)}
              >
                <View style={styles.radioContent}>
                  <Text style={styles.radioLabel}>{option.label}</Text>
                  <Text style={styles.radioDescription}>{option.description}</Text>
                </View>
                <View style={[
                  styles.radioCircle,
                  settings.profileVisibility === option.value && styles.radioCircleSelected,
                ]}>
                  {settings.profileVisibility === option.value && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Photo Privacy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photo Privacy</Text>
            <View style={styles.option}>
              <View style={styles.optionContent}>
                <Text style={styles.optionLabel}>Hide Hair Photos from Public</Text>
                <Text style={styles.optionDescription}>Keep your hair photos visible only to followers</Text>
              </View>
              <Switch
                value={settings.hidePhotos}
                onValueChange={(v) => updateSetting('hidePhotos', v)}
                trackColor={{ false: '#d1d5db', true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.option}>
              <View style={styles.optionContent}>
                <Text style={styles.optionLabel}>Blur Photos by Default</Text>
                <Text style={styles.optionDescription}>Photos are blurred until you choose to reveal them</Text>
              </View>
              <Switch
                value={settings.blurPhotos}
                onValueChange={(v) => updateSetting('blurPhotos', v)}
                trackColor={{ false: '#d1d5db', true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Browsing Privacy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Browsing Privacy</Text>
            <View style={styles.option}>
              <View style={styles.optionContent}>
                <Text style={styles.optionLabel}>Anonymous Browsing Mode</Text>
                <Text style={styles.optionDescription}>Browse content without leaving a trace</Text>
              </View>
              <Switch
                value={settings.anonymousMode}
                onValueChange={(v) => updateSetting('anonymousMode', v)}
                trackColor={{ false: '#d1d5db', true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Safety Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Safety Actions</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert('Blocked Users', 'Blocked users management coming soon.')}
            >
              <Ionicons name="ban-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Blocked Users</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert('Report', 'Report content or users coming soon.')}
            >
              <Ionicons name="flag-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Report Content or Users</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowGuidelines(true)}
            >
              <Ionicons name="people-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Community Guidelines</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Data Transparency */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data & Transparency</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                Alert.alert(
                  'Data Usage',
                  'CRWN collects only the data necessary to provide you with a personalized experience. We never sell your data to third parties.',
                )
              }
            >
              <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>How We Use Your Data</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert('Download Data', 'Data export coming soon.')}
            >
              <Ionicons name="download-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Download My Data</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  fullContainer: { flex: 1, backgroundColor: c.background },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
    backgroundColor: c.background,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { fontSize: 18, fontFamily: 'Figtree_600SemiBold', color: c.text },
  statusArea: { width: 40, alignItems: 'center' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: c.background },
  header: { padding: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 20, fontFamily: 'Figtree_700Bold', color: c.primary, marginBottom: 8 },
  headerDescription: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  section: { marginTop: 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Figtree_600SemiBold',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  optionContent: { flex: 1, marginRight: 16 },
  optionLabel: { fontSize: 16, fontFamily: 'Figtree_500Medium', color: c.text, marginBottom: 2 },
  optionDescription: { fontSize: 13, color: c.textSecondary },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  radioContent: { flex: 1, marginRight: 16 },
  radioLabel: { fontSize: 16, fontFamily: 'Figtree_500Medium', color: c.text, marginBottom: 2 },
  radioDescription: { fontSize: 13, color: c.textSecondary },
  radioCircle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: c.primary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.primary },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  actionText: { flex: 1, fontSize: 16, color: c.text },
});
