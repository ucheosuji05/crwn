import { useState, useRef, useCallback, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Platform, Image, Animated,
  Pressable,
} from 'react-native';

import ExploreScreen from '../screens/ExploreScreen';
import CommunityScreen from '../screens/CommunityScreen';
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

const DOUBLE_TAP_MS = 400;
const SIDEBAR_WIDTH = 210;
const PANEL_WIDTH = 380;

// ── Notification icon with badge ──────────────────────────────────────────────

function NotifIcon({ focused, color, size, unreadCount, primaryColor, iconOn = 'notifications', iconOff = 'notifications-outline' }) {
  return (
    <View>
      <Ionicons
        name={focused ? iconOn : iconOff}
        size={size}
        color={color}
      />
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
  // Nav items change when a stylist switches to provider mode
  const NAV_ITEMS = isProviderMode ? [
    { name: 'Crwn.',         label: 'Explore',        icon: 'compass-outline'     },
    { name: 'Community',     label: 'Analytics',      icon: 'stats-chart-outline' },
    { name: 'Stylists',      label: 'Calendar',       icon: 'calendar-outline'    },
    { name: 'Notifications', label: 'Inbox',          icon: 'notifications-outline' },
    { name: 'Profile',       label: 'Profile',        icon: 'person-outline'      },
  ] : [
    { name: 'Crwn.',         label: 'Explore',        icon: 'compass-outline'     },
    { name: 'Community',     label: 'Community',      icon: 'globe-outline'       },
    { name: 'Stylists',      label: 'Stylists',       icon: 'cut-outline'         },
    { name: 'Notifications', label: 'Inbox',          icon: 'notifications-outline' },
    { name: 'Profile',       label: 'Profile',        icon: 'person-outline'      },
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
        const color = focused ? colors.selected : colors.textMuted;
        const item = NAV_ITEMS.find((n) => n.name === route.name);
        if (!item) return null;

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
                  focused={focused}
                  color={color}
                  size={22}
                  unreadCount={badgeCount}
                  primaryColor={colors.primary}
                  iconOn={isProviderMode ? 'mail-outline' : 'notifications-outline'}
                  iconOff={isProviderMode ? 'mail-outline' : 'notifications-outline'}
                />
              ) : (
                <Ionicons name={item.icon} size={22} color={color} />
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
          tabBarIcon: ({ focused, color, size }) => {
            // Provider mode overrides icons for slots 2-4
            if (isStylist && isProviderMode) {
              if (route.name === 'Notifications') {
                return (
                  <NotifIcon
                    focused={focused}
                    color={color}
                    size={size}
                    unreadCount={bookingNotifCount}
                    primaryColor={colors.primary}
                    iconOn="mail-outline"
                    iconOff="mail-outline"
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
              return <Ionicons name={iconName} size={size} color={color} />;
            }

            // Default client-mode icons
            if (route.name === 'Notifications') {
              return (
                <NotifIcon
                  focused={focused}
                  color={color}
                  size={size}
                  unreadCount={unreadNotifCount + bookingNotifCount}
                  primaryColor={colors.primary}
                  iconOn="notifications-outline"
                  iconOff="notifications-outline"
                />
              );
            }
            let iconName;
            switch (route.name) {
              case 'Crwn.':     iconName = 'compass-outline'; break;
              case 'Community': iconName = 'globe-outline';   break;
              case 'Stylists':  iconName = 'cut-outline';     break;
              case 'Profile':   iconName = 'person-outline';  break;
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: colors.selected,
          tabBarInactiveTintColor: 'gray',
          tabBarShowLabel: false,
        })}
      >
        <Tab.Screen name="Crwn." options={{ headerShown: false }}>
          {(props) => <ExploreScreen {...props} key={resetKeys['Crwn.']} />}
        </Tab.Screen>

        <Tab.Screen name="Community" options={{ headerShown: false }}>
          {(props) => isStylist && isProviderMode
            ? <ProviderAnalyticsScreen {...props} key={resetKeys.Community} />
            : <CommunityScreen {...props} key={resetKeys.Community} />}
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
