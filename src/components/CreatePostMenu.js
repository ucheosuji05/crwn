import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Compass, Globe } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * CreatePostMenu
 *
 * Overlay shown when the Explore/Community "+" FAB is tapped, letting the
 * user choose whether to create an Explore post or a Community discussion.
 * Rendered inline (not as a Modal) so the FAB itself stays visible above the
 * backdrop and can swap to a close ("x") button while the menu is open.
 *
 * Props:
 *   visible            — whether the overlay is shown
 *   onClose()          — dismiss without choosing
 *   onSelectExplore()  — user chose "Explore Post"
 *   onSelectCommunity()— user chose "Community Post"
 */
export default function CreatePostMenu({ visible, onClose, onSelectExplore, onSelectCommunity }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.menu}>
        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onSelectExplore}>
          <View style={[styles.iconCircle, styles.exploreCircle]}>
            <Compass size={20} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.title}>Explore Post</Text>
            <Text style={styles.subtitle}>Share your style</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onSelectCommunity}>
          <View style={[styles.iconCircle, styles.communityCircle]}>
            <Globe size={20} color={colors.accent} strokeWidth={2} />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.title}>Community Post</Text>
            <Text style={styles.subtitle}>Ask Questions</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 45,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(60,55,50,0.35)',
  },
  menu: {
    position: 'absolute',
    bottom: 96,
    right: 20,
    width: 250,
    backgroundColor: c.surface,
    borderRadius: 16,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreCircle: { backgroundColor: c.primaryLight },
  communityCircle: { backgroundColor: c.surfaceAlt },
  textCol: { flex: 1 },
  title: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: c.text },
  subtitle: { fontSize: 12, fontFamily: 'Figtree_400Regular', color: c.textMuted, marginTop: 1 },
  divider: { height: 1, backgroundColor: c.borderLight, marginHorizontal: 14 },
});
