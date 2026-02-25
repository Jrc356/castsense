module.exports = {
  expo: {
    name: 'CastSense',
    slug: 'castsense',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    jsEngine: 'jsc',
    splash: {
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.castsense.app',
      infoPlist: {
        NSCameraUsageDescription:
          'CastSense needs access to your camera to capture photos and videos for tactical analysis.',
        NSMicrophoneUsageDescription:
          'CastSense needs access to your microphone to record audio with videos.',
        NSLocationWhenInUseUsageDescription:
          'CastSense needs your location to provide accurate environmental context for tactical analysis.',
        NSPhotoLibraryUsageDescription:
          'CastSense needs access to your photo library to analyze existing photos and videos.',
      },
    },
    android: {
      package: 'com.castsense.app',
      adaptiveIcon: {
        backgroundColor: '#ffffff',
      },
      permissions: [
        'CAMERA',
        'RECORD_AUDIO',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'READ_MEDIA_IMAGES',
        'READ_MEDIA_VIDEO',
      ],
    },
    platforms: ['ios', 'android'],
    extra: {
      // Support both API_BASE_URL and EXPO_PUBLIC_API_URL for flexibility
      // EXPO_PUBLIC_API_URL is preferred for Expo development
      apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || process.env.API_BASE_URL || null,
      environment: process.env.NODE_ENV || 'development',
    },
  },
};
