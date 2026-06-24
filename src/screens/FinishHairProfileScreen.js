import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import EditProfileScreen from './EditProfileScreen';

const isWeb = Platform.OS === 'web';

export default function FinishHairProfileScreen() {
  const navigation = useNavigation();
  const [editVisible, setEditVisible] = useState(false);
  const { width: winW } = useWindowDimensions();

  // Breakpoints: phone < 480, tablet 480–1023, desktop 1024+
  const isTablet  = isWeb && winW >= 480 && winW < 1024;
  const isDesktop = isWeb && winW >= 1024;

  const headlineSize  = isDesktop ? 54 : isTablet ? 46 : 40;
  const headlineLine  = isDesktop ? 62 : isTablet ? 52 : 45;
  const eyebrowSize   = isDesktop ? 16 : 15;
  const eyebrowLS     = isDesktop ? 4  : 3;
  const contentMax    = isDesktop ? 560 : isTablet ? 460 : undefined;
  const hPad          = isDesktop ? 64  : isTablet ? 48  : 32;
  const btnMax        = isDesktop ? 480 : isTablet ? 400 : undefined;

  return (
    <View style={styles.container}>
      {/* Base warm bloom */}
      <LinearGradient
        colors={['#D4895A', '#E8B48A', '#F8EDE0', '#FDF9F4']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Left accent */}
      <LinearGradient
        colors={['rgba(196,110,58,0.45)', 'rgba(196,110,58,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 0.8 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Right accent */}
      <LinearGradient
        colors={['rgba(224,155,95,0.30)', 'rgba(224,155,95,0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.15, y: 0.8 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Main content */}
      <SafeAreaView style={styles.body} edges={['top']}>
        <View style={[styles.contentBlock, { paddingHorizontal: hPad, maxWidth: contentMax }]}>
          <Text style={[styles.eyebrow, { fontSize: eyebrowSize, letterSpacing: eyebrowLS }]}>
            FINISH YOUR HAIR PROFILE
          </Text>
          <Text style={[styles.headline, { fontSize: headlineSize, lineHeight: headlineLine }]}>
            {'for a more\npersonalized\n'}
            <Text style={[styles.headlineCrwn, { fontSize: headlineSize, lineHeight: headlineLine }]}>crwn </Text>
            <Text style={[styles.headlineItalic, { fontSize: headlineSize, lineHeight: headlineLine }]}>experience.</Text>
          </Text>
        </View>
      </SafeAreaView>

      {/* Buttons */}
      <SafeAreaView style={styles.bottom} edges={['bottom']}>
        <View style={[styles.btnWrap, { maxWidth: btnMax }]}>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => setEditVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* EditProfile overlay */}
      <Modal
        visible={editVisible}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setEditVisible(false)}
      >
        <EditProfileScreen
          onBack={() => setEditVisible(false)}
          onSave={() => {
            setEditVisible(false);
            navigation.goBack();
          }}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D4895A',
    justifyContent: 'space-between',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentBlock: {
    width: '100%',
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: 'Figtree_600SemiBold',
    color: '#000000',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 20,
  },
  headline: {
    fontFamily: 'LibreBaskerville_700Bold',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  headlineCrwn: {
    fontFamily: 'LibreBaskerville_700Bold',
    color: '#5D1F1F',
  },
  headlineItalic: {
    fontFamily: 'LibreBaskerville_400Regular_Italic',
    color: '#B35D2B',
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  btnWrap: {
    width: '100%',
    gap: 12,
  },
  continueBtn: {
    backgroundColor: '#3F523F',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 13,
    fontFamily: 'Figtree_500Medium',
    color: '#8B7355',
  },
});
