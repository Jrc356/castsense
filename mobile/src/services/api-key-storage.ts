/**
 * API Key Storage Service
 * 
 * Manages secure storage of user's OpenAI API key using expo-secure-store.
 * Keys are encrypted at rest on the device.
 * 
 * Security Note: While expo-secure-store encrypts data at rest, keys may be
 * accessible via device jailbreak/root or memory inspection. This is acceptable
 * for BYO-API-key model since users control their own keys.
 */

import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'openai_api_key';

/**
 * Store user's OpenAI API key securely
 */
export async function storeApiKey(apiKey: string): Promise<void> {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Invalid API key: must be a non-empty string');
  }

  const trimmed = apiKey.trim();
  if (trimmed.length === 0) {
    throw new Error('Invalid API key: cannot be empty');
  }

  try {
    await SecureStore.setItemAsync(STORAGE_KEY, trimmed);
  } catch (error) {
    throw new Error(
      `Failed to store API key: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Retrieve user's OpenAI API key
 * @returns API key or null if not set
 */
export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to retrieve API key:', error);
    return null;
  }
}

/**
 * Clear stored API key
 */
export async function clearApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch (error) {
    // Silently fail if key doesn't exist
    console.warn('Failed to clear API key:', error);
  }
}

/**
 * Check if API key is configured
 */
export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return key !== null && key.length > 0;
}

/**
 * Validate API key format (basic check)
 * OpenAI keys typically start with "sk-" and are 48+ characters
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  const trimmed = apiKey?.trim() || '';
  // Basic validation: non-empty, reasonable length
  // Don't enforce "sk-" prefix as format may change
  return trimmed.length >= 20;
}

/**
 * Mask API key for display (show first 7 chars, rest as dots)
 * e.g., "sk-proj...••••••••"
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 10) {
    return '••••••••••';
  }
  const prefix = apiKey.substring(0, 7);
  const dots = '•'.repeat(Math.min(apiKey.length - 7, 10));
  return `${prefix}...${dots}`;
}
