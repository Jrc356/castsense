/**
 * Network Detection Utility
 * 
 * Detects the appropriate backend URL based on device type:
 * - Simulator/Emulator: Use localhost
 * - Physical Device: Auto-detect host machine's LAN IP from Expo dev server
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NetworkInfo {
  isPhysicalDevice: boolean;
  hostIp: string | null;
  recommendedBackendUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Device Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if running on a physical device (not simulator/emulator)
 */
export function isPhysicalDevice(): boolean {
  return Device.isDevice;
}

/**
 * Check if running on a simulator/emulator
 */
export function isSimulator(): boolean {
  return !Device.isDevice;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAN IP Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract host IP from Expo dev server URL
 * Expo provides the dev server URL which contains the host machine's LAN IP
 */
export function getHostIpFromExpo(): string | null {
  try {
    // In development, Expo provides hostUri which contains the LAN IP
    const hostUri = Constants.expoConfig?.hostUri;
    
    if (!hostUri) {
      return null;
    }

    // hostUri is usually in format: "192.168.1.100:8081" or "192.168.1.100"
    const ip = hostUri.split(':')[0];
    
    // Validate it looks like an IP address
    if (isValidIp(ip)) {
      return ip;
    }

    return null;
  } catch (error) {
    console.warn('Failed to extract host IP from Expo:', error);
    return null;
  }
}

/**
 * Validate if a string looks like a valid IPv4 address
 */
function isValidIp(ip: string): boolean {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) {
    return false;
  }

  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend URL Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the recommended backend base URL based on device type
 * 
 * @param defaultPort - Port the backend is running on (default: 3000)
 * @param fallbackUrl - Fallback URL if auto-detection fails
 * @returns Backend base URL (e.g., "http://192.168.1.100:3000")
 */
export function getRecommendedBackendUrl(
  defaultPort: number = 3000,
  fallbackUrl: string = 'http://localhost:3000'
): string {
  // If on simulator, use localhost
  if (isSimulator()) {
    return `http://localhost:${defaultPort}`;
  }

  // If on physical device, try to detect host LAN IP
  const hostIp = getHostIpFromExpo();
  if (hostIp) {
    return `http://${hostIp}:${defaultPort}`;
  }

  // Fallback to provided URL
  console.warn('Could not auto-detect host IP. Using fallback URL:', fallbackUrl);
  return fallbackUrl;
}

/**
 * Get comprehensive network information
 */
export function getNetworkInfo(defaultPort: number = 3000): NetworkInfo {
  const isPhysical = isPhysicalDevice();
  const hostIp = isPhysical ? getHostIpFromExpo() : 'localhost';
  const recommendedBackendUrl = getRecommendedBackendUrl(defaultPort);

  return {
    isPhysicalDevice: isPhysical,
    hostIp,
    recommendedBackendUrl,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Debugging Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log network detection information for debugging
 */
export function logNetworkInfo(defaultPort: number = 3000): void {
  const info = getNetworkInfo(defaultPort);
  
  console.log('🌐 Network Detection Info:');
  console.log('  Device Type:', info.isPhysicalDevice ? 'Physical Device' : 'Simulator/Emulator');
  console.log('  Host IP:', info.hostIp || 'Not detected');
  console.log('  Recommended Backend URL:', info.recommendedBackendUrl);
  console.log('  Expo Config Host:', Constants.expoConfig?.hostUri || 'Not available');
}
