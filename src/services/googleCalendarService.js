import * as WebBrowser from 'expo-web-browser';
import { AUTH_URL } from '../lib/auth-url';
import { getAuthToken } from '../lib/auth-client';

function authFetch(path, options = {}) {
  const token = getAuthToken();
  return fetch(`${AUTH_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

export const googleCalendarService = {
  async connect() {
    try {
      const res = await authFetch('/api/calendar/google/auth-url');
      if (!res.ok) return { success: false, error: 'Could not get auth URL' };
      const { url } = await res.json();

      const result = await WebBrowser.openAuthSessionAsync(url, 'crwn://calendar-callback');
      if (result.type !== 'success') return { success: false, error: 'cancelled' };

      const params = new URL(result.url).searchParams;
      if (params.get('success') === 'true') return { success: true };
      return { success: false, error: params.get('error') || 'unknown' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async getStatus() {
    try {
      const res = await authFetch('/api/calendar/google/status');
      if (!res.ok) return { connected: false };
      return await res.json();
    } catch {
      return { connected: false };
    }
  },

  async disconnect() {
    try {
      const res = await authFetch('/api/calendar/google/disconnect', { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  },

  async createBookingEvent(booking) {
    try {
      const {
        id: bookingId,
        appointment_date,
        appointment_time,
        service_name,
        notes,
        duration_min = 60,
        client,
      } = booking;

      if (!appointment_date) return { success: false, error: 'No date' };

      const clientName = client?.full_name || client?.username || '';
      const dateStr = appointment_date.split('T')[0];
      const timeStr = appointment_time || '09:00';
      const startDateTime = new Date(`${dateStr}T${timeStr}:00`).toISOString();
      const endMs = new Date(startDateTime).getTime() + duration_min * 60 * 1000;
      const endDateTime = new Date(endMs).toISOString();

      const title = [service_name, clientName].filter(Boolean).join(' — ') || 'Appointment';
      const description = [clientName && `Client: ${clientName}`, notes].filter(Boolean).join('\n');

      const res = await authFetch('/api/calendar/google/create-event', {
        method: 'POST',
        body: JSON.stringify({
          bookingId,
          title,
          startDateTime,
          endDateTime,
          description,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { success: false, error: body.message || 'Calendar error' };
      }
      const data = await res.json();
      return { success: true, eventId: data.eventId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
