import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions, Modal, TextInput, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Crown } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bookingService } from '../services/bookingService';
import { postService } from '../services/postService';
import PostCard from '../components/PostCard';

const HONEY = '#D4930A';
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 8;
const GRID_SIZE = (SCREEN_WIDTH - GRID_GAP * 3) / 2;

const TABS = ['Posts', 'Services', 'Reviews', 'Tagged'];

// ── Booking modal ─────────────────────────────────────────────────────────────

function BookingModal({ visible, stylist, preselectedService, onClose, colors }) {
  const { user } = useAuth();
  const bs = useMemo(() => makeBookingStyles(colors), [colors]);
  const [services, setServices]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [date, setDate]             = useState('');
  const [time, setTime]             = useState('');
  const [notes, setNotes]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingSvc, setLoadingSvc] = useState(true);

  useEffect(() => {
    if (!visible || !stylist?.id) return;
    setLoadingSvc(true);
    bookingService.getServices(stylist.id).then(({ data }) => {
      setServices(data || []);
      setSelected(preselectedService || data?.[0] || null);
      setLoadingSvc(false);
    });
  }, [visible, stylist?.id, preselectedService]);

  const reset = () => { setDate(''); setTime(''); setNotes(''); setSelected(null); };

  const handleBook = async () => {
    if (!selected) { Alert.alert('Select a service', 'Please choose a service to book.'); return; }
    if (!date.trim()) { Alert.alert('Date required', 'Please enter your preferred appointment date.'); return; }

    // Basic date format check (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date.trim())) {
      Alert.alert('Invalid date', 'Please use YYYY-MM-DD format (e.g. 2025-06-15).');
      return;
    }

    setSubmitting(true);
    const { error } = await bookingService.createBooking({
      userId: user.id,
      stylistId: stylist.id,
      serviceName: selected.name,
      appointmentDate: date.trim(),
      appointmentTime: time.trim() || null,
      notes: notes.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Booking failed', 'Something went wrong. Please try again.');
    } else {
      Alert.alert('Booking requested!', `Your appointment with ${stylist.name} for ${selected.name} has been requested.`);
      reset();
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={bs.header}>
          <Text style={bs.title}>Book Appointment</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={bs.body} keyboardShouldPersistTaps="handled">
          {/* Stylist info strip */}
          <View style={bs.stylistStrip}>
            <Ionicons name="cut-outline" size={18} color={colors.primary} />
            <Text style={bs.stylistName}>{stylist?.name}</Text>
            {stylist?.location ? <Text style={bs.stylistLoc}>{stylist.location}</Text> : null}
          </View>

          {/* Service picker */}
          <Text style={bs.label}>Choose Service</Text>
          {loadingSvc ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : services.length === 0 ? (
            <Text style={bs.noServices}>This stylist has no services listed yet.</Text>
          ) : (
            services.map(svc => (
              <TouchableOpacity
                key={svc.id}
                style={[bs.serviceOption, selected?.id === svc.id && bs.serviceOptionActive]}
                onPress={() => setSelected(svc)}
              >
                <View style={bs.serviceOptionLeft}>
                  <Text style={bs.serviceOptionName}>{svc.name}</Text>
                  {svc.description ? <Text style={bs.serviceOptionDesc} numberOfLines={1}>{svc.description}</Text> : null}
                  {svc.duration_min ? <Text style={bs.serviceOptionMeta}>{svc.duration_min} min</Text> : null}
                </View>
                <View style={bs.serviceOptionRight}>
                  <Text style={bs.serviceOptionPrice}>${svc.price?.toFixed(2)}</Text>
                  {selected?.id === svc.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Date */}
          <Text style={bs.label}>Preferred Date</Text>
          <TextInput
            style={bs.input}
            placeholder="YYYY-MM-DD (e.g. 2025-06-15)"
            placeholderTextColor={colors.placeholder}
            value={date}
            onChangeText={setDate}
            keyboardType="numbers-and-punctuation"
          />

          {/* Time */}
          <Text style={bs.label}>Preferred Time (optional)</Text>
          <TextInput
            style={bs.input}
            placeholder="e.g. 10:00 AM"
            placeholderTextColor={colors.placeholder}
            value={time}
            onChangeText={setTime}
          />

          {/* Notes */}
          <Text style={bs.label}>Notes (optional)</Text>
          <TextInput
            style={[bs.input, bs.textArea]}
            placeholder="Any details for your stylist..."
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            value={notes}
            onChangeText={setNotes}
          />
        </ScrollView>

        {/* Book button */}
        <TouchableOpacity
          style={[bs.bookBtn, (submitting || services.length === 0) && { opacity: 0.6 }]}
          onPress={handleBook}
          disabled={submitting || services.length === 0}
        >
          <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={bs.bookBtnText}>Confirm Booking</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeBookingStyles = (c) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  title: { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text },
  body: { padding: 20, paddingBottom: 8 },
  stylistStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 20, backgroundColor: c.primaryLight, borderColor: c.borderLight },
  stylistName: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: c.primary, flex: 1 },
  stylistLoc: { fontSize: 12, color: c.textSecondary },
  label: { fontSize: 12, fontFamily: 'Figtree_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16, color: c.textSecondary },
  noServices: { fontSize: 14, textAlign: 'center', paddingVertical: 12, color: c.textMuted },
  serviceOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1.5, marginBottom: 8, backgroundColor: c.surface, borderColor: c.border },
  serviceOptionActive: { backgroundColor: c.primaryLight, borderColor: c.primary },
  serviceOptionLeft: { flex: 1 },
  serviceOptionName: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', marginBottom: 2, color: c.text },
  serviceOptionDesc: { fontSize: 12, marginBottom: 2, color: c.textSecondary },
  serviceOptionMeta: { fontSize: 11, color: c.textMuted },
  serviceOptionRight: { alignItems: 'flex-end', gap: 4 },
  serviceOptionPrice: { fontSize: 16, fontFamily: 'Figtree_700Bold', color: c.text },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 4, color: c.text, borderColor: c.border, backgroundColor: c.inputBackground },
  textArea: { minHeight: 80, paddingTop: 12 },
  bookBtn: { margin: 20, borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bookBtnText: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StylistProfileScreen({ route, navigation }) {
  const stylist = route?.params?.stylist || {};
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeTab, setActiveTab]           = useState('Posts');
  const [bookingVisible, setBookingVisible]   = useState(false);
  const [bookingService_, setBookingService]  = useState(null);
  const [services, setServices]               = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [taggedPosts, setTaggedPosts]         = useState([]);
  const [taggedLoading, setTaggedLoading]     = useState(false);
  const [selectedPost, setSelectedPost]       = useState(null);
  const { user } = useAuth();

  const {
    id: stylistId,
    name = 'Stylist',
    location = '',
    rating = 0,
    reviewCount = 0,
    specialties = [],
    photos = [],
  } = stylist;

  const avatarUri = photos[0];
  const AVATAR_SIZE = 90;
  const BANNER_HEIGHT = 120;

  // Fetch services
  useEffect(() => {
    if (!stylistId) return;
    bookingService.getServices(stylistId).then(({ data }) => {
      setServices(data || []);
      setServicesLoading(false);
    });
  }, [stylistId]);

  // Fetch tagged posts when that tab opens
  useEffect(() => {
    if (activeTab !== 'Tagged' || !stylistId) return;
    setTaggedLoading(true);
    postService.getTaggedPosts(stylistId).then(({ data }) => {
      setTaggedPosts(data || []);
      setTaggedLoading(false);
    });
  }, [activeTab, stylistId]);

  const openBooking = (svc = null) => {
    setBookingService(svc);
    setBookingVisible(true);
  };

  // ── Tab content ─────────────────────────────────────────────────────────────

  const renderPosts = () => {
    const rows = [];
    for (let i = 0; i < photos.length; i += 2) rows.push(photos.slice(i, i + 2));
    return (
      <View style={styles.gridContainer}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map((src, i) => (
              <View key={i} style={styles.gridCell}>
                <Image source={typeof src === 'string' ? { uri: src } : src} style={styles.gridImage} resizeMode="cover" />
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const renderServices = () => {
    if (servicesLoading) return <ActivityIndicator color={colors.primary} style={{ paddingTop: 48 }} />;
    if (services.length === 0) return (
      <View style={styles.emptyState}>
        <Ionicons name="cut-outline" size={36} color={colors.border} />
        <Text style={styles.emptyTitle}>No services yet</Text>
        <Text style={styles.emptyText}>This stylist hasn't added services yet</Text>
      </View>
    );
    return (
      <View style={styles.servicesList}>
        {services.map(svc => (
          <View key={svc.id} style={styles.serviceCard}>
            <View style={styles.serviceCardLeft}>
              <Text style={styles.serviceCardName}>{svc.name}</Text>
              {svc.description ? <Text style={styles.serviceCardDesc} numberOfLines={2}>{svc.description}</Text> : null}
              {svc.duration_min ? (
                <View style={styles.serviceCardMeta}>
                  <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.serviceCardMetaText}>{svc.duration_min} min</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.serviceCardRight}>
              <Text style={styles.serviceCardPrice}>${svc.price?.toFixed(2)}</Text>
              <TouchableOpacity style={styles.bookServiceBtn} onPress={() => openBooking(svc)}>
                <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                <Text style={styles.bookServiceBtnText}>Book</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Posts':    return renderPosts();
      case 'Services': return renderServices();
      case 'Reviews':
        return (
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={36} color={colors.border} />
            <Text style={styles.emptyTitle}>{reviewCount} Reviews</Text>
            <Text style={styles.emptyText}>Reviews will appear here</Text>
          </View>
        );
      case 'Tagged': {
        if (taggedLoading) return <ActivityIndicator color={colors.primary} style={{ paddingTop: 48 }} />;
        if (taggedPosts.length === 0) return (
          <View style={styles.emptyState}>
            <Ionicons name="cut-outline" size={36} color={colors.border} />
            <Text style={styles.emptyTitle}>No tagged posts yet</Text>
            <Text style={styles.emptyText}>Posts where clients tag this stylist will appear here</Text>
          </View>
        );
        const taggedRows = [];
        for (let i = 0; i < taggedPosts.length; i += 2) taggedRows.push(taggedPosts.slice(i, i + 2));
        return (
          <View style={styles.gridContainer}>
            {taggedRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {row.map((item) => {
                  const thumb = item.post_media?.[0]?.media_url;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.gridCell}
                      onPress={() => setSelectedPost(item)}
                      activeOpacity={0.8}
                    >
                      {thumb
                        ? <Image source={{ uri: thumb }} style={styles.gridImage} resizeMode="cover" />
                        : <View style={[styles.gridImage, { backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="image-outline" size={20} color="#9ca3af" /></View>}
                      {item.profiles && (
                        <View style={styles.tilePostedBy}>
                          <Text style={styles.tilePostedByText} numberOfLines={1}>
                            {item.profiles.full_name || item.profiles.username}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                {row.length < 2 && <View style={styles.gridCell} />}
              </View>
            ))}
          </View>
        );
      }
      default: return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: BANNER_HEIGHT }} />

        <View style={[styles.avatarRow, { marginTop: -(AVATAR_SIZE / 2) }]}>
          <View style={[styles.avatarRing, { width: AVATAR_SIZE + 4, height: AVATAR_SIZE + 4, borderRadius: (AVATAR_SIZE + 4) / 2, backgroundColor: colors.surface }]}>
            {avatarUri
              ? <Image source={{ uri: avatarUri }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }} />
              : <View style={[styles.avatarPlaceholder, { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }]}><Ionicons name="person" size={44} color="#9ca3af" /></View>}
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{location}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Crown size={14} color={HONEY} />
            <Text style={styles.metaText}>({reviewCount} reviews)</Text>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.statNumber}>{photos.length}</Text><Text style={styles.statLabel}>Posts</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.stat}><Text style={styles.statNumber}>{services.length}</Text><Text style={styles.statLabel}>Services</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.stat}><Text style={styles.statNumber}>{rating}</Text><Text style={styles.statLabel}>Rating</Text></View>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.bookBtn} onPress={() => openBooking()}>
              <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.bookBtnText}>Book</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.messageBtn}>
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabs}>
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity key={tab} style={styles.tab} onPress={() => setActiveTab(tab)} activeOpacity={0.7}>
                <Text style={[styles.tabText, active && styles.activeTabText]}>{tab}</Text>
                {active && <View style={styles.activeUnderline} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {renderTabContent()}
      </ScrollView>

      <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.9)" />
      </TouchableOpacity>

      <View style={[styles.socialIcons, { top: insets.top + 8 }]}>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="globe-outline" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="logo-instagram" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>

      <BookingModal
        visible={bookingVisible}
        stylist={stylist}
        preselectedService={bookingService_}
        onClose={() => { setBookingVisible(false); setBookingService(null); }}
        colors={colors}
      />

      {/* Tagged post detail modal */}
      <Modal
        visible={!!selectedPost}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedPost(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
          <View style={styles.postModalHeader}>
            <TouchableOpacity onPress={() => setSelectedPost(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {selectedPost && (
              <PostCard
                post={selectedPost}
                currentUserId={user?.id}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  avatarRow: { alignItems: 'center', zIndex: 1 },
  avatarRing: { alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholder: { backgroundColor: c.border, alignItems: 'center', justifyContent: 'center' },
  info: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  name: { fontSize: 24, fontFamily: 'Figtree_700Bold', color: c.text, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20 },
  metaText: { fontSize: 13, color: c.textSecondary, fontFamily: 'Figtree_400Regular' },
  metaDot: { fontSize: 13, color: c.textSecondary, marginHorizontal: 2 },
  stats: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stat: { alignItems: 'center', paddingHorizontal: 24 },
  statDivider: { width: 1, height: 32, backgroundColor: c.border },
  statNumber: { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text, marginBottom: 2 },
  statLabel: { fontSize: 12, color: c.textSecondary },
  buttons: { flexDirection: 'row', gap: 12, marginBottom: 16, width: '100%' },
  bookBtn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bookBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
  messageBtn: { flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: c.primary, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  messageBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: c.primary },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { fontSize: 15, color: c.textSecondary, fontFamily: 'Figtree_500Medium' },
  activeTabText: { color: c.selected, fontFamily: 'Figtree_700Bold' },
  activeUnderline: { position: 'absolute', bottom: -1, left: 8, right: 8, height: 3, borderRadius: 2, backgroundColor: '#5D1F1F' },
  gridContainer: { padding: GRID_GAP },
  gridRow: { flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP },
  gridCell: { width: GRID_SIZE, height: GRID_SIZE, borderRadius: 10, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },
  emptyState: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontFamily: 'Figtree_600SemiBold', color: c.text },
  emptyText: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },
  servicesList: { padding: 16, gap: 12 },
  serviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.borderLight, gap: 12 },
  serviceCardLeft: { flex: 1 },
  serviceCardName: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: c.text, marginBottom: 3 },
  serviceCardDesc: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 4 },
  serviceCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  serviceCardMetaText: { fontSize: 12, color: c.textMuted },
  serviceCardRight: { alignItems: 'flex-end', gap: 10 },
  serviceCardPrice: { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text },
  bookServiceBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bookServiceBtnText: { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
  backBtn: { position: 'absolute', left: 14, padding: 6, zIndex: 100 },
  socialIcons: { position: 'absolute', right: 14, flexDirection: 'row', gap: 12, zIndex: 100 },
  tilePostedBy: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tilePostedByText: {
    fontSize: 10,
    color: '#fff',
    fontFamily: 'Figtree_500Medium',
  },
  postModalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
});
