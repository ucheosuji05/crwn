import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView as SAV } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { profileService } from '../services/profileService';

// ── Curl pattern data ────────────────────────────────────────────────────────

const CURL_OPTIONS = [
  {
    value: 'Wavy',
    label: 'Wavy (2A–2C)',
    description: 'Loose waves, s shaped\nloose curl pattern',
    image: require('../../assets/images/curl-patterns/wavy.png'),
  },
  {
    value: 'Curly',
    label: 'Curly (3A–3C)',
    description: 'Defined curls with spiral\npatterns.',
    image: require('../../assets/images/curl-patterns/curly.png'),
  },
  {
    value: 'Coily',
    label: 'Coily (4A–4B)',
    description: 'Small, tight curls with\nvisible coil patterns.',
    image: require('../../assets/images/curl-patterns/coily.png'),
  },
  {
    value: 'Kinky Coily',
    label: 'Kinky Coily (4C)',
    description: 'Very tight coils, zig zag\npattern, very dense',
    image: require('../../assets/images/curl-patterns/kinky-coily.png'),
  },
];

const CURL_DETAILS = [
  {
    label: 'Wavy (2A–2C)',
    points: [
      { key: 'Pattern', value: 'Loose S-shaped waves' },
      { key: 'Shrinkage', value: 'Up to 30%' },
      { key: '', value: 'Can become oily and lose volume.' },
    ],
  },
  {
    label: 'Curly (3A–3C)',
    points: [
      { key: 'Pattern', value: 'Defined spiral curls' },
      { key: 'Shrinkage', value: 'Up to 50%' },
      { key: '', value: 'Often prone to dryness.' },
    ],
  },
  {
    label: 'Coily (4A–4B)',
    points: [
      { key: 'Pattern', value: 'Tight spring-like coils' },
      { key: 'Shrinkage', value: 'Up to 75%' },
      { key: '', value: 'Requires regular moisture to stay hydrated.' },
    ],
  },
  {
    label: 'Kinky Coily (4C)',
    points: [
      { key: 'Pattern', value: 'Tight zig-zag coils' },
      { key: 'Shrinkage', value: '75–90%' },
      { key: '', value: 'Very dense and benefits from consistent hydration.' },
    ],
  },
];

// ── Porosity data ────────────────────────────────────────────────────────────

const POROSITY_IMG = require('../../assets/images/porosity/porosity.gif');

const POROSITY_OPTIONS = [
  {
    value: 'low',
    label: 'Low Porosity',
    caption: 'floats',
    description: 'Water takes longer to soak into your hair.',
    image: POROSITY_IMG,
  },
  {
    value: 'medium',
    label: 'Medium Porosity',
    caption: 'sinks slowly',
    description: 'Your hair absorbs moisture pretty normally.',
    image: POROSITY_IMG,
  },
  {
    value: 'high',
    label: 'High Porosity',
    caption: 'sinks fast',
    description: 'Water soaks into your hair very quickly.',
    image: POROSITY_IMG,
  },
];

// ── Density data ─────────────────────────────────────────────────────────────

const DENSITY_OPTIONS = [
  {
    value: 'low',
    label: 'Low Density',
    description: 'Your hair is thin, and your scalp is easy to see.',
    image: require('../../assets/images/density/low.png'),
  },
  {
    value: 'medium',
    label: 'Medium Density',
    description: 'Your hair is in between. Not too thin, not too full.',
    image: require('../../assets/images/density/medium.png'),
  },
  {
    value: 'high',
    label: 'High Density',
    description: 'Your hair is thick and full; your scalp is hard to see.',
    image: require('../../assets/images/density/high.png'),
  },
];

// ── Texture / strand data ─────────────────────────────────────────────────────

const TEXTURE_OPTIONS = [
  {
    value: 'fine',
    label: 'Fine',
    description: 'Your strands are small and thin.',
    image: require('../../assets/images/hair-strand/fine.png'),
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Your strands are in between thin and thick.',
    image: require('../../assets/images/hair-strand/medium.png'),
  },
  {
    value: 'coarse',
    label: 'Coarse',
    description: 'Your strands are thicker and feel stronger.',
    image: require('../../assets/images/hair-strand/course.png'),
  },
];

// ── Scalp type data ───────────────────────────────────────────────────────────

const SCALP_OPTIONS = [
  { value: 'dry',       label: 'Dry',       description: 'Your scalp may feel tight, flaky, or itchy.' },
  { value: 'oily',      label: 'Oily',      description: 'Your scalp gets oily quickly.' },
  { value: 'balanced',  label: 'Balanced',  description: 'Your scalp feels not too dry or oily.' },
  { value: 'sensitive', label: 'Sensitive', description: 'Your scalp gets irritated easily.' },
];

// ── Goals data ────────────────────────────────────────────────────────────────

const GOALS_OPTIONS = [
  { value: 'learn',     label: 'Learn what works for my hair' },
  { value: 'document',  label: 'Document and track my journey' },
  { value: 'discover',  label: 'Discover products for my hair type' },
  { value: 'inspired',  label: 'Get inspired by styles and looks' },
  { value: 'stylists',  label: 'Find and connect with stylists' },
  { value: 'share',     label: 'Share my journey with others' },
];

// ── Steps ────────────────────────────────────────────────────────────────────

const STEP = { LANDING: 'landing', CURL: 'curl', POROSITY: 'porosity', DENSITY: 'density', TEXTURE: 'texture', SCALP: 'scalp', GOALS: 'goals' };

const TOTAL_STEPS = 7;

const renderProgress = (currentStep) => (
  <View style={styles.progressBar}>
    {Array.from({ length: TOTAL_STEPS }, (_, i) => {
      const done    = i < currentStep - 1;
      const current = i === currentStep - 1;
      return (
        <View
          key={i}
          style={[
            styles.progressSegment,
            done    && styles.progressDone,
            current && styles.progressCurrent,
          ]}
        />
      );
    })}
  </View>
);

// ── Screen ───────────────────────────────────────────────────────────────────

