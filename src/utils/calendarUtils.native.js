import { Alert } from 'react-native';
import * as Calendar from 'expo-calendar';

function buildDates(appointmentDate, appointmentTime, durationMin = 60) {
  const [y, m, d] = appointmentDate.split('-').map(Number);
  const hour = appointmentTime ? parseInt(appointmentTime.split(':')[0], 10) : 9;
  const min  = appointmentTime ? parseInt(appointmentTime.split(':')[1], 10) : 0;
  const startDate = new Date(y, m - 1, d, hour, min, 0);
  const endDate   = new Date(startDate.getTime() + durationMin * 60 * 1000);
  return { startDate, endDate };
}

export async function addToCalendar({ title, appointmentDate, appointmentTime, durationMin = 60, notes = '' }) {
  if (!appointmentDate) return { success: false, error: 'No date provided' };

  const { startDate, endDate } = buildDates(appointmentDate, appointmentTime, durationMin);

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
      alarms: [{ relativeOffset: -60 }],
    });
    return { success: true, eventId };
  } catch (err) {
    Alert.alert('Error', 'Could not add to calendar. Please try again.');
    return { success: false, error: err.message };
  }
}
