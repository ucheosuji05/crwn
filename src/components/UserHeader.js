import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export default function UserHeader() {
  const [avatarUri, setAvatarUri] = useState(null);
  
  const user = {
    name: 'Uche Osuji',
    username: '@uosuji',
    bio: 'Natural hair enthusiast 🌸 | Protective styles lover | Sharing my hair journey ✨',
    followers: 412,
    following: 500
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to change your profile picture.');
      return;
    }

    Alert.alert(
      'Change Profile Picture',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: takePhoto
        },
        {
          text: 'Choose from Library',
          onPress: chooseFromLibrary
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const chooseFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* Gradient Header Background with Safe Area */}
      <LinearGradient
        colors={['#8B4513', '#D2691E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientHeader}
      >
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          {/* Avatar positioned on gradient */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
              {avatarUri ? (
                <Image 
                  source={{ uri: avatarUri }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#9ca3af" />
                </View>
              )}
              {/* Camera icon overlay */}
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Profile Content - White Background */}
      <View style={styles.container}>
        {/* Name and Username */}
        <View style={styles.nameSection}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.username}>{user.username}</Text>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{user.followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{user.following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Share Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Bio Section */}
        {user.bio && (
          <View style={styles.bioSection}>
            <Text style={styles.bioText}>{user.bio}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff'
  },
  gradientHeader: {
    width: '100%'
  },
  safeArea: {
    justifyContent: 'flex-end',
    paddingBottom: 20
  },
  avatarSection: {
    alignItems: 'center'
  },
  avatarContainer: {
    position: 'relative'
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#e5e7eb',
    borderWidth: 4,
    borderColor: '#fff'
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#e5e7eb',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#3b82f6',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff'
  },
  container: {
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    paddingTop: 12
  },
  nameSection: {
    alignItems: 'center',
    marginBottom: 16
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4
  },
  username: {
    fontSize: 15,
    color: '#6b7280'
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    marginBottom: 16
  },
  stat: {
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 18, //should be 18!!!!!
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280'
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center'
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827'
  },
  bioSection: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    textAlign: 'center'
  }
});