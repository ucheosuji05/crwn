import { Platform, Alert } from 'react-native';

// expo-calendar is native-only; guard the import so web bundle doesn't break
let Calendar = null;
if (Platform.OS !== 'web') {
  Calendar = require('expo-calendar');
}

function buildDates(appointmentDate, appointmentTime, durationMin = 60) {
  const [y, m, d] = appointmentDate.split('-').map(Number);
  const hour = appointmentTime ? parseInt(appointmentTime.split(':')[0], 10) : 9;
  const min  = appointmentTime ? parseInt(appointmentTime.split(':')[1], 10) : 0;
  const startDate = new Date(y, m - 1, d, hour, min, 0);
  const endDate   = new Date(startDate.getTime() + durationMin * 60 * 1000);
  return { startDate, endDate };
}

function googleCalendarUrl(title, startDate, endDate, details) {
  // Format: YYYYMMDDTHHmmssZ
  const fmt = (d) => d.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(startDate)}/${fmt(endDate)}`,
    details: details || '',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export async function addToCalendar({ title, appointmentDate, appointmentTime, durationMin = 60, notes = '' }) {
  if (!appointmentDate) return { success: false, error: 'No date provided' };

  const { startDate, endDate } = buildDates(appointmentDate, appointmentTime, durationMin);

  // Web: open Google Calendar in a new tab
  if (Platform.OS === 'web') {
    window.open(googleCalendarUrl(title, startDate, endDate, notes), '_blank', 'noopener,noreferrer');
    return { success: true };
  }

  // Native: request permission then create event
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Calendar access needed',
      'Please allow calendar access in Settings to save this appointment.',
    );
    return { success: false, error: 'permission_denied' };
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const target =
    calendars.find(c => c.allowsModifications && c.isPrimary) ??
    calendars.find(c => c.allowsModifications && c.source?.type === 'com.google') ??
    calendars.find(c => c.allowsModifications);

  if (!target) {
    Alert.alert('No calendar found', 'Could not find a writable calendar on this device.');
    return { success: false, error: 'no_calendar' };
  }

  try {
    const eventId = await Calendar.createEventAsync(target.id, {
      title,
      startDate,
      endDate,
      notes,
      alarms: [{ relativeOffset: -60 }], // reminder 1 hour before
    });
    return { success: true, eventId };
  } catch (err) {
    Alert.alert('Error', 'Could not add to calendar. Please try again.');
    return { success: false, error: err.message };
  }
}
