import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { bookingService } from '../services/bookingService';

// Layout mirrors OnboardingScreen.js's "Your services & pricing" step
// (renderStylistBooking): big serif question title, bordered input rows,
// full-width CTA button — adapted to the app's theme tokens since this
// screen is reached outside the onboarding wizard.
export default function AddServiceScreen({ route, navigation }) {
  const { stylistId } = route.params || {};
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && price.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const { error } = await bookingService.addService(stylistId, {
      name: name.trim(),
      price: parseFloat(price) || 0,
      description: description.trim() || null,
      duration_min: duration ? parseInt(duration, 10) : null,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', 'Could not add this service. Please try again.');
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Service</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.questionTitle}>Add a new service</Text>
          <Text style={styles.questionSubtitle}>Let clients know what you offer and what it costs.</Text>

          <Text style={styles.fieldLabel}>Service Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Small knotless braids"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={styles.fieldLabel}>Price</Text>
          <View style={styles.priceWrap}>
            <Text style={styles.priceDollar}>$</Text>
            <TextInput
              style={styles.priceInput}
              value={price}
              onChangeText={t => setPrice(t.replace(/[^0-9.]/g, ''))}
              placeholder="250"
              placeholderTextColor={colors.placeholder}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.fieldLabel}>Duration (minutes)</Text>
          <TextInput
            style={styles.input}
            value={duration}
            onChangeText={t => setDuration(t.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 180"
            placeholderTextColor={colors.placeholder}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's included, what to expect..."
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, canSave && styles.saveBtnActive]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Add Service</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Figtree_700Bold', color: c.text },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  questionTitle: { fontSize: 24, fontFamily: 'LibreBaskerville_700Bold', color: c.text, marginBottom: 10 },
  questionSubtitle: { fontSize: 14, fontFamily: 'Figtree_400Regular', color: c.textSecondary, marginBottom: 24, lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: c.textSecondary, marginBottom: 8, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 14,
    fontSize: 14, color: c.text, fontFamily: 'Figtree_400Regular',
    marginBottom: 16,
  },
  textArea: { minHeight: 90 },
  priceWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: c.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    marginBottom: 16,
  },
  priceDollar: { fontSize: 14, color: c.textSecondary, marginRight: 4, fontFamily: 'Figtree_500Medium' },
  priceInput: { flex: 1, fontSize: 14, color: c.text, fontFamily: 'Figtree_400Regular', padding: 0 },
  footer: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 },
  saveBtn: { backgroundColor: c.borderLight, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnActive: { backgroundColor: c.primary },
  saveBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
});
