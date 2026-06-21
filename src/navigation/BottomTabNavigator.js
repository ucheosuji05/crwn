import { useState, useRef, useCallback, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { CardStyleInterpolators } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { Compass, Globe, Scissors, Bell, User } from 'lucide-react-native';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Platform, Image, Animated,
  Pressable,
} from 'react-native';

import ExploreScreen from '../screens/ExploreScreen';
import FilteredExploreScreen from '../screens/FilteredExploreScreen';
import CommunityScreen from '../screens/CommunityScreen';
import FilteredCommunityScreen from '../screens/FilteredCommunityScreen';
import StylistsScreen from '../screens/StylistsScreen';
import StylistDashboardScreen from '../screens/StylistDashboardScreen';
import ProviderAnalyticsScreen from '../screens/ProviderAnalyticsScreen';
import ProviderNotificationsScreen from '../screens/ProviderNotificationsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsList from '../components/NotificationsList';
import { useUnreadCount } from '../context/UnreadCountContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useProviderMode } from '../context/ProviderModeContext';
import { supabase } from '../config/supabase';
import { notificationService } from '../services/notificationService';
import { bookingService } from '../services/bookingService';

const Tab = createBottomTabNavigator();
const ExploreStack = createStackNavigator();
const CommunityStack = createStackNavigator();

const isWeb = Platform.OS === 'web';
const HZ = { gestureEnabled: !isWeb, gestureDirection: 'horizontal', cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS };

function ExploreStackNavigator() {
  return (
    <ExploreStack.Navigator screenOptions={{ headerShown: false }}>
      <ExploreStack.Screen name="ExploreHome" component={ExploreScreen} />
      <ExploreStack.Screen name="FilteredExplore" component={FilteredExploreScreen} options={HZ} />
    </ExploreStack.Navigator>
  );
}

function CommunityStackNavigator() {
  return (
    <CommunityStack.Navigator screenOptions={{ headerShown: false }}>
      <CommunityStack.Screen name="CommunityHome" component={CommunityScreen} />
      <CommunityStack.Screen name="FilteredCommunity" component={FilteredCommunityScreen} options={HZ} />
    </CommunityStack.Navigator>
  );
}

const DOUBLE_TAP_MS = 400;
const SIDEBAR_WIDTH = 210;
const PANEL_WIDTH = 380;

const NAV_ACTIVE_COLOR = '#C17A3A';
const NAV_INACTIVE_COLOR = '#9E9E9E';
const NAV_ICON_SIZE = 24;
const NAV_ICON_STROKE = 2;

// Lucide icon used for each client-mode tab
const NAV_ICONS = {
  'Crwn.': Compass,
  Community: Globe,
  Stylists: Scissors,
  Notifications: Bell,
  Profile: User,
};

// ── Notification icon with badge ──────────────────────────────────────────────
// `renderIcon(color, size)` returns the icon element so callers can mix
// lucide icons (client mode) with Ionicons (provider "Inbox" mail icon).

