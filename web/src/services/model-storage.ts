const MODEL_KEY = 'castsense.selectedModel'
const DEFAULT_MODEL = 'gpt-4o'

export async function saveSelectedModel(model: string): Promise<void> {
  localStorage.setItem(MODEL_KEY, model)
}

export async function loadSelectedModel(): Promise<string | null> {
  return localStorage.getItem(MODEL_KEY)
}

export function getDefaultModel(): string {
  return DEFAULT_MODEL
}

export async function clearSelectedModel(): Promise<void> {
  localStorage.removeItem(MODEL_KEY)
}
