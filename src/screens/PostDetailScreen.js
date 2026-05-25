import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { postService } from '../services/postService';
import PostCard from '../components/PostCard';

export default function PostDetailScreen({ route, navigation }) {
  const { postId, openComments = false } = route?.params ?? {};
  const { colors } = useTheme();
  const { user } = useAuth();
  const scrollRef = useRef(null);

  const [post, setPost]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!postId) { setLoading(false); setNotFound(true); return; }
    postService.getPostById(postId).then(({ data, error }) => {
      if (data) setPost(data);
      else      setNotFound(true);
      setLoading(false);
    });
  }, [postId]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : notFound || !post ? (
        <View style={styles.center}>
          <Ionicons name="image-outline" size={48} color={colors.border} />
          <Text style={[styles.notFoundText, { color: colors.textMuted }]}>Post not found</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <PostCard
            post={post}
            currentUserId={user?.id}
            scrollViewRef={scrollRef}
            initialCommentsOpen={openComments}
            onNavigateToProfile={(userId) =>
              navigation.navigate('UserProfile', { viewedUserId: userId })
            }
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 15,
    fontFamily: 'Figtree_500Medium',
  },
});
