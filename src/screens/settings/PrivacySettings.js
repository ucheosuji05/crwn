import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Globe } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import BlockedUsersScreen from './BlockedUsersScreen';
import ReportContentScreen from './ReportContentScreen';

const OCHRE = '#D4930A';

const GUIDELINES = [
  'Be respectful.',
  'Be helpful.',
  'Share facts, not misinformation.',
  'Keep content relevant to textured hair.',
  'No hate, harassment, or spam.',
  'Respect privacy.',
  'Celebrate every hair journey.',
];

const DATA_POINTS = [
  { icon: 'person-outline',       text: 'Your profile and hair type to surface relevant content and stylists.' },
  { icon: 'images-outline',       text: 'Posts you create and interact with to improve your feed.' },
  { icon: 'search-outline',       text: 'Search and browsing activity to personalise recommendations.' },
  { icon: 'location-outline',     text: 'General location (if provided) to show nearby stylists.' },
  { icon: 'lock-closed-outline',  text: 'We never sell your data or share it with third-party advertisers.' },
];

export default function PrivacySettings({ onBack }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [showGuidelines, setShowGuidelines] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy & Safety</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.sectionLabel}>Safety</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.row, styles.rowBorder]}
            onPress={() => setShowBlocked(true)}
          >
            <Ionicons name="ban-outline" size={20} color={colors.textSecondary} style={styles.rowIcon} />
            <Text style={[styles.rowTitle, styles.flex]}>Blocked Users</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.rowBorder]}
            onPress={() => setShowReport(true)}
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
            style={styles.row}
            onPress={() => setShowDataModal(true)}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} style={styles.rowIcon} />
            <Text style={[styles.rowTitle, styles.flex]}>How We Use Your Data</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Community Guidelines popup (same as CreateThreadScreen) ── */}
      <Modal
        visible={showGuidelines}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGuidelines(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowGuidelines(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Globe size={22} color={OCHRE} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Community Post</Text>
                <Text style={styles.modalSubtitle}>Guidelines</Text>
              </View>
              <TouchableOpacity onPress={() => setShowGuidelines(false)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {GUIDELINES.map((g, i) => (
                <View key={i} style={styles.guidelineRow}>
                  <Text style={styles.guidelineCheck}>✓</Text>
                  <Text style={styles.guidelineText}>{g}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── How We Use Your Data popup ── */}
      <Modal
        visible={showDataModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDataModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDataModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={22} color={OCHRE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Your Data</Text>
                <Text style={styles.modalSubtitle}>How CRWN uses it</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDataModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.dataIntro}>
                The information you share helps us tailor CRWN to your unique hair journey. Here's what we use and why:
              </Text>
              {DATA_POINTS.map((d, i) => (
                <View key={i} style={styles.dataRow}>
                  <Ionicons name={d.icon} size={16} color={OCHRE} style={styles.dataIcon} />
                  <Text style={styles.dataText}>{d.text}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showBlocked} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowBlocked(false)}>
        <BlockedUsersScreen onBack={() => setShowBlocked(false)} />
      </Modal>

      <Modal visible={showReport} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowReport(false)}>
        <ReportContentScreen onBack={() => setShowReport(false)} />
      </Modal>

    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.borderLight },
  backButton:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 18, fontFamily: 'Figtree_600SemiBold', color: c.text },
  headerRight: { width: 40 },
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
  rowTitle:  { fontSize: 15, fontFamily: 'Figtree_500Medium', color: c.text },
  flex:      { flex: 1 },

  // ── Shared modal chrome ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: c.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderLight,
  },
  modalIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FEF3E2',
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle:    { fontSize: 15, fontFamily: 'Figtree_700Bold', color: c.text },
  modalSubtitle: { fontSize: 12, fontFamily: 'Figtree_400Regular', color: c.textMuted, marginTop: 1 },
  modalClose:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalBody:     { paddingHorizontal: 20, paddingVertical: 18, gap: 12 },

  // ── Guidelines modal ──
  guidelineRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  guidelineCheck: { fontSize: 14, color: OCHRE, fontFamily: 'Figtree_700Bold', lineHeight: 20 },
  guidelineText:  { flex: 1, fontSize: 14, fontFamily: 'Figtree_400Regular', color: c.text, lineHeight: 20 },

  // ── Data modal ──
  dataIntro: {
    fontSize: 13,
    fontFamily: 'Figtree_400Regular',
    color: c.textSecondary,
    lineHeight: 19,
    marginBottom: 4,
  },
  dataRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dataIcon: { marginTop: 1 },
  dataText: { flex: 1, fontSize: 14, fontFamily: 'Figtree_400Regular', color: c.text, lineHeight: 20 },
});
