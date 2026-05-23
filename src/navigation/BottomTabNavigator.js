import { useState, useRef, useCallback } from 'react';
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
import NotificationsScreen from '../screens/NotificationsScreen';
import MessagingScreen from '../screens/MessagingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsList from '../components/NotificationsList';
import { useUnreadCount } from '../context/UnreadCountContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useProviderMode } from '../context/ProviderModeContext';

const Tab = createBottomTabNavigator();

const DOUBLE_TAP_MS = 400;
const SIDEBAR_WIDTH = 210;
const PANEL_WIDTH = 380;

// ── Notification icon with badge ──────────────────────────────────────────────

function NotifIcon({ focused, color, size, unreadCount, primaryColor }) {
  return (
    <View>
      <Ionicons
        name={focused ? 'notifications' : 'notifications-outline'}
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

function WebSidebar({ state, navigation, colors, unreadCount, lastTap, setResetKeys, notifOpen, onNotifToggle }) {
  const NAV_ITEMS = [
    { name: 'Crwn.',         label: 'Explore',       icon: 'compass',       iconOff: 'compass-outline' },
    { name: 'Community',     label: 'Community',     icon: 'globe',         iconOff: 'globe-outline' },
    { name: 'Stylists',      label: 'Stylists',      icon: 'cut',           iconOff: 'cut-outline' },
    { name: 'Notifications', label: 'Notifications', icon: 'notifications', iconOff: 'notifications-outline' },
    { name: 'Profile',       label: 'Profile',       icon: 'person',        iconOff: 'person-outline' },
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
        const focused = isNotif ? notifOpen : (state.index === index && !notifOpen);
        const color = focused ? colors.selected : colors.textMuted;
        const item = NAV_ITEMS.find((n) => n.name === route.name);
        if (!item) return null;

        const onPress = () => {
          if (isNotif) {
            onNotifToggle();
            return;
          }
          // Close notif panel if open when switching tabs
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
                <NotifIcon focused={focused} color={color} size={22} unreadCount={unreadCount} primaryColor={colors.primary} />
              ) : (
                <Ionicons name={focused ? item.icon : item.iconOff} size={22} color={color} />
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
            <Text style={[panel.title, { color: colors.text }]}>Notifications</Text>
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

// ── Main navigator ─────────────────────────────────────────────────────────────

export default function BottomTabNavigator() {
  const { notifCount: unreadNotifCount } = useUnreadCount();
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

  const openNotif = useCallback(() => {
    setNotifOpen(true);
    Animated.spring(slideAnim, {
      toValue: PANEL_WIDTH,
      useNativeDriver: false,
      tension: 120,
      friction: 22,
    }).start();
  }, [slideAnim]);

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
    <>
      <Tab.Navigator
        screenListeners={isWeb ? undefined : screenListeners}
        tabBar={isWeb ? (props) => (
          <WebSidebar
            {...props}
            colors={colors}
            unreadCount={unreadNotifCount}
            lastTap={lastTap}
            setResetKeys={setResetKeys}
            notifOpen={notifOpen}
            onNotifToggle={toggleNotif}
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
              let iconName;
              switch (route.name) {
                case 'Crwn.':         iconName = focused ? 'compass'     : 'compass-outline';     break;
                case 'Community':     iconName = focused ? 'stats-chart' : 'stats-chart-outline'; break;
                case 'Stylists':      iconName = focused ? 'calendar'    : 'calendar-outline';    break;
                case 'Notifications': iconName = focused ? 'chatbubble'  : 'chatbubble-outline';  break;
                case 'Profile':       iconName = focused ? 'person'      : 'person-outline';      break;
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
                  unreadCount={unreadNotifCount}
                  primaryColor={colors.primary}
                />
              );
            }
            let iconName;
            switch (route.name) {
              case 'Crwn.':     iconName = focused ? 'compass' : 'compass-outline'; break;
              case 'Community': iconName = focused ? 'globe'   : 'globe-outline';   break;
              case 'Stylists':  iconName = focused ? 'cut'     : 'cut-outline';     break;
              case 'Profile':   iconName = focused ? 'person'  : 'person-outline';  break;
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
            ? <MessagingScreen {...props} key={resetKeys.Notifications} />
            : <NotificationsScreen {...props} key={resetKeys.Notifications} />}
        </Tab.Screen>

        <Tab.Screen name="Profile" options={{ headerShown: false }}>
          {(props) => <ProfileScreen {...props} key={resetKeys.Profile} />}
        </Tab.Screen>
      </Tab.Navigator>

      {/* Web-only: sliding notifications panel */}
      {isWeb && (
        <NotifPanel
          open={notifOpen}
          onClose={closeNotif}
          slideAnim={slideAnim}
          colors={colors}
        />
      )}
    </>
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
