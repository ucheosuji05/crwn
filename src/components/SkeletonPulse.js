import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// Pulsing placeholder rectangle — pass a style with width/height/borderRadius
// to shape it as an avatar circle, text line, image card, etc.
export default function SkeletonPulse({ style }) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.8, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <Animated.View style={[style, { backgroundColor: colors.border, opacity: pulse }]} />;
}
