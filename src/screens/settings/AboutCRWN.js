import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AboutCRWN({ onBack }) {
  const socialLinks = [
    { platform: 'Instagram', icon: 'logo-instagram', url: 'https://instagram.com/crwnapp' },
    { platform: 'Twitter', icon: 'logo-twitter', url: 'https://twitter.com/crwnapp' },
    { platform: 'TikTok', icon: 'logo-tiktok', url: 'https://tiktok.com/@crwnapp' },
  ];

  const openLink = (url) => {
    Linking.openURL(url);
  };

  return (
    <View style={styles.fullContainer}>
      {/* Back Button Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#5D1F1F" />
        </TouchableOpacity>
        <Text style={styles.detailTitle}>About CRWN</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.container}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.crown}>👑</Text>
          <Text style={styles.appName}>CRWN</Text>
          <Text style={styles.tagline}>Your Hair. Your Crown. Your Community.</Text>
        </View>

        {/* Mission */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <Text style={styles.bodyText}>
            CRWN exists to celebrate Black hair in all its textures, styles, and journeys. We're building a safe space where authenticity thrives, self-love is cultivated, and excellence is the standard.
          </Text>
          <Text style={styles.bodyText}>
            From protective styles to loc journeys, from big chops to silk presses—your crown deserves to be celebrated, understood, and uplifted.
          </Text>
        </View>

        {/* Our Values */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What We Stand For</Text>
          
          <View style={styles.valueRow}>
            <Ionicons name="heart" size={24} color="#5D1F1F" />
            <View style={styles.valueContent}>
              <Text style={styles.valueTitle}>Authenticity</Text>
              <Text style={styles.valueText}>Be yourself. Your journey is unique.</Text>
            </View>
          </View>

          <View style={styles.valueRow}>
            <Ionicons name="ribbon" size={24} color="#5D1F1F" />
            <View style={styles.valueContent}>
              <Text style={styles.valueTitle}>Self-Love</Text>
              <Text style={styles.valueText}>Your crown is worthy. Celebrate it.</Text>
            </View>
          </View>

          <View style={styles.valueRow}>
            <Ionicons name="star" size={24} color="#5D1F1F" />
            <View style={styles.valueContent}>
              <Text style={styles.valueTitle}>Excellence</Text>
              <Text style={styles.valueText}>Quality content. Real community.</Text>
            </View>
          </View>
        </View>

        {/* CROWN Act */}
        <View style={styles.crownActSection}>
          <Ionicons name="shield-checkmark" size={32} color="#5D1F1F" />
          <Text style={styles.crownActTitle}>Supporting the CROWN Act</Text>
          <Text style={styles.crownActText}>
            We stand with the CROWN Act (Creating a Respectful and Open World for Natural Hair) to end hair discrimination. Your hair is not up for debate—it's protected.
          </Text>
          <TouchableOpacity 
            style={styles.learnMoreButton}
            onPress={() => openLink('https://www.thecrownact.com')}
          >
            <Text style={styles.learnMoreText}>Learn More</Text>
            <Ionicons name="arrow-forward" size={16} color="#5D1F1F" />
          </TouchableOpacity>
        </View>

        {/* Social Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connect With Us</Text>
          <View style={styles.socialContainer}>
            {socialLinks.map((link, index) => (
              <TouchableOpacity
                key={index}
                style={styles.socialButton}
                onPress={() => openLink(link.url)}
              >
                <Ionicons name={link.icon} size={24} color="#5D1F1F" />
                <Text style={styles.socialText}>{link.platform}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Legal */}
        <View style={styles.legalSection}>
          <TouchableOpacity onPress={() => openLink('https://crwnapp.com/terms')}>
            <Text style={styles.legalLink}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={styles.legalDivider}>•</Text>
          <TouchableOpacity onPress={() => openLink('https://crwnapp.com/privacy')}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with 💛 for the culture</Text>
          <Text style={styles.versionText}>CRWN v1.0.0</Text>
          <Text style={styles.copyrightText}>© 2025 CRWN. All rights reserved.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: '#FDF9F0',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#FDF9F0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  container: {
    flex: 1,
    backgroundColor: '#FDF9F0',
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fef2f2',
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  crown: {
    fontSize: 64,
    marginBottom: 8,
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#5D1F1F',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#6b7280',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 12,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  valueContent: {
    flex: 1,
  },
  valueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  valueText: {
    fontSize: 14,
    color: '#6b7280',
  },
  crownActSection: {
    margin: 20,
    padding: 20,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  crownActTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5D1F1F',
    marginTop: 12,
    marginBottom: 8,
  },
  crownActText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  learnMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5D1F1F',
  },
  socialContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  socialText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  legalSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  legalLink: {
    fontSize: 14,
    color: '#5D1F1F',
    fontWeight: '500',
  },
  legalDivider: {
    fontSize: 14,
    color: '#d1d5db',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 8,
  },
  versionText: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});