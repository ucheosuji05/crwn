import React from 'react';
import { Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { CardStyleInterpolators } from '@react-navigation/stack';
import BottomTabNavigator from './BottomTabNavigator';
import ProfileScreen from '../screens/ProfileScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import MessagingScreen from '../screens/MessagingScreen';
import StylistProfileScreen from '../screens/StylistProfileScreen';
import PostDetailScreen from '../screens/PostDetailScreen';

const Stack = createStackNavigator();

const isWeb = Platform.OS === 'web';

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen
        name="UserProfile"
        component={ProfileScreen}
        options={{
          gestureEnabled: !isWeb,
          gestureDirection: 'horizontal',
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{ presentation: 'modal', gestureEnabled: !isWeb, gestureDirection: 'vertical' }}
      />
      <Stack.Screen
        name="StylistProfile"
        component={StylistProfileScreen}
        options={{
          gestureEnabled: !isWeb,
          gestureDirection: 'horizontal',
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="Messaging"
        component={MessagingScreen}
        options={{
          presentation: 'card',
          gestureEnabled: !isWeb,
          gestureDirection: 'horizontal',
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{
          gestureEnabled: !isWeb,
          gestureDirection: 'horizontal',
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
    </Stack.Navigator>
  );
}
