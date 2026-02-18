# CastSense Mobile App

Expo-based React Native cross-platform mobile application for the CastSense AI fishing assistant.

## Features

- **Photo & Video Capture**: Capture fishing spots using expo-camera
- **Location Services**: GPS integration via expo-location for weather and location-based analysis
- **Overlay Visualization**: Display cast zones and tactics on captured media
- **Offline-Ready Architecture**: State machine-based flow with robust error handling
- **Auto-detected Backend**: Automatically connects to local backend via LAN IP on physical devices

## Prerequisites

- Node.js >= 18
- npm >= 10
- Xcode (for iOS development on macOS)
- Android Studio (for Android development)
- A physical device OR iOS Simulator/Android Emulator

## Installation

```bash
# Install dependencies
npm install

# Generate native projects (creates ios/ and android/ folders)
npm run prebuild
```

## Development

### Quick Start with Expo Go (Limited Features)

```bash
# Start Expo dev server
npm start

# Scan QR code with Expo Go app on your phone
```

⚠️ **Note**: Expo Go doesn't support custom native modules like `@shopify/react-native-skia`. For full features, use development builds below.

### Development Builds (Recommended)

```bash
# Start dev server
npm start

# In another terminal, build and run on device:
npm run ios -- --device        # iOS (requires macOS + Xcode)
npm run android -- --device    # Android
```

### Simulators/Emulators

```bash
# iOS Simulator (macOS only)
npm run ios

# Android Emulator
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

### Backend Connection

The app automatically detects the correct backend URL:

- **Simulator/Emulator**: Uses `http://localhost:3000`
- **Physical Device**: Auto-detects your computer's LAN IP (e.g., `http://192.168.1.100:3000`)
- **Manual Override**: Set `API_BASE_URL` in a `.env` file

Create a `.env` file in the mobile directory (see `.env.example`):

```bash
# Optional: Override auto-detection
API_BASE_URL=http://192.168.1.100:3000

# Or use a cloud backend
API_BASE_URL=https://api.castsense.app

NODE_ENV=development
```

The app uses `expo-constants` to load environment variables from `app.config.js`.

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

### Expo SDK
- `expo` - Expo framework
- `expo-camera` - Camera capture
- `expo-location` - GPS and location services
- `expo-device` - Device information
- `expo-constants` - Environment configuration
- `expo-localization` - Locale and timezone

### Rendering
- `@shopify/react-native-skia` - Overlay rendering

### Networking
- `axios` - HTTP client

### Utilities
- `react-native-safe-area-context` - Safe area insets

## Types

TypeScript types are generated from the shared JSON schemas in `/contracts`:

```bash
cd ../contracts
npm run generate-types
```

## Backend Setup

The mobile app requires the CastSense backend to be running:

```bash
# From the project root
make up  # Start backend in Docker
```

The backend will be available at `http://localhost:3000` (or your LAN IP for physical devices).

## Troubleshooting

### "Cannot connect to backend"

- Ensure backend is running: `make up` from project root
- Check if your device and computer are on the same WiFi network
- Verify the backend URL in logs: look for "🌐 Network Detection Info"
- Try setting `API_BASE_URL` explicitly in `.env`

### "Camera/Location permission denied"

- The app will prompt for permissions on first use
- If denied, open Settings and manually grant permissions
- iOS: Settings → CastSense → Permissions
- Android: Settings → Apps → CastSense → Permissions

### "Module not found" errors

- Run `npm install` to install dependencies
- Run `npm run prebuild -- --clean` to regenerate native projects
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
