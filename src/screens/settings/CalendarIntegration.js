import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { googleCalendarService } from '../../services/googleCalendarService';

export default function CalendarIntegration({ onBack }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [status, setStatus] = useState({ connected: false });

  useEffect(() => {
    googleCalendarService.getStatus().then(s => {
      setStatus(s);
      setLoading(false);
    });
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    const result = await googleCalendarService.connect();
    setConnecting(false);
    if (result.success) {
      const s = await googleCalendarService.getStatus();
      setStatus(s);
    } else if (result.error !== 'cancelled') {
      Alert.alert('Connection failed', 'Could not connect Google Calendar. Please try again.');
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Google Calendar',
      'New bookings will no longer be added to your Google Calendar automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(true);
            await googleCalendarService.disconnect();
            setStatus({ connected: false });
            setDisconnecting(false);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.fullContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Calendar Integration</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendar Integration</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="calendar" size={48} color={colors.primary} />
        </View>
        <Text style={styles.title}>Google Calendar</Text>
        <Text style={styles.subtitle}>
          When you accept a booking, it automatically appears in your Google Calendar — no extra steps.
        </Text>

        {status.connected ? (
          <>
            <View style={styles.connectedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
            {status.connectedAt && (
              <Text style={styles.connectedSince}>
                Since {new Date(status.connectedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            )}
            <TouchableOpacity
              style={styles.disconnectBtn}
              onPress={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting
                ? <ActivityIndicator size="small" color="#ef4444" />
                : <Text style={styles.disconnectText}>Disconnect</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.connectBtn}
            onPress={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color="#fff" />
                <Text style={styles.connectText}>Connect Google Calendar</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.bullets}>
          {[
            'New confirmed bookings appear automatically',
            'Cancellations and reschedules stay in sync',
            'Works with any Google account',
          ].map((line, i) => (
            <View key={i} style={styles.bulletRow}>
              <Ionicons name="checkmark" size={14} color={colors.primary} />
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  fullContainer: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
    backgroundColor: c.background,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Figtree_600SemiBold', color: c.text },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, alignItems: 'center', padding: 32 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: c.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 16,
  },
  title: { fontSize: 22, fontFamily: 'Figtree_700Bold', color: c.text, marginBottom: 12 },
  subtitle: {
    fontSize: 15,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 8,
  },
  connectedText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#16a34a' },
  connectedSince: { fontSize: 13, color: c.textSecondary, marginBottom: 24 },
  disconnectBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 8,
    marginBottom: 32,
  },
  disconnectText: { fontSize: 15, color: '#ef4444', fontFamily: 'Figtree_500Medium' },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginBottom: 32,
  },
  connectText: { fontSize: 16, color: '#fff', fontFamily: 'Figtree_600SemiBold' },
  bullets: { alignSelf: 'stretch', gap: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletText: { flex: 1, fontSize: 14, color: c.textSecondary, lineHeight: 20 },
});
