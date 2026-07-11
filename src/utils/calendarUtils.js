// Web fallback — Metro picks calendarUtils.native.js on iOS/Android instead

function buildDates(appointmentDate, appointmentTime, durationMin = 60) {
  const [y, m, d] = appointmentDate.split('-').map(Number);
  const hour = appointmentTime ? parseInt(appointmentTime.split(':')[0], 10) : 9;
  const min  = appointmentTime ? parseInt(appointmentTime.split(':')[1], 10) : 0;
  const startDate = new Date(y, m - 1, d, hour, min, 0);
  const endDate   = new Date(startDate.getTime() + durationMin * 60 * 1000);
  return { startDate, endDate };
}

function googleCalendarUrl(title, startDate, endDate, details) {
  const fmt = (dt) => dt.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
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
  window.open(googleCalendarUrl(title, startDate, endDate, notes), '_blank', 'noopener,noreferrer');
  return { success: true };
}