export default function FinishHairProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const singleEdit = !!route.params?.startAt;
  const { user } = useAuth();
  const { width: winW } = useWindowDimensions();

  const [step, setStep] = useState(STEP.LANDING);
  const [selectedCurls, setSelectedCurls] = useState([]);
  const [selectedPorosity, setSelectedPorosity] = useState(null);
  const [selectedDensity, setSelectedDensity] = useState(null);
  const [selectedTexture, setSelectedTexture] = useState(null);
  const [selectedScalp, setSelectedScalp] = useState(null);
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [explainOpen, setExplainOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // When navigated with startAt param, pre-populate existing values and jump to that step
  useEffect(() => {
    const startAt = route.params?.startAt;
    if (!startAt || !user?.id) return;
    profileService.getProfile(user.id).then(({ data }) => {
      const p = data?.hair_profiles?.[0];
      if (p) {
        if (p.hair_type) setSelectedCurls(p.hair_type.split(', ').filter(Boolean));
        if (p.porosity) setSelectedPorosity(p.porosity);
        if (p.density) setSelectedDensity(p.density);
        if (p.texture) setSelectedTexture(p.texture);
        if (p.scalp_type) setSelectedScalp(p.scalp_type);
        if (p.hair_goals) {
          const labelToValue = Object.fromEntries(GOALS_OPTIONS.map(o => [o.label, o.value]));
          setSelectedGoals(p.hair_goals.split(', ').map(l => labelToValue[l]).filter(Boolean));
        }
      }
      setStep(startAt);
    });
  }, [route.params?.startAt, user?.id]);

  const isDesktop  = Platform.OS === 'web' && winW >= 1024;
  const isTablet   = Platform.OS === 'web' && winW >= 480 && winW < 1024;
  const hPad       = isDesktop ? 64 : isTablet ? 48 : 24;
  const contentMax = isDesktop ? 560 : isTablet ? 460 : undefined;

  const toggleCurl = (value) =>
    setSelectedCurls(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );

  const togglePorosity = (value) =>
    setSelectedPorosity(prev => prev === value ? null : value);

  const toggleDensity = (value) =>
    setSelectedDensity(prev => prev === value ? null : value);

  const toggleTexture = (value) =>
    setSelectedTexture(prev => prev === value ? null : value);

  const toggleScalp = (value) =>
    setSelectedScalp(prev => prev === value ? null : value);

  const toggleGoal = (value) =>
    setSelectedGoals(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );

  // Save curl type → advance to porosity
  const handleSaveCurl = async (overrideSelected) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const values = overrideSelected ?? selectedCurls;
      const hairType = values.length > 0 ? values.join(', ') : null;
      await profileService.updateHairProfile(user.id, { hair_type: hairType });
      singleEdit ? navigation.goBack() : setStep(STEP.POROSITY);
    } catch {
      Alert.alert('Error', 'Could not save your hair profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Save porosity → advance to density
  const handleSavePorosity = async (overrideValue) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const value = overrideValue !== undefined ? overrideValue : selectedPorosity;
      await profileService.updateHairProfile(user.id, { porosity: value });
      singleEdit ? navigation.goBack() : setStep(STEP.DENSITY);
    } catch {
      Alert.alert('Error', 'Could not save your hair profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Save density → advance to texture
  const handleSaveDensity = async (overrideValue) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const value = overrideValue !== undefined ? overrideValue : selectedDensity;
      await profileService.updateHairProfile(user.id, { density: value });
      singleEdit ? navigation.goBack() : setStep(STEP.TEXTURE);
    } catch {
      Alert.alert('Error', 'Could not save your hair profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Save texture → advance to scalp
  const handleSaveTexture = async (overrideValue) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const value = overrideValue !== undefined ? overrideValue : selectedTexture;
      await profileService.updateHairProfile(user.id, { texture: value });
      singleEdit ? navigation.goBack() : setStep(STEP.SCALP);
    } catch {
      Alert.alert('Error', 'Could not save your hair profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Save scalp type → finish wizard
  const handleSaveScalp = async (overrideValue) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const value = overrideValue !== undefined ? overrideValue : selectedScalp;
      await profileService.updateHairProfile(user.id, { scalp_type: value });
      singleEdit ? navigation.goBack() : setStep(STEP.GOALS);
    } catch {
      Alert.alert('Error', 'Could not save your hair profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Save goals → finish wizard
  const handleSaveGoals = async () => {
    if (!user?.id || selectedGoals.length === 0) return;
    setSaving(true);
    try {
      const goalLabels = selectedGoals.map(v => GOALS_OPTIONS.find(o => o.value === v)?.label ?? v);
      await profileService.updateHairProfile(user.id, { hair_goals: goalLabels.join(', ') });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save your hair profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Landing ──────────────────────────────────────────────────────────────
  if (step === STEP.LANDING) {
    const headlineSize = isDesktop ? 54 : isTablet ? 46 : 40;
    const headlineLine = isDesktop ? 62 : isTablet ? 52 : 45;
    const btnMax = isDesktop ? 480 : isTablet ? 400 : undefined;

    return (
      <View style={styles.container}>
        <LinearGradient colors={['#D4895A', '#E8B48A', '#F8EDE0', '#FDF9F4']} locations={[0, 0.35, 0.7, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <LinearGradient colors={['rgba(196,110,58,0.45)', 'rgba(196,110,58,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 0.8 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <LinearGradient colors={['rgba(224,155,95,0.30)', 'rgba(224,155,95,0)']} start={{ x: 1, y: 0 }} end={{ x: 0.15, y: 0.8 }} style={StyleSheet.absoluteFill} pointerEvents="none" />

        <SAV style={styles.landingBody} edges={['top']}>
          <View style={[styles.landingContent, { paddingHorizontal: hPad, maxWidth: contentMax }]}>
            <Text style={[styles.eyebrow, { fontSize: isDesktop ? 16 : 15, letterSpacing: isDesktop ? 4 : 3 }]}>
              FINISH YOUR HAIR PROFILE
            </Text>
            <Text style={[styles.headline, { fontSize: headlineSize, lineHeight: headlineLine }]}>
              {'for a more\npersonalized\n'}
              <Text style={[styles.headlineCrwn, { fontSize: headlineSize, lineHeight: headlineLine }]}>crwn </Text>
              <Text style={[styles.headlineItalic, { fontSize: headlineSize, lineHeight: headlineLine }]}>experience.</Text>
            </Text>
          </View>
        </SAV>

        <SAV style={[styles.landingBottom, { paddingHorizontal: hPad }]} edges={['bottom']}>
          <View style={[styles.btnWrap, { maxWidth: btnMax }]}>
            <TouchableOpacity style={styles.continueBtn} onPress={() => setStep(STEP.CURL)} activeOpacity={0.85}>
              <Text style={styles.continueBtnText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.skipText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </SAV>
      </View>
    );
  }

  // ── Curl pattern step ─────────────────────────────────────────────────────
  if (step === STEP.CURL) {
    return (
      <View style={styles.container}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FCFCFC' }]} />

        <SAV style={{ flex: 1 }} edges={['top', 'bottom']}>
          <TouchableOpacity style={styles.backBtn} onPress={() => singleEdit ? navigation.goBack() : setStep(STEP.LANDING)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color="#3F3028" />
          </TouchableOpacity>

          {renderProgress(1)}

          <ScrollView contentContainerStyle={[styles.stepScroll, { paddingHorizontal: hPad }]} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>What is your curl pattern?</Text>

            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                DISCLAIMER: It is possible to have multiple different curl patterns around your head. Select multiple if that is the case.
              </Text>
            </View>

            <TouchableOpacity style={styles.explainBtn} onPress={() => setExplainOpen(true)} activeOpacity={0.75}>
              <Text style={styles.explainBtnText}>Need more explanation?</Text>
            </TouchableOpacity>

            <View style={styles.optionList}>
              {CURL_OPTIONS.map(opt => {
                const active = selectedCurls.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => toggleCurl(opt.value)}
                    activeOpacity={0.8}
                  >
                    <Image source={opt.image} style={styles.curlIcon} resizeMode="contain" />
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                      <Text style={styles.optionDesc}>{opt.description}</Text>
                    </View>
                    {active && (
                      <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity onPress={() => handleSaveCurl([])} activeOpacity={0.7} style={styles.notSureWrap}>
              <Text style={styles.notSure}>I'm not sure yet</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[styles.bottomActions, { paddingHorizontal: hPad }]}>
            <TouchableOpacity
              style={[styles.continueBtn, !selectedCurls.length && styles.continueBtnMuted, saving && styles.continueBtnDisabled]}
              onPress={() => handleSaveCurl()}
              disabled={!selectedCurls.length || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.continueBtnText}>Continue</Text>
              }
            </TouchableOpacity>
          </View>
        </SAV>

        {/* Curl explanation modal */}
        <Modal visible={explainOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setExplainOpen(false)}>
          <SAV style={styles.explainModal}>
            <View style={styles.explainHeader}>
              <View style={{ width: 30 }} />
              <Text style={styles.explainTitle}>Curl Pattern</Text>
              <TouchableOpacity onPress={() => setExplainOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color="#3F3028" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.explainScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.explainSubtitle}>
                Hair Pattern describes the natural shape of your hair strands, ranging from Wavy to Kinky Coily.
              </Text>

              <View style={styles.explainNote}>
                <Text style={styles.explainNoteText}>
                  While the curl chart isn't a complete way to describe textured hair, it provides a helpful visual starting point for identifying your pattern.
                </Text>
              </View>

              {CURL_DETAILS.map((type, i) => (
                <View key={i} style={styles.explainType}>
                  <Text style={styles.explainTypeLabel}>{type.label}</Text>
                  {type.points.map((pt, j) => (
                    <View key={j} style={styles.explainPoint}>
                      {pt.key ? (
                        <Text style={styles.explainPointText}>
                          <Text style={styles.explainPointKey}>{pt.key}: </Text>
                          {pt.value}
                        </Text>
                      ) : (
                        <Text style={styles.explainPointText}>{pt.value}</Text>
                      )}
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </SAV>
        </Modal>
      </View>
    );
  }

  // ── Porosity step ─────────────────────────────────────────────────────────
  if (step === STEP.POROSITY) return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FCFCFC' }]} />

      <SAV style={{ flex: 1 }} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => singleEdit ? navigation.goBack() : setStep(STEP.CURL)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#3F3028" />
        </TouchableOpacity>

        {renderProgress(2)}

        <ScrollView contentContainerStyle={[styles.stepScroll, { paddingHorizontal: hPad }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>What is your porosity?</Text>

          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              Porosity is how well your hair absorbs and retains moisture.
            </Text>
          </View>

          <TouchableOpacity style={styles.explainBtn} onPress={() => setExplainOpen(true)} activeOpacity={0.75}>
            <Text style={styles.explainBtnText}>Need more explanation?</Text>
          </TouchableOpacity>

          <View style={styles.optionList}>
            {POROSITY_OPTIONS.map(opt => {
              const active = selectedPorosity === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => togglePorosity(opt.value)}
                  activeOpacity={0.8}
                >
                  <View style={styles.porosityImgCol}>
                    <Image source={opt.image} style={styles.porosityIcon} resizeMode="contain" />
                    <Text style={styles.porosityCaption}>({opt.caption})</Text>
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                    <Text style={styles.optionDesc}>{opt.description}</Text>
                  </View>
                  {active && (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={() => handleSavePorosity(null)} activeOpacity={0.7} style={styles.notSureWrap}>
            <Text style={styles.notSure}>I'm not sure yet</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={[styles.bottomActions, { paddingHorizontal: hPad }]}>
          <TouchableOpacity
            style={[styles.continueBtn, !selectedPorosity && styles.continueBtnMuted, saving && styles.continueBtnDisabled]}
            onPress={() => handleSavePorosity()}
            disabled={!selectedPorosity || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.continueBtnText}>Continue</Text>
            }
          </TouchableOpacity>
        </View>
      </SAV>

      {/* Porosity explanation modal */}
      <Modal visible={explainOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setExplainOpen(false)}>
        <SAV style={styles.explainModal}>
          <View style={styles.explainHeader}>
            <View style={{ width: 30 }} />
            <Text style={styles.explainTitle}>Porosity</Text>
            <TouchableOpacity onPress={() => setExplainOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#3F3028" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.explainScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.explainSubtitle}>
              Porosity is how easily your hair absorbs and holds onto moisture. It depends on how open or closed your hair's cuticle (the outer layer) is.
            </Text>

            <Text style={styles.explainSubtitle}>
              {'Still not sure? Try this test:\nDrop a clean strand of hair into a glass of water.'}
            </Text>

            <View style={styles.explainBullets}>
              {[
                'Floats → low porosity',
                'Sinks slowly → medium porosity',
                'Sinks fast → high porosity',
              ].map((b, i) => (
                <View key={i} style={styles.explainBulletRow}>
                  <Text style={styles.explainBulletDot}>•</Text>
                  <Text style={[styles.explainSubtitle, { flex: 1 }]}>{b}</Text>
                </View>
              ))}
            </View>

            {/* Visual comparison */}
            <View style={styles.porosityVisualBox}>
              <Image
                source={require('../../assets/images/porosity/porosity-all.gif')}
                style={styles.porosityVisualImg}
                resizeMode="contain"
              />
            </View>

            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                DISCLAIMER: Hair must be clean, with no product build-up or mineral deposits, for this test to reflect your true porosity.
              </Text>
            </View>
          </ScrollView>
        </SAV>
      </Modal>
    </View>
  );

  // ── Density step ────────────────────────────────────────────────────────────
  if (step === STEP.DENSITY) return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FCFCFC' }]} />

      <SAV style={{ flex: 1 }} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => singleEdit ? navigation.goBack() : setStep(STEP.POROSITY)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#3F3028" />
        </TouchableOpacity>

        {renderProgress(3)}

        <ScrollView contentContainerStyle={[styles.stepScroll, { paddingHorizontal: hPad }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>How much hair do you have?</Text>

          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              Density measures how closely packed your hair strands are on your scalp
            </Text>
          </View>

          <TouchableOpacity style={styles.explainBtn} onPress={() => setExplainOpen(true)} activeOpacity={0.75}>
            <Text style={styles.explainBtnText}>Need more explanation?</Text>
          </TouchableOpacity>

          <View style={styles.optionList}>
            {DENSITY_OPTIONS.map(opt => {
              const active = selectedDensity === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => toggleDensity(opt.value)}
                  activeOpacity={0.8}
                >
                  <Image source={opt.image} style={styles.curlIcon} resizeMode="contain" />
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                    <Text style={styles.optionDesc}>{opt.description}</Text>
                  </View>
                  {active && (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={() => handleSaveDensity(null)} activeOpacity={0.7} style={styles.notSureWrap}>
            <Text style={styles.notSure}>I'm not sure yet</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={[styles.bottomActions, { paddingHorizontal: hPad }]}>
          <TouchableOpacity
            style={[styles.continueBtn, !selectedDensity && styles.continueBtnMuted, saving && styles.continueBtnDisabled]}
            onPress={() => handleSaveDensity()}
            disabled={!selectedDensity || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.continueBtnText}>Continue</Text>
            }
          </TouchableOpacity>
        </View>
      </SAV>

      {/* Density explanation modal */}
      <Modal visible={explainOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setExplainOpen(false)}>
        <SAV style={styles.explainModal}>
          <View style={styles.explainHeader}>
            <View style={{ width: 30 }} />
            <Text style={styles.explainTitle}>Hair Density</Text>
            <TouchableOpacity onPress={() => setExplainOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#3F3028" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.explainScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.explainSubtitle}>
              Density is how much hair you have, based on how many strands grow out of each area of your scalp.
            </Text>

            <Text style={styles.explainSubtitle}>
              {'Still not sure? Try this test:\nGather all your hair into a ponytail and wrap it around your thumb.'}
            </Text>

            <View style={styles.explainBullets}>
              {[
                'Low — fits within the first line (crease) of your thumb',
                'Medium — fits within the second line of your thumb',
                'High — too thick to wrap around your thumb',
              ].map((b, i) => (
                <View key={i} style={styles.explainBulletRow}>
                  <Text style={styles.explainBulletDot}>•</Text>
                  <Text style={[styles.explainSubtitle, { flex: 1 }]}>{b}</Text>
                </View>
              ))}
            </View>


          </ScrollView>
        </SAV>
      </Modal>
    </View>
  );

  // ── Texture step ─────────────────────────────────────────────────────────────
  if (step === STEP.TEXTURE) return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FCFCFC' }]} />

      <SAV style={{ flex: 1 }} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => singleEdit ? navigation.goBack() : setStep(STEP.DENSITY)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#3F3028" />
        </TouchableOpacity>

        {renderProgress(4)}

        <ScrollView contentContainerStyle={[styles.stepScroll, { paddingHorizontal: hPad }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>How do the strands of your hair feel?</Text>

          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              Strand thickness is different from the hair density you just covered. This is about how thick each strand is, while density is about how many strands there are.
            </Text>
          </View>

          <View style={[styles.optionList, { marginTop: 8 }]}>
            {TEXTURE_OPTIONS.map(opt => {
              const active = selectedTexture === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => toggleTexture(opt.value)}
                  activeOpacity={0.8}
                >
                  <View style={styles.imgCircle}>
                    <Image source={opt.image} style={styles.curlIcon} resizeMode="contain" />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                    <Text style={styles.optionDesc}>{opt.description}</Text>
                  </View>
                  {active && (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={() => handleSaveTexture(null)} activeOpacity={0.7} style={styles.notSureWrap}>
            <Text style={styles.notSure}>I'm not sure yet</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={[styles.bottomActions, { paddingHorizontal: hPad }]}>
          <TouchableOpacity
            style={[styles.continueBtn, !selectedTexture && styles.continueBtnMuted, saving && styles.continueBtnDisabled]}
            onPress={() => handleSaveTexture()}
            disabled={!selectedTexture || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.continueBtnText}>Continue</Text>
            }
          </TouchableOpacity>
        </View>
      </SAV>
    </View>
  );

  // ── Scalp step ───────────────────────────────────────────────────────────────
  if (step === STEP.SCALP) return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FCFCFC' }]} />

      <SAV style={{ flex: 1 }} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => singleEdit ? navigation.goBack() : setStep(STEP.TEXTURE)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#3F3028" />
        </TouchableOpacity>

        {renderProgress(5)}

        <ScrollView contentContainerStyle={[styles.stepScroll, { paddingHorizontal: hPad }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>How does your scalp normally feel?</Text>

          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              Scalp type is how your scalp normally acts day to day, including how oily, dry, or sensitive it tends to be.
            </Text>
          </View>

          <View style={[styles.optionList, { marginTop: 8 }]}>
            {SCALP_OPTIONS.map(opt => {
              const active = selectedScalp === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => toggleScalp(opt.value)}
                  activeOpacity={0.8}
                >
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                    <Text style={styles.optionDesc}>{opt.description}</Text>
                  </View>
                  {active && (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={() => handleSaveScalp(null)} activeOpacity={0.7} style={styles.notSureWrap}>
            <Text style={styles.notSure}>I'm not sure yet</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={[styles.bottomActions, { paddingHorizontal: hPad }]}>
          <TouchableOpacity
            style={[styles.continueBtn, !selectedScalp && styles.continueBtnMuted, saving && styles.continueBtnDisabled]}
            onPress={() => handleSaveScalp()}
            disabled={!selectedScalp || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.continueBtnText}>Continue</Text>
            }
          </TouchableOpacity>
        </View>
      </SAV>
    </View>
  );

  // ── Goals step ───────────────────────────────────────────────────────────────
  const goalsReady = selectedGoals.length > 0;
  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FCFCFC' }]} />

      <SAV style={{ flex: 1 }} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => singleEdit ? navigation.goBack() : setStep(STEP.SCALP)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#3F3028" />
        </TouchableOpacity>

        {renderProgress(6)}

        <ScrollView contentContainerStyle={[styles.stepScroll, { paddingHorizontal: hPad }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>How do you want to use CRWN?</Text>
          <Text style={styles.goalsSubtitle}>Select everything that applies, we'll personalize your experience around it.</Text>

          <View style={[styles.optionList, { marginTop: 16 }]}>
            {GOALS_OPTIONS.map(opt => {
              const active = selectedGoals.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.goalRow, active && styles.optionRowActive]}
                  onPress={() => toggleGoal(opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.goalLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                  {active && (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.bottomActions, { paddingHorizontal: hPad }]}>
          <TouchableOpacity
            style={[styles.continueBtn, !goalsReady && styles.continueBtnMuted, saving && styles.continueBtnDisabled]}
            onPress={handleSaveGoals}
            disabled={!goalsReady || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.continueBtnText}>Continue</Text>
            }
          </TouchableOpacity>
        </View>
      </SAV>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Landing ──────────────────────────────────────────────────────────────
  landingBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  landingContent: { width: '100%', alignItems: 'center' },
  eyebrow: { fontFamily: 'Figtree_600SemiBold', color: '#000', textTransform: 'uppercase', textAlign: 'center', marginBottom: 20 },
  headline: { fontFamily: 'LibreBaskerville_700Bold', color: '#1A1A1A', textAlign: 'center' },
  headlineCrwn: { fontFamily: 'LibreBaskerville_700Bold', color: '#5D1F1F' },
  headlineItalic: { fontFamily: 'LibreBaskerville_400Regular_Italic', color: '#B35D2B' },
  landingBottom: { paddingBottom: 32, alignItems: 'center' },
  btnWrap: { width: '100%', gap: 12 },

  // ── Shared buttons ────────────────────────────────────────────────────────
  continueBtn: { backgroundColor: '#3F523F', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnMuted: { backgroundColor: 'rgba(55, 72, 55, 0.6)' },
  continueBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  skipBtn: { alignItems: 'center', paddingVertical: 6 },
  skipText: { fontSize: 13, fontFamily: 'Figtree_500Medium', color: '#8B7355' },

  // ── Step chrome ───────────────────────────────────────────────────────────
  backBtn: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, alignSelf: 'flex-start' },
  progressBar: { flexDirection: 'row', gap: 4, marginHorizontal: 24, marginBottom: 20 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E8DDD0' },
  progressDone: { backgroundColor: '#1A1612' },
  progressCurrent: { backgroundColor: '#C4956A' },
  stepScroll: { paddingBottom: 24 },
  stepTitle: { fontSize: 30, fontFamily: 'LibreBaskerville_700Bold', color: '#1A1612', lineHeight: 40, marginBottom: 20 },
  bottomActions: { paddingBottom: 24, paddingTop: 12 },
  notSureWrap: { alignItems: 'center', marginTop: 16, marginBottom: 4 },
  notSure: { fontSize: 13, fontFamily: 'Figtree_400Regular', color: '#A8A8A8', textAlign: 'center' },

  // ── Disclaimer + explain button ───────────────────────────────────────────
  disclaimer: {
    backgroundColor: 'rgba(248, 180, 48, 0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8A6A3A',
    padding: 14,
    marginBottom: 14,
  },
  disclaimerText: { fontSize: 11, fontFamily: 'Figtree_700Bold', color: '#8A6A3A', lineHeight: 17 },
  explainBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#B35D2B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  explainBtnText: { fontSize: 11, fontFamily: 'Figtree_700Bold', color: '#F5DFB8' },

  // ── Option rows ───────────────────────────────────────────────────────────
  optionList: { gap: 10, marginBottom: 16 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0D8D0',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  optionRowActive: { borderColor: '#4F4032', backgroundColor: '#F5F0E8' },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 18, fontFamily: 'Figtree_700Bold', color: '#000000', marginBottom: 3 },
  optionLabelActive: { color: '#4F4032' },
  optionDesc: { fontSize: 16, fontFamily: 'Figtree_500Medium', color: '#000000', lineHeight: 22 },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3F523F',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Curl icons ────────────────────────────────────────────────────────────
  curlIcon: { width: 52, height: 52 },
  imgCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#F5EDE0', alignItems: 'center', justifyContent: 'center' },

  // ── Porosity icons ────────────────────────────────────────────────────────
  porosityImgCol: { alignItems: 'center', width: 62 },
  porosityIcon: { width: 50, height: 70 },
  porosityCaption: { fontSize: 10, fontFamily: 'Figtree_400Regular', color: '#8B7355', fontStyle: 'italic', marginTop: 2, textAlign: 'center' },

  // ── Explanation modal ─────────────────────────────────────────────────────
  explainModal: { flex: 1, backgroundColor: '#FCFCFC' },
  explainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8DDD0',
  },
  explainTitle: { flex: 1, fontSize: 22, fontFamily: 'LibreBaskerville_700Bold', color: '#000000', textAlign: 'center' },
  explainScroll: { padding: 24, gap: 20 },
  explainSubtitle: { fontSize: 18, fontFamily: 'Figtree_400Regular', color: '#000000', lineHeight: 24 },
  explainNote: {
    backgroundColor: 'rgba(248, 180, 48, 0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8A6A3A',
    padding: 14,
  },
  explainNoteText: { fontSize: 11, fontFamily: 'Figtree_700Bold', color: '#8A6A3A', lineHeight: 17 },
  explainType: { gap: 6 },
  explainTypeLabel: { fontSize: 18, fontFamily: 'Figtree_800ExtraBold', color: '#000000' },
  explainPoint: { paddingLeft: 12 },
  explainPointText: { fontSize: 18, fontFamily: 'Figtree_400Regular', color: '#000000', lineHeight: 24 },
  explainPointKey: { fontFamily: 'Figtree_800ExtraBold', fontSize: 18 },

  // ── Porosity modal extras ─────────────────────────────────────────────────
  explainBullets: { gap: 4 },
  explainBulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  explainBulletDot: { fontSize: 18, color: '#000000', lineHeight: 24, fontFamily: 'Figtree_400Regular' },

  porosityVisualBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C4956A',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  porosityVisualImg: { width: '100%', height: 140 },

  // ── Goals step ───────────────────────────────────────────────────────────
  goalsSubtitle: { fontSize: 15, fontFamily: 'Figtree_400Regular', color: '#3F3028', lineHeight: 22, marginBottom: 4 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0D8D0',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  goalLabel: { flex: 1, fontSize: 15, fontFamily: 'Figtree_500Medium', color: '#1A1612' },
});
