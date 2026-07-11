import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { profileService } from '../services/profileService';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';

const HONEY = '#E8A020';

const FIELDS = [
  { label: 'Hair Pattern',    key: 'hair_type' },
  { label: 'Porosity',        key: 'porosity' },
  { label: 'Density',         key: 'density' },
  { label: 'Strand Thickness',key: 'texture' },
  { label: 'Scalp Type',      key: 'scalp_type' },
];

export default function HairProfile({ viewedUserId }) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [hairProfile, setHairProfile] = useState(null);
  const [loading, setLoading]         = useState(true);

  const fetchHairProfile = async () => {
    setLoading(true);
    try {
      const { data } = await profileService.getProfile(viewedUserId);
      setHairProfile(parseHairProfile(data));
    } catch {
      setHairProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const parseHairProfile = (data) => {
    const hp = data?.hair_profiles;
    if (!hp) return null;
    return Array.isArray(hp) ? hp[0] || null : hp;
  };

  const silentRefetch = async () => {
    try {
      const { data } = await profileService.getProfile(viewedUserId);
      setHairProfile(parseHairProfile(data));
    } catch {}
  };

  useEffect(() => {
    if (viewedUserId) {
      fetchHairProfile();
    } else {
      setLoading(false);
    }
  }, [viewedUserId]);

  // Re-fetch silently when the screen regains focus after editing via the wizard
  useEffect(() => {
    if (!viewedUserId) return;
    return navigation.addListener('focus', silentRefetch);
  }, [navigation, viewedUserId]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const val = (key) => {
    const v = hairProfile?.[key];
    if (!v) return '--';
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

  const goals = (() => {
    const g = hairProfile?.hair_goals;
    if (!g || (Array.isArray(g) && g.length === 0)) return '--';
    if (Array.isArray(g)) return g.join(', ');
    return g;
  })();

  const CardWrapper = ({ full, children }) => (
    <View style={[styles.card, full && styles.cardFull]}>
      {children}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Privacy notice */}
      <View style={styles.privateBadge}>
        <Ionicons name="lock-closed-outline" size={14} color={HONEY} style={{ marginRight: 6 }} />
        <Text style={styles.privateText}>Private - Shared with stylists only</Text>
      </View>

      {/* 2-column grid */}
      <View style={styles.grid}>
        {FIELDS.map((f) => (
          <CardWrapper key={f.key}>
            <Text style={styles.cardLabel}>{f.label}</Text>
            <Text style={styles.cardValue}>{val(f.key)}</Text>
          </CardWrapper>
        ))}
      </View>

      {/* Current Goals — full width */}
      <CardWrapper full>
        <Text style={styles.cardLabel}>Current Goals</Text>
        <Text style={styles.cardValue}>{goals}</Text>
      </CardWrapper>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  loadingWrap: {
    padding: 40,
    alignItems: 'center',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    backgroundColor: c.background,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  card: {
    width: '47.5%',
    backgroundColor: c.card,
    borderRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: c.isDark ? 0 : 0.08,
    shadowRadius: 6,
    elevation: c.isDark ? 0 : 2,
  },
  cardFull: {
    width: '100%',
  },
  cardLabel: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
    color: HONEY,
    marginBottom: 20,
  },
  cardValue: {
    fontSize: 18,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.cardWarm,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  privateText: {
    fontSize: 14,
    fontFamily: 'Figtree_400Regular',
    color: HONEY,
  },
});
