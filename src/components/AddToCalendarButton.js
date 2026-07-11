import { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { addToCalendar } from '../utils/calendarUtils';

export default function AddToCalendarButton({
  title,
  appointmentDate,
  appointmentTime,
  durationMin = 60,
  notes = '',
  style,
}) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [added,   setAdded]   = useState(false);

  const handlePress = async () => {
    if (loading || added) return;
    setLoading(true);
    const { success } = await addToCalendar({ title, appointmentDate, appointmentTime, durationMin, notes });
    setLoading(false);
    if (success) setAdded(true);
  };

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { borderColor: added ? colors.primary : colors.border },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.75}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons
          name={added ? 'checkmark-circle' : 'calendar-outline'}
          size={18}
          color={added ? colors.primary : colors.textSecondary}
        />
      )}
      <Text style={[styles.text, { color: added ? colors.primary : colors.text }]}>
        {added ? 'Added to Calendar' : 'Add to Calendar'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  text: {
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
  },
});
