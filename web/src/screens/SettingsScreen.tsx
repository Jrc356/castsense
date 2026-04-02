import { useCallback, useEffect, useState } from 'react'
import {
  clearApiKey,
  getApiKey,
  hasApiKey,
  isValidApiKeyFormat,
  maskApiKey,
  storeApiKey,
} from '../services/api-key-storage'

export function SettingsScreen(): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [configured, setConfigured] = useState(false)
  const [masked, setMasked] = useState('')

  const loadStatus = useCallback(async () => {
    const ready = await hasApiKey()
    setConfigured(ready)
    if (!ready) {
      setMasked('')
      return
    }
    const value = await getApiKey()
    setMasked(value ? maskApiKey(value) : '')
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function save() {
    if (!isValidApiKeyFormat(apiKey)) {
      window.alert('API key format looks invalid.')
      return
    }
    await storeApiKey(apiKey)
    setApiKey('')
    await loadStatus()
  }

  async function clear() {
    if (!window.confirm('Remove saved API key?')) {
      return
    }
    await clearApiKey()
    await loadStatus()
  }

  return (
    <main className="screen">
      <section className="panel hero-panel">
        <h2>API Key Settings</h2>
        <p>CastSense uses your own OpenAI API key in parity mode during migration.</p>
      </section>

      <section className="panel">
        <p><strong>Status:</strong> {configured ? 'Configured' : 'Not configured'}</p>
        {configured ? <p><strong>Saved key:</strong> {masked}</p> : null}
      </section>

      <section className="panel form-grid">
        <label className="wide">
          OpenAI API key
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-..."
            type="password"
          />
        </label>
      </section>

      <section className="action-row">
        <button className="secondary" type="button" onClick={clear}>
          Clear Key
        </button>
        <button type="button" onClick={() => void save()}>
          Save Key
        </button>
      </section>

    </main>
  )
}
