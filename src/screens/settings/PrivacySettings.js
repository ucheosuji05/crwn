import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../config/supabase';
import CommunityGuidelines from './CommunityGuidelines';

const VISIBILITY_OPTIONS = [
  { value: 'public',    label: 'Public',         description: 'Anyone can see your profile' },
  { value: 'community', label: 'Community Only',  description: 'Only CRWN members can see your profile' },
  { value: 'private',   label: 'Private',         description: 'Only people you approve can see your profile' },
];

export default function PrivacySettings({ onBack }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [profileVisibility, setProfileVisibility] = useState('public');
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
        if (data?.privacy_settings?.profileVisibility) {
          setProfileVisibility(data.privacy_settings.profileVisibility);
        }
        setLoading(false);
      });
  }, [user?.id]);

  const updateVisibility = async (value) => {
    setProfileVisibility(value);
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ privacy_settings: { profileVisibility: value } })
      .eq('id', user.id);
    setSaving(false);
  };

  if (showGuidelines) {
    return <CommunityGuidelines onBack={() => setShowGuidelines(false)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy & Safety</Text>
        <View style={styles.headerRight}>
          {saving && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>

          <Text style={styles.sectionLabel}>Profile Visibility</Text>
          <View style={styles.card}>
            {VISIBILITY_OPTIONS.map((opt, i) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.row, i < VISIBILITY_OPTIONS.length - 1 && styles.rowBorder]}
                onPress={() => updateVisibility(opt.value)}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{opt.label}</Text>
                  <Text style={styles.rowSub}>{opt.description}</Text>
                </View>
                <View style={[styles.radio, profileVisibility === opt.value && styles.radioSelected]}>
                  {profileVisibility === opt.value && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Safety</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.row, styles.rowBorder]}
              onPress={() => Alert.alert('Blocked Users', 'Blocked users management coming soon.')}
            >
              <Ionicons name="ban-outline" size={20} color={colors.textSecondary} style={styles.rowIcon} />
              <Text style={[styles.rowTitle, styles.flex]}>Blocked Users</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.row, styles.rowBorder]}
              onPress={() => Alert.alert('Report', 'Report content or users coming soon.')}
            >
              <Ionicons name="flag-outline" size={20} color={colors.textSecondary} style={styles.rowIcon} />
              <Text style={[styles.rowTitle, styles.flex]}>Report Content or Users</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setShowGuidelines(true)}
            >
              <Ionicons name="people-outline" size={20} color={colors.textSecondary} style={styles.rowIcon} />
              <Text style={[styles.rowTitle, styles.flex]}>Community Guidelines</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Data</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.row, styles.rowBorder]}
              onPress={() =>
                Alert.alert('Data Usage', 'CRWN collects only the data necessary to provide you with a personalized experience. We never sell your data to third parties.')
              }
            >
              <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} style={styles.rowIcon} />
              <Text style={[styles.rowTitle, styles.flex]}>How We Use Your Data</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.row}
              onPress={() => Alert.alert('Download Data', 'Data export coming soon.')}
            >
              <Ionicons name="download-outline" size={20} color={colors.textSecondary} style={styles.rowIcon} />
              <Text style={[styles.rowTitle, styles.flex]}>Download My Data</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.borderLight },
  backButton:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 18, fontFamily: 'Figtree_600SemiBold', color: c.text },
  headerRight: { width: 40, alignItems: 'center' },
  loader:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:     { padding: 20, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Figtree_600SemiBold',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 24,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.borderLight,
  },
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.borderLight },
  rowIcon:   { marginRight: 12 },
  rowText:   { flex: 1 },
  rowTitle:  { fontSize: 15, fontFamily: 'Figtree_500Medium', color: c.text },
  rowSub:    { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  flex:      { flex: 1 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: c.primary },
  radioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
});
