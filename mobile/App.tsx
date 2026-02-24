/**
 * CastSense - AI Fishing Assistant
 * Main Application Entry Point
 */

import React from 'react';
import {StatusBar, useColorScheme, LogBox} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

// Suppress deprecation warning for expo-image-picker MediaTypeOptions
// This API is deprecated but still functional in v17.0.10
// Can be removed after upgrading to expo-image-picker v55+
LogBox.ignoreLogs([
  'ImagePicker.MediaTypeOptions.*have been deprecated',
  '[expo-image-picker]',
]);

import {AppNavigator} from './src/navigation/AppNavigator';
import {AppProvider} from './src/state/AppContext';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer>
          <StatusBar
            barStyle={isDarkMode ? 'light-content' : 'dark-content'}
            backgroundColor={isDarkMode ? '#1a1a1a' : '#ffffff'}
          />
          <AppNavigator />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}

export default App;
