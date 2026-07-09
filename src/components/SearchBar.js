import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function SearchBar({
  value = '',
  onChangeText,
  onSubmitEditing,
  placeholder = 'Search for hair salons, inspos, etc.',
  autoFocus = false,
  containerStyle,
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, containerStyle]}>
      <Ionicons name="search" size={20} color={colors.textMuted} style={styles.icon} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
        clearButtonMode="never"
        autoFocus={autoFocus}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText?.('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(232, 226, 217, 0.4)',
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16 },
});
