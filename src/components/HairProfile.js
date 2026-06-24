import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { profileService } from '../services/profileService';
import { useTheme } from '../context/ThemeContext';

const FIELDS = [
  { label: 'Hair Pattern',    key: 'hair_type' },
  { label: 'Porosity',        key: 'porosity' },
  { label: 'Density',         key: 'density' },
  { label: 'Strand Thickness',key: 'texture' },
  { label: 'Scalp Type',      key: 'scalp_type' },
  { label: 'Hair State',      key: 'hair_state' },
];

export default function HairProfile({ viewedUserId }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [hairProfile, setHairProfile] = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (viewedUserId) {
      fetchHairProfile();
    } else {
      setLoading(false);
    }
  }, [viewedUserId]);

  const fetchHairProfile = async () => {
    setLoading(true);
    try {
      const { data } = await profileService.getProfile(viewedUserId);
      setHairProfile(data?.hair_profiles?.[0] || null);
    } catch {
      setHairProfile(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const val = (key) => hairProfile?.[key] || '--';

  const goals = (() => {
    const g = hairProfile?.goals;
    if (!g || (Array.isArray(g) && g.length === 0)) return '--';
    if (Array.isArray(g)) return g.join(', ');
    return g;
  })();

  const CardWrapper = ({ full, children }) => (
    <LinearGradient
      colors={['#C8900A', '#F0D4A0', '#C8900A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.cardBorder, full && styles.cardBorderFull]}
    >
      <View style={styles.cardInner}>{children}</View>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
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
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  cardBorder: {
    width: '47.5%',
    borderRadius: 16,
    padding: 0.74,
    shadowColor: '#C8900A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  cardBorderFull: {
    width: '100%',
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15.26,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  cardLabel: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
    color: '#C8900A',
    marginBottom: 20,
  },
  cardValue: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
  },
});
