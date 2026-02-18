# CastSense Mobile App

React Native cross-platform mobile application for the CastSense AI fishing assistant.

## Features

- **Photo & Video Capture**: Capture fishing spots using react-native-vision-camera
- **Location Services**: GPS integration for weather and location-based analysis
- **Overlay Visualization**: Display cast zones and tactics on captured media
- **Offline-Ready Architecture**: State machine-based flow with robust error handling

## Prerequisites

- Node.js >= 18
- React Native CLI
- Xcode (for iOS development)
- Android Studio (for Android development)

## Installation

```bash
# Install dependencies
npm install

# Install iOS pods (macOS only)
cd ios && pod install && cd ..
```

## Development

```bash
# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Project Structure

```
mobile/
├── App.tsx                    # Main app entry point
├── index.js                   # React Native entry
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── babel.config.js            # Babel config
├── metro.config.js            # Metro bundler config
└── src/
    ├── config/
    │   └── api.ts             # API configuration (endpoints, keys)
    ├── state/
    │   ├── machine.ts         # State machine (Idle → Results)
    │   └── AppContext.tsx     # React Context provider
    ├── services/
    │   ├── camera.ts          # Photo/video capture
    │   ├── metadata.ts        # Device & location metadata
    │   ├── api.ts             # API client with retry logic
    │   └── permissions.ts     # Permission handling
    ├── screens/
    │   ├── HomeScreen.tsx     # Mode selection
    │   ├── CaptureScreen.tsx  # Camera interface
    │   ├── ResultsScreen.tsx  # Analysis display
    │   └── ErrorScreen.tsx    # Error handling
    ├── navigation/
    │   └── AppNavigator.tsx   # Navigation setup
    ├── components/
    │   └── index.ts           # Overlay components (placeholder)
    └── types/
        └── contracts.ts       # API contract types (auto-generated)
```

## State Machine

The app follows a state machine pattern:

```
Idle → ModeSelected → Capturing → Uploading → Analyzing → Results
                                       ↓
                                     Error
```

### States

| State | Description |
|-------|-------------|
| `Idle` | Initial state, ready for mode selection |
| `ModeSelected` | User has selected General or Specific mode |
| `Capturing` | Camera is active, capturing photo/video |
| `Uploading` | Media is being uploaded to backend |
| `Analyzing` | Backend is processing the analysis |
| `Results` | Analysis complete, displaying results |
| `Error` | An error occurred, with retry option |

## Configuration

Configure the API endpoint in `src/config/api.ts`:

```typescript
// Development
const devConfig = {
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-dev-api-key',
  // ...
};

// Production
const prodConfig = {
  baseUrl: 'https://api.castsense.app',
  apiKey: 'your-prod-api-key',
  // ...
};
```

## API Integration

The app communicates with the backend via:

- `POST /v1/analyze` - Upload media + metadata, receive analysis
- `GET /v1/health` - Health check

### Request Format

```typescript
// Multipart form data
{
  media: File,           // JPEG photo or MP4 video
  metadata: JSON string  // CastSenseRequestMetadata
}
```

### Metadata Schema

```typescript
interface CastSenseRequestMetadata {
  client: {
    platform: 'ios' | 'android';
    app_version: string;
    device_model?: string;
    locale?: string;
    timezone?: string;
  };
  request: {
    mode: 'general' | 'specific';
    target_species?: string;
    platform_context?: 'shore' | 'kayak' | 'boat';
    gear_type?: 'spinning' | 'baitcasting' | 'fly' | 'unknown';
    capture_type: 'photo' | 'video';
    capture_timestamp_utc: string;
  };
  location?: {
    lat: number;
    lon: number;
    accuracy_m?: number;
    altitude_m?: number;
    heading_deg?: number;
    speed_mps?: number;
  };
  user_constraints?: {
    lures_available?: string[];
    line_test_lb?: number;
    notes?: string;
  };
}
```

## Permissions

The app requests the following permissions:

| Permission | Required | Purpose |
|------------|----------|---------|
| Camera | Yes | Photo/video capture |
| Microphone | Video only | Video recording |
| Location | Recommended | Weather, sunrise/sunset |

## Media Constraints

| Type | Max Size | Max Resolution | Max Duration |
|------|----------|----------------|--------------|
| Photo | 8 MB | 1920px long edge | - |
| Video | 25 MB | 720p | 10 seconds |

## Error Handling

The app handles these error codes with retry logic:

| Code | Retryable | Description |
|------|-----------|-------------|
| `NO_GPS` | No | Location unavailable |
| `NO_NETWORK` | Yes | Network connectivity issue |
| `INVALID_MEDIA` | No | Unsupported media format |
| `AI_TIMEOUT` | Yes | Analysis took too long |
| `ENRICHMENT_FAILED` | Yes | Weather/location lookup failed |
| `RATE_LIMITED` | Yes | Too many requests |

## Dependencies

### Core
- `react-native` - Framework
- `@react-navigation/native` - Navigation
- `@react-navigation/native-stack` - Stack navigator

### Camera & Media
- `react-native-vision-camera` - Camera capture

### Location
- `react-native-geolocation-service` - GPS

### Rendering
- `@shopify/react-native-skia` - Overlay rendering

### Networking
- `axios` - HTTP client

### Utilities
- `react-native-permissions` - Permission handling
- `react-native-safe-area-context` - Safe area insets

## Types

TypeScript types are generated from the shared JSON schemas in `/contracts`:

```bash
cd ../contracts
npm run generate-types
```

## TODO

- [ ] Implement Skia overlay rendering components
- [ ] Add image resizing before upload
- [ ] Implement video file size validation
- [ ] Add offline mode indicators
- [ ] Implement deep linking for shared results
- [ ] Add analytics integration
