import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { postService } from '../services/postService';
import PostDetailCard from '../components/PostDetailCard';

export default function PostDetailScreen({ route, navigation }) {
  const { postId, openComments = false } = route?.params ?? {};
  const { colors } = useTheme();
  const MAROON = colors.primary;
  const styles = makeStyles(colors);

  const goBack = () => navigation.goBack();

  const [post,     setPost]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!postId) { setLoading(false); setNotFound(true); return; }
    postService.getPostById(postId).then(({ data }) => {
      if (data) setPost(data);
      else      setNotFound(true);
      setLoading(false);
    });
  }, [postId]);

  const BackBar = () => (
    <View style={styles.navBar}>
      <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <BackBar />
        <View style={styles.center}><ActivityIndicator color={MAROON} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (notFound || !post) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <BackBar />
        <View style={styles.center}>
          <Ionicons name="image-outline" size={48} color={colors.border} />
          <Text style={[styles.notFoundText, { color: colors.textMuted }]}>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <BackBar />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <PostDetailCard post={post} navigation={navigation} openComments={openComments} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 15, fontFamily: 'Figtree_500Medium' },
  scrollContent: { paddingBottom: 24 },
});
