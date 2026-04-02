import { useCallback, useEffect, useState } from 'react'
import {
  clearApiKey,
  getApiKey,
  hasApiKey,
  isValidApiKeyFormat,
  maskApiKey,
  storeApiKey,
} from '../services/api-key-storage'

interface SettingsScreenProps {
  onBack: () => void
}

export function SettingsScreen({ onBack }: SettingsScreenProps): React.JSX.Element {
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
        <p>CastSense uses your own OpenAI API key.</p>
      </section>

      <section className="panel privacy-notice">
        <p className="privacy-notice-heading">&#128274; Your key never leaves this device</p>
        <p>The API key is saved only in your browser&rsquo;s local storage. It is sent directly from your browser to OpenAI and is never transmitted to or stored on any CastSense server.</p>
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
        <button className="ghost" type="button" onClick={onBack}>
          Back
        </button>
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
