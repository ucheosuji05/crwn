import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function PrimaryButton({ title, onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#5D1F1F',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  text: {
    color: '#fff',
    fontWeight: '600'
  }
});
