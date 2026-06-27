import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { profileService } from '../services/profileService';
import { useTheme } from '../context/ThemeContext';

const BURNT_OCHRE = '#B35D2B';

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
    <View style={[styles.card, full && styles.cardFull]}>
      {children}
    </View>
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
  card: {
    width: '47.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cardFull: {
    width: '100%',
  },
  cardLabel: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
    color: BURNT_OCHRE,
    marginBottom: 20,
  },
  cardValue: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
  },
});
