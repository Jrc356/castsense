import { fetchAvailableModels } from '../services/model-discovery';

// Mock fetch
(globalThis as any).fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Sample response from OpenAI API
const mockApiResponse = {
  object: 'list',
  data: [
    { id: 'gpt-5-turbo', object: 'model', created: 1700000000, owned_by: 'openai' },
    { id: 'gpt-4o', object: 'model', created: 1690000000, owned_by: 'openai' },
    { id: 'gpt-4-turbo', object: 'model', created: 1680000000, owned_by: 'openai' },
    { id: 'text-embedding-3-large', object: 'model', created: 1700100000, owned_by: 'openai' },
  ],
};

describe('model-discovery', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('fetchAvailableModels', () => {
    it('should be a function that accepts apiKey', () => {
      expect(typeof fetchAvailableModels).toBe('function');
    });

    it('should return available models on successful fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const models = await fetchAvailableModels('valid-api-key');

      expect(models).toContain('gpt-5-turbo');
      expect(models).toContain('gpt-4o');
      expect(models).toContain('gpt-4-turbo');
      expect(models).not.toContain('text-embedding-3-large'); // Should filter out embeddings
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error immediately for 401 (invalid API key)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      } as Response);

      await expect(fetchAvailableModels('invalid-key')).rejects.toThrow(
        'Invalid API key - please check your OpenAI API key'
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors and eventually fail', async () => {
      mockFetch.mockRejectedValue(new TypeError('Network error'));

      // Expect the function to retry 3 times and then throw
      await expect(fetchAvailableModels('valid-api-key')).rejects.toThrow(
        'Failed to connect to OpenAI API after multiple attempts'
      );

      // Should have attempted 3 times
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 30000);

    it('should retry on 500 server errors and succeed on third attempt', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'Service Unavailable',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockApiResponse,
        } as Response);

      const models = await fetchAvailableModels('valid-api-key');

      expect(models).toContain('gpt-5-turbo');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 30000);

    it('should retry on rate limiting and fail after max retries', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limited',
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limited',
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limited',
        } as Response);

      await expect(fetchAvailableModels('valid-api-key')).rejects.toThrow(
        'Failed to connect to OpenAI API after multiple attempts'
      );

      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 30000);

    it('should sort models by priority (newest/best first)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            { id: 'gpt-3.5-turbo', object: 'model', created: 1600000000, owned_by: 'openai' },
            { id: 'gpt-5-turbo', object: 'model', created: 1700000000, owned_by: 'openai' },
            { id: 'gpt-4-turbo', object: 'model', created: 1680000000, owned_by: 'openai' },
            { id: 'gpt-4o', object: 'model', created: 1690000000, owned_by: 'openai' },
          ],
        }),
      } as Response);

      const models = await fetchAvailableModels('valid-api-key');

      // Should be sorted: GPT-5, GPT-4o, GPT-4-turbo, GPT-3.5-turbo
      expect(models[0]).toBe('gpt-5-turbo');
      expect(models[1]).toBe('gpt-4o');
      // GPT-4-turbo should come before GPT-3.5-turbo
      const gpt4Index = models.indexOf('gpt-4-turbo');
      const gpt35Index = models.indexOf('gpt-3.5-turbo');
      expect(gpt4Index).toBeGreaterThan(-1);
      expect(gpt35Index).toBeGreaterThan(-1);
      expect(gpt4Index).toBeLessThan(gpt35Index);
    });
  });
});
