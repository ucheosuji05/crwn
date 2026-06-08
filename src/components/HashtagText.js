import React from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const HASHTAG_SPLIT_RE = /(#\w+)/g;
const HASHTAG_TEST_RE = /^#\w+$/;

/**
 * HashtagText
 *
 * Renders body text with inline `#tags` as tappable spans (color #B35D2B)
 * that navigate to FilteredCommunityScreen, scoping the feed to that tag.
 */
export default function HashtagText({ text, style, numberOfLines }) {
  const navigation = useNavigation();
  if (!text) return null;

  const parts = text.split(HASHTAG_SPLIT_RE);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => (
        HASHTAG_TEST_RE.test(part) ? (
          <Text
            key={i}
            style={styles.hashtag}
            onPress={() => navigation.navigate('FilteredCommunity', { tag: part.slice(1) })}
          >
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      ))}
    </Text>
  );
}

const styles = { hashtag: { color: '#B35D2B' } };
