import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../config/supabase';

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const HAIR_ROWS = [
  { label: 'Curl Pattern',     field: 'hair_type',  startAt: 'curl' },
  { label: 'Porosity',         field: 'porosity',   startAt: 'porosity' },
  { label: 'Density',          field: 'density',    startAt: 'density' },
  { label: 'Strand Thickness', field: 'texture',    startAt: 'texture' },
  { label: 'Scalp Type',       field: 'scalp_type', startAt: 'scalp' },
  { label: 'Goals',            field: 'hair_goals', startAt: 'goals' },
];

export default function PreferencesSettings({ onBack }) {
  const { user } = useAuth();
  const { isDark, setDarkMode, colors } = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [hairProfile, setHairProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('hair_profiles')
      .select('hair_type, porosity, density, texture, scalp_type, hair_goals')
      .eq('user_id', user.id)
      .maybeSingle();
    setHairProfile(data);
    setLoading(false);
  };

  useEffect(() => { loadProfile(); }, [user?.id]);

  useEffect(() => {
    return navigation.addListener('focus', loadProfile);
  }, [navigation]);

  const displayValue = (row) => {
    const v = hairProfile?.[row.field];
    if (!v) return 'Not set';
    if (row.field === 'hair_goals' || row.field === 'hair_type') return v;
    return capitalize(v);
  };

  return (
    <View style={styles.fullContainer}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.detailTitle}>Preferences</Text>
        <View style={styles.statusArea} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.container}>

          {/* ── Appearance ─────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appearance</Text>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelRow}>
                <Ionicons
                  name={isDark ? 'moon' : 'sunny-outline'}
                  size={20}
                  color={isDark ? '#818cf8' : '#F8B430'}
                  style={{ marginRight: 12 }}
                />
                <View>
                  <Text style={styles.optionLabel}>Dark Mode</Text>
                  <Text style={styles.optionSub}>
                    {isDark ? 'Dark theme active' : 'Light theme active'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={setDarkMode}
                trackColor={{ false: '#d1d5db', true: colors.primary }}
                thumbColor="#fff"
                ios_backgroundColor="#d1d5db"
              />
            </View>
          </View>

          {/* ── Hair Profile ────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hair Profile</Text>
            {HAIR_ROWS.map((row) => (
              <TouchableOpacity
                key={row.field}
                style={styles.option}
                onPress={() => navigation.navigate('FinishHairProfile', { startAt: row.startAt })}
              >
                <Text style={styles.optionLabel}>{row.label}</Text>
                <View style={styles.optionValue}>
                  <Text style={styles.valueText} numberOfLines={1}>{displayValue(row)}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
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
  statusArea: { width: 40 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: c.background },
  section: {
    marginTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Figtree_600SemiBold',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  switchLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  optionLabel: { fontSize: 16, color: c.text },
  optionSub: { fontSize: 12, color: c.textMuted, marginTop: 1 },
  optionValue: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' },
  valueText: { fontSize: 15, color: c.textSecondary, flexShrink: 1, textAlign: 'right', maxWidth: 160 },
});
