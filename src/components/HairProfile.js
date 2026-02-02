import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { profileService } from '../services/profileService';

export default function HairProfile() {
  const { user } = useAuth();
  const [hairProfile, setHairProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchHairProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchHairProfile = async () => {
    if (!user?.id) {
      console.log('HairProfile: No user ID, skipping fetch');
      setLoading(false);
      return;
    }

    console.log('HairProfile: Fetching hair profile for user:', user.id);
    setLoading(true);
    
    try {
      const { data, error } = await profileService.getProfile(user.id);
      
      if (error) {
        console.error('HairProfile: Error fetching profile:', error);
        setHairProfile(null);
      } else {
        // Hair profile is nested in the profile data
        const hairData = data?.hair_profiles?.[0] || null;
        console.log('HairProfile: Hair data:', hairData);
        setHairProfile(hairData);
      }
    } catch (err) {
      console.error('HairProfile: Unexpected error:', err);
      setHairProfile(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#5D1F1F" />
      </View>
    );
  }

  if (!hairProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Hair Profile</Text>
        <Text style={styles.emptyText}>
          Add your hair profile to get personalized recommendations
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hair Profile</Text>
      
      <View style={styles.characteristicsContainer}>
        {hairProfile.hair_type && (
          <View style={styles.characteristic}>
            <Text style={styles.label}>Hair Type</Text>
            <Text style={styles.value}>{hairProfile.hair_type}</Text>
          </View>
        )}

        {hairProfile.porosity && (
          <View style={styles.characteristic}>
            <Text style={styles.label}>Porosity</Text>
            <Text style={styles.value}>{hairProfile.porosity}</Text>
          </View>
        )}

        {hairProfile.density && (
          <View style={styles.characteristic}>
            <Text style={styles.label}>Density</Text>
            <Text style={styles.value}>{hairProfile.density}</Text>
          </View>
        )}
      </View>

      {hairProfile.characteristics && hairProfile.characteristics.length > 0 && (
        <View style={styles.tags}>
          {hairProfile.characteristics.map((char, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{char}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f8fafc',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16
  },
  loadingContainer: {
    padding: 16,
    backgroundColor: '#f8fafc',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  characteristicsContainer: {
    marginBottom: 16
  },
  characteristic: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  label: {
    fontSize: 14,
    color: '#666'
  },
  value: {
    fontSize: 14,
    fontWeight: '500'
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  tag: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8
  },
  tagText: {
    fontSize: 14,
    color: '#374151'
  }
});
