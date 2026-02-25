/**
 * Navigation Hooks
 * 
 * Type-safe navigation hooks extracted from AppNavigator
 * to avoid circular dependencies between navigator and screens.
 */

import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {type NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from './types';

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

export function usePreviewRoute() {
  return useRoute<RouteProp<RootStackParamList, 'Preview'>>();
}

export function useResultsRoute() {
  return useRoute<RouteProp<RootStackParamList, 'Results'>>();
}

export function useErrorRoute() {
  return useRoute<RouteProp<RootStackParamList, 'Error'>>();
}
