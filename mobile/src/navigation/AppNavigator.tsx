/**
 * CastSense App Navigator
 * 
 * Main navigation structure using @react-navigation/native-stack
 * Screens:
 * - HomeScreen: Mode selection (General/Specific)
 * - CaptureScreen: Photo/video capture
 * - ResultsScreen: Overlay display + tactics
 * - ErrorScreen: Error display with retry
 */

import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {HomeScreen} from '../screens/HomeScreen';
import {CaptureScreen} from '../screens/CaptureScreen';
import {ResultsScreen} from '../screens/ResultsScreen';
import {ErrorScreen} from '../screens/ErrorScreen';
import type {RootStackParamList} from './types';

// Re-export types and hooks for convenience
export type {RootStackParamList} from './types';
export {useAppNavigation, useCaptureRoute, useResultsRoute, useErrorRoute, type NavigationProp} from './hooks';

// ─────────────────────────────────────────────────────────────────────────────
// Navigator
// ─────────────────────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
        headerTintColor: '#007AFF',
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 17,
        },
        contentStyle: {
          backgroundColor: '#f2f2f7',
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'CastSense',
          headerLargeTitle: true,
        }}
      />
      
      <Stack.Screen
        name="Capture"
        component={CaptureScreen}
        options={{
          title: 'Capture',
          headerShown: false, // Full-screen camera
          animation: 'fade',
        }}
      />
      
      <Stack.Screen
        name="Results"
        component={ResultsScreen}
        options={{
          title: 'Analysis',
          headerBackTitle: 'Back',
        }}
      />
      
      <Stack.Screen
        name="Error"
        component={ErrorScreen}
        options={{
          title: 'Error',
          headerBackVisible: true,
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
}
