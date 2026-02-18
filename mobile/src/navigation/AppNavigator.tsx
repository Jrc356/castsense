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
import {type CaptureType, type AnalysisResult, type AppError} from '../state/machine';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Types
// ─────────────────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Home: undefined;
  Capture: {
    captureType: CaptureType;
  };
  Results: {
    result: AnalysisResult;
    mediaUri: string;
  };
  Error: {
    error: AppError;
    canRetry: boolean;
  };
};

// Type helper for screens
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Helpers
// ─────────────────────────────────────────────────────────────────────────────

import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {type NativeStackNavigationProp} from '@react-navigation/native-stack';

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Typed navigation hook
 */
export function useAppNavigation() {
  return useNavigation<NavigationProp>();
}

/**
 * Typed route hook for specific screens
 */
export function useCaptureRoute() {
  return useRoute<RouteProp<RootStackParamList, 'Capture'>>();
}

export function useResultsRoute() {
  return useRoute<RouteProp<RootStackParamList, 'Results'>>();
}

export function useErrorRoute() {
  return useRoute<RouteProp<RootStackParamList, 'Error'>>();
}