function NotifIcon({ color, size, unreadCount, primaryColor, renderIcon }) {
  return (
    <View>
      {renderIcon(color, size)}
      {unreadCount > 0 && (
        <View style={[styles.badge, { backgroundColor: primaryColor }]}>
          <Text style={styles.badgeText}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Web sidebar ───────────────────────────────────────────────────────────────

function WebSidebar({
  state, navigation, colors,
  unreadCount, bookingNotifCount,
  lastTap, setResetKeys,
  notifOpen, onNotifToggle,
  isProviderMode,
}) {
  // Nav items change when a stylist switches to provider mode.
  // Provider-only slots (Analytics/Calendar/Inbox) keep Ionicons since they
  // have no lucide equivalent in the spec; client-mode slots use lucide icons.
  const NAV_ITEMS = isProviderMode ? [
    { name: 'Crwn.',         label: 'Explore',        icon: 'compass-outline'     },
    { name: 'Community',     label: 'Analytics',      icon: 'stats-chart-outline' },
    { name: 'Stylists',      label: 'Calendar',       icon: 'calendar-outline'    },
    { name: 'Notifications', label: 'Inbox',          icon: 'mail-outline' },
    { name: 'Profile',       label: 'Profile',        icon: 'person-outline'      },
  ] : [
    { name: 'Crwn.',         label: 'Explore'   },
    { name: 'Community',     label: 'Community' },
    { name: 'Stylists',      label: 'Service Providers'  },
    { name: 'Notifications', label: 'Inbox'     },
    { name: 'Profile',       label: 'Profile'   },
  ];

  return (
    <View style={[sidebar.rail, { backgroundColor: colors.tabBar, borderRightColor: colors.border }]}>
      <View style={sidebar.logoRow}>
        <Image
          source={require('../../assets/pictures/crwn_logo1.png')}
          style={sidebar.logoImage}
          resizeMode="cover"
        />
      </View>

      {state.routes.map((route, index) => {
        const isNotif = route.name === 'Notifications';

        // In provider mode Notifications is a real screen — no panel toggle.
        // In client mode it opens the slide panel.
        const usePanel = isNotif && !isProviderMode;

        const focused = usePanel
          ? notifOpen
          : (state.index === index && !notifOpen);
        const color = focused ? NAV_ACTIVE_COLOR : NAV_INACTIVE_COLOR;
        const item = NAV_ITEMS.find((n) => n.name === route.name);
        if (!item) return null;

        const LucideIcon = !isProviderMode && NAV_ICONS[route.name];

        // Badge count: provider uses booking notifs, client uses social notifs
        const badgeCount = isNotif
          ? (isProviderMode ? bookingNotifCount : unreadCount)
          : 0;

        const onPress = () => {
          if (usePanel) {
            onNotifToggle();
            return;
          }
          // Close slide panel if it was open
          if (notifOpen) onNotifToggle();

          const now = Date.now();
          const prev = lastTap.current[route.name] ?? 0;
          if (prev && now - prev < DOUBLE_TAP_MS) {
            lastTap.current[route.name] = 0;
            setResetKeys((k) => ({ ...k, [route.name]: k[route.name] + 1 }));
          } else {
            lastTap.current[route.name] = now;
          }
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={[sidebar.item, focused && { backgroundColor: colors.backgroundAlt }]}
            onPress={onPress}
            activeOpacity={0.75}
          >
            <View style={sidebar.iconWrap}>
              {isNotif ? (
                <NotifIcon
                  color={color}
                  size={NAV_ICON_SIZE}
                  unreadCount={badgeCount}
                  primaryColor={colors.primary}
                  renderIcon={(c, s) => isProviderMode
                    ? <Ionicons name="mail-outline" size={s} color={c} />
                    : <Bell size={s} color={c} strokeWidth={NAV_ICON_STROKE} />
                  }
                />
              ) : LucideIcon ? (
                <LucideIcon size={NAV_ICON_SIZE} color={color} strokeWidth={NAV_ICON_STROKE} />
              ) : (
                <Ionicons name={item.icon} size={NAV_ICON_SIZE} color={color} />
              )}
            </View>
            <Text style={[sidebar.label, {
              color,
              fontFamily: focused ? 'Figtree_600SemiBold' : 'Figtree_400Regular',
            }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Notifications slide panel (web only) ──────────────────────────────────────

function NotifPanel({ open, onClose, slideAnim, colors }) {
  if (!open) return null;
  return (
    <>
      <Pressable style={panel.backdrop} onPress={onClose} />
      <Animated.View style={[panel.sheet, { borderRightColor: colors.border, width: slideAnim }]}>
        <View style={[panel.inner, { backgroundColor: colors.surface }]}>
          {/* Panel header */}
          <View style={[panel.header, { borderBottomColor: colors.hairline }]}>
            <Text style={[panel.title, { color: colors.text }]}>Inbox</Text>
            <TouchableOpacity onPress={onClose} style={panel.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <NotificationsList panelMode />
        </View>
      </Animated.View>
    </>
  );
}

// ── In-app toast ──────────────────────────────────────────────────────────────

function InAppToast({ toast, anim, onDismiss, colors, isWeb }) {
  if (!toast) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });

  return (
    <Animated.View
      style={[
        styles.toast,
        isWeb ? styles.toastWeb : styles.toastMobile,
        {
          backgroundColor: colors.surface,
          opacity: anim,
          transform: [{ translateY }],
        },
      ]}
    >
      {/* Coloured icon */}
      <View style={[styles.toastIconCircle, { backgroundColor: toast.color + '22' }]}>
        <Ionicons name={toast.icon} size={18} color={toast.color} />
      </View>

      {/* Text */}
      <View style={styles.toastText}>
        <Text style={[styles.toastTitle, { color: colors.text }]} numberOfLines={1}>
          {toast.title}
        </Text>
        {!!toast.body && (
          <Text style={[styles.toastBody, { color: colors.textMuted }]} numberOfLines={2}>
            {toast.body}
          </Text>
        )}
      </View>

      {/* Dismiss */}
      <TouchableOpacity
        onPress={onDismiss}
        style={styles.toastClose}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={15} color={colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main navigator ─────────────────────────────────────────────────────────────

export default function BottomTabNavigator() {
  const { notifCount: unreadNotifCount, bookingNotifCount, clearNotifs, clearBookingNotifs } = useUnreadCount();
  const { colors } = useTheme();
  const { profile, profileLoaded } = useAuth();
  const { isProviderMode } = useProviderMode();
  const isStylist = !!profile?.is_stylist;
  const isWeb = Platform.OS === 'web';

  const [resetKeys, setResetKeys] = useState({
    'Crwn.': 0, Community: 0, Stylists: 0, Notifications: 0, Profile: 0,
  });
  const [notifOpen, setNotifOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const lastTap = useRef({});

  // ── In-app toast ─────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null); // { icon, color, title, body }
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  const openNotif = useCallback(() => {
    setNotifOpen(true);
    Animated.spring(slideAnim, {
      toValue: PANEL_WIDTH,
      useNativeDriver: false,
      tension: 120,
      friction: 22,
    }).start();

    // Clear badge counts immediately, then persist to DB in the background
    clearNotifs();
    clearBookingNotifs();
    if (profile?.id) {
      notificationService.markAllAsRead(profile.id).catch(() => {});
      bookingService.markAllRead(profile.id).catch(() => {});
    }
  }, [slideAnim, clearNotifs, clearBookingNotifs, profile?.id]);

  const closeNotif = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start(() => setNotifOpen(false));
  }, [slideAnim]);

  const toggleNotif = useCallback(() => {
    notifOpen ? closeNotif() : openNotif();
  }, [notifOpen, openNotif, closeNotif]);

  // ── Toast helpers ─────────────────────────────────────────────────────────────

  const showToast = useCallback((data) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(data);
    toastAnim.setValue(0);
    Animated.spring(toastAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 18,
    }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 4500);
  }, [toastAnim]);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [toastAnim]);

  // Subscribe to both notification tables for in-app toasts
  useEffect(() => {
    if (!profile?.id) return;

    const SOCIAL_TYPE = {
      like:    { icon: 'heart',            color: '#ef4444', body: 'Someone liked your post' },
      crown:   { icon: 'star',             color: '#F8B430', body: 'Someone crowned your post' },
      comment: { icon: 'chatbubble',       color: '#6C47FF', body: 'Someone commented on your post' },
      follow:  { icon: 'person-add',       color: '#6C47FF', body: 'Someone started following you' },
    };
    const BOOKING_TYPE = {
      booking_request:   { icon: 'calendar',         color: '#F59E0B' },
      booking_confirmed: { icon: 'checkmark-circle', color: '#10B981' },
      booking_declined:  { icon: 'close-circle',     color: '#ef4444' },
      booking_completed: { icon: 'ribbon-outline',    color: '#F8B430' },
    };

    const socialCh = supabase
      .channel(`toast_social:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        const n = payload.new;
        const cfg = SOCIAL_TYPE[n.type] ?? { icon: 'notifications', color: '#6C47FF', body: '' };
        showToast({ icon: cfg.icon, color: cfg.color, title: 'New Notification', body: cfg.body });
      })
      .subscribe();

    const bookingCh = supabase
      .channel(`toast_booking:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'booking_notifications',
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        const n = payload.new;
        const cfg = BOOKING_TYPE[n.type] ?? { icon: 'notifications', color: '#6C47FF' };
        showToast({ icon: cfg.icon, color: cfg.color, title: n.title || 'Booking Update', body: n.body || '' });
      })
      .subscribe();

    return () => {
      socialCh.unsubscribe();
      bookingCh.unsubscribe();
    };
  }, [profile?.id, showToast]);

  const screenListeners = ({ route }) => ({
    tabPress: () => {
      const now = Date.now();
      const prev = lastTap.current[route.name] ?? 0;
      if (prev && now - prev < DOUBLE_TAP_MS) {
        lastTap.current[route.name] = 0;
        setResetKeys((k) => ({ ...k, [route.name]: k[route.name] + 1 }));
      } else {
        lastTap.current[route.name] = now;
      }
    },
  });

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenListeners={isWeb ? undefined : screenListeners}
        tabBar={isWeb ? (props) => (
          <WebSidebar
            {...props}
            colors={colors}
            unreadCount={unreadNotifCount}
            bookingNotifCount={bookingNotifCount}
            lastTap={lastTap}
            setResetKeys={setResetKeys}
            notifOpen={notifOpen}
            onNotifToggle={toggleNotif}
            isProviderMode={isStylist && isProviderMode}
          />
        ) : undefined}
        sceneContainerStyle={isWeb ? { marginLeft: SIDEBAR_WIDTH } : undefined}
        screenOptions={({ route }) => ({
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
          },
          tabBarIcon: ({ focused, color }) => {
            // Provider mode overrides icons for slots 2-4 — no lucide
            // equivalents specified for these, so keep Ionicons.
            if (isStylist && isProviderMode) {
              if (route.name === 'Notifications') {
                return (
                  <NotifIcon
                    color={color}
                    size={NAV_ICON_SIZE}
                    unreadCount={bookingNotifCount}
                    primaryColor={colors.primary}
                    renderIcon={(c, s) => <Ionicons name="mail-outline" size={s} color={c} />}
                  />
                );
              }
              let iconName;
              switch (route.name) {
                case 'Crwn.':     iconName = 'compass-outline';     break;
                case 'Community': iconName = 'stats-chart-outline'; break;
                case 'Stylists':  iconName = 'calendar-outline';    break;
                case 'Profile':   iconName = 'person-outline';      break;
              }
              return <Ionicons name={iconName} size={NAV_ICON_SIZE} color={color} />;
            }

            // Default client-mode icons — lucide, per design spec
            if (route.name === 'Notifications') {
              return (
                <NotifIcon
                  color={color}
                  size={NAV_ICON_SIZE}
                  unreadCount={unreadNotifCount + bookingNotifCount}
                  primaryColor={colors.primary}
                  renderIcon={(c, s) => <Bell size={s} color={c} strokeWidth={NAV_ICON_STROKE} />}
                />
              );
            }
            const LucideIcon = NAV_ICONS[route.name];
            return <LucideIcon size={NAV_ICON_SIZE} color={color} strokeWidth={NAV_ICON_STROKE} />;
          },
          tabBarActiveTintColor: NAV_ACTIVE_COLOR,
          tabBarInactiveTintColor: NAV_INACTIVE_COLOR,
          tabBarShowLabel: false,
        })}
      >
        <Tab.Screen name="Crwn." options={{ headerShown: false }}>
          {(props) => <ExploreStackNavigator {...props} key={resetKeys['Crwn.']} />}
        </Tab.Screen>

        <Tab.Screen name="Community" options={{ headerShown: false }}>
          {(props) => isStylist && isProviderMode
            ? <ProviderAnalyticsScreen {...props} key={resetKeys.Community} />
            : <CommunityStackNavigator {...props} key={resetKeys.Community} />}
        </Tab.Screen>

        <Tab.Screen name="Stylists" options={{ headerShown: false }}>
          {(props) => !profileLoaded
            ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>
            : isStylist && isProviderMode
              ? <StylistDashboardScreen {...props} key={resetKeys.Stylists} />
              : <StylistsScreen {...props} key={resetKeys.Stylists} />}
        </Tab.Screen>

        <Tab.Screen name="Notifications" options={{ headerShown: false }}>
          {(props) => isStylist && isProviderMode
            ? <ProviderNotificationsScreen {...props} key={resetKeys.Notifications} />
            : <NotificationsScreen {...props} key={resetKeys.Notifications} />}
        </Tab.Screen>

        <Tab.Screen name="Profile" options={{ headerShown: false }}>
          {(props) => <ProfileScreen {...props} key={resetKeys.Profile} />}
        </Tab.Screen>
      </Tab.Navigator>

      {/* Web-only: sliding notifications panel — client mode only */}
      {isWeb && !(isStylist && isProviderMode) && (
        <NotifPanel
          open={notifOpen}
          onClose={closeNotif}
          slideAnim={slideAnim}
          colors={colors}
        />
      )}

      {/* In-app toast — floats above everything, passes touches through when hidden */}
      <View style={styles.toastWrapper} pointerEvents="box-none">
        <InAppToast
          toast={toast}
          anim={toastAnim}
          onDismiss={dismissToast}
          colors={colors}
          isWeb={isWeb}
        />
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'Figtree_700Bold',
    lineHeight: 12,
  },

  // ── Toast ──
  toastWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: 9999,
  },
  toast: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  toastMobile: {
    bottom: 88,   // above the native tab bar (~56 px) + breathing room
    left: 16,
    right: 16,
  },
  toastWeb: {
    bottom: 20,
    left: SIDEBAR_WIDTH + 16,
    maxWidth: 380,
  },
  toastIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: { flex: 1 },
  toastTitle: {
    fontSize: 13,
    fontFamily: 'Figtree_600SemiBold',
    marginBottom: 1,
  },
  toastBody: {
    fontSize: 12,
    fontFamily: 'Figtree_400Regular',
    lineHeight: 16,
  },
  toastClose: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Plain objects — web-only, avoids native style validation warnings
const sidebar = {
  rail: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: 36,
    paddingHorizontal: 12,
    zIndex: 100,
  },
  logoRow: { paddingHorizontal: 12, marginBottom: 28 },
  logoImage: { width: 56, height: 56, borderRadius: 14 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  iconWrap: { width: 24, alignItems: 'center' },
  label: { fontSize: 15 },
};

const panel = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sheet: {
    position: 'fixed',
    top: 0,
    left: SIDEBAR_WIDTH,
    bottom: 0,
    zIndex: 201,
    overflow: 'hidden',
    borderRightWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  inner: {
    width: PANEL_WIDTH,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Figtree_700Bold',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
};
