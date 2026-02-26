import * as SecureStore from 'expo-secure-store';
import {
  saveSelectedModel,
  loadSelectedModel,
  getDefaultModel,
  clearSelectedModel,
} from '../services/model-storage';

jest.mock('expo-secure-store');

describe('model-storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDefaultModel', () => {
    it('should return gpt-4o as default model', () => {
      const defaultModel = getDefaultModel();
      expect(defaultModel).toBe('gpt-4o');
    });
  });

  describe('saveSelectedModel', () => {
    it('should save model to SecureStore', async () => {
      const testModel = 'gpt-4-turbo';
      await saveSelectedModel(testModel);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'selected_ai_model',
        testModel
      );
    });

    it('should throw error if SecureStore fails', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Storage error')
      );

      await expect(saveSelectedModel('gpt-4o')).rejects.toThrow('Storage error');
    });
  });

  describe('loadSelectedModel', () => {
    it('should load model from SecureStore', async () => {
      const testModel = 'gpt-4o-mini';
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(testModel);

      const result = await loadSelectedModel();

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('selected_ai_model');
      expect(result).toBe(testModel);
    });

    it('should return null if no model is saved', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

      const result = await loadSelectedModel();

      expect(result).toBeNull();
    });

    it('should return null on SecureStore error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Storage error')
      );

      const result = await loadSelectedModel();

      expect(result).toBeNull();
    });
  });

  describe('clearSelectedModel', () => {
    it('should remove model from SecureStore', async () => {
      await clearSelectedModel();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('selected_ai_model');
    });

    it('should throw error if SecureStore fails', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Storage error')
      );

      await expect(clearSelectedModel()).rejects.toThrow('Storage error');
    });
  });
});
