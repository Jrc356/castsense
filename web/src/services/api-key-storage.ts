const STORAGE_KEY = 'openai_api_key'

export async function storeApiKey(apiKey: string): Promise<void> {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Invalid API key: must be a non-empty string')
  }

  const trimmed = apiKey.trim()
  if (trimmed.length === 0) {
    throw new Error('Invalid API key: cannot be empty')
  }

  localStorage.setItem(STORAGE_KEY, trimmed)
}

export async function getApiKey(): Promise<string | null> {
  return localStorage.getItem(STORAGE_KEY)
}

export async function clearApiKey(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY)
}

export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey()
  return key !== null && key.length > 0
}

export function isValidApiKeyFormat(apiKey: string): boolean {
  const trimmed = apiKey?.trim() ?? ''
  return trimmed.length >= 20
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 10) {
    return '**********'
  }
  const prefix = apiKey.substring(0, 7)
  const stars = '*'.repeat(Math.min(apiKey.length - 7, 10))
  return `${prefix}...${stars}`
}
