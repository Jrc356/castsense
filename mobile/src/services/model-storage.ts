import * as SecureStore from 'expo-secure-store';

const MODEL_STORAGE_KEY = 'selected_ai_model';
const DEFAULT_MODEL = 'gpt-4o';

/**
 * Save the selected AI model to device storage
 */
export async function saveSelectedModel(model: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(MODEL_STORAGE_KEY, model);
  } catch (error) {
    console.error('Failed to save selected model:', error);
    throw error;
  }
}

/**
 * Load the selected AI model from device storage
 * Returns null if no model has been saved yet
 */
export async function loadSelectedModel(): Promise<string | null> {
  try {
    const model = await SecureStore.getItemAsync(MODEL_STORAGE_KEY);
    return model;
  } catch (error) {
    console.error('Failed to load selected model:', error);
    return null;
  }
}

/**
 * Get the default fallback model
 */
export function getDefaultModel(): string {
  return DEFAULT_MODEL;
}

/**
 * Clear the saved model selection
 */
export async function clearSelectedModel(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(MODEL_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear selected model:', error);
    throw error;
  }
}
