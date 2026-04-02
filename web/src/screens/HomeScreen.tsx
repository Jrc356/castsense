import { useEffect, useRef, useState } from 'react'
import { runAnalysis } from '../services/analysis-orchestrator'
import { getApiKey } from '../services/api-key-storage'
import { fetchAvailableModels } from '../services/model-discovery'
import { getCurrentLocation } from '../services/metadata'
import { createSessionId } from '../services/langchain-memory'
import { useApp } from '../state/AppContext'

interface HomeScreenProps {
  onOpenSettings: () => void
}

export function HomeScreen({ onOpenSettings }: HomeScreenProps): React.JSX.Element {
  const {
    state,
    canStartAnalysis,
    selectMode,
    setPlatformContext,
    setGearType,
    setUserConstraints,
    setAvailableModels,
    selectModel,
    startCapture,
    startAnalysis,
    startProcessing,
    startEnrichment,
    startAIAnalysis,
    updateProcessingProgress,
    updateEnrichmentProgress,
    updateAIProgress,
    receiveResults,
    handleError,
  } = useApp()

  const [mode, setMode] = useState<'general' | 'specific'>(state.mode ?? 'general')
  const [targetSpecies, setTargetSpecies] = useState(state.targetSpecies ?? '')
  const [platform, setPlatform] = useState<'shore' | 'kayak' | 'boat' | ''>((state.platformContext as 'shore' | 'kayak' | 'boat' | null) ?? '')
  const [gear, setGear] = useState<'spinning' | 'baitcasting' | 'fly' | 'unknown'>(state.gearType)
  const [notes, setNotes] = useState(state.userConstraints.notes ?? '')
  const [locationMode, setLocationMode] = useState<'device' | 'manual'>('device')
  const [manualLat, setManualLat] = useState('')
  const [manualLon, setManualLon] = useState('')
  const [busy, setBusy] = useState(false)
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const selectedModelRef = useRef(state.selectedModel)
  selectedModelRef.current = state.selectedModel

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const apiKey = await getApiKey()
      if (!cancelled) setApiKeyConfigured(!!apiKey)
      if (!apiKey || cancelled) return
      try {
        const models = await fetchAvailableModels(apiKey)
        if (cancelled) return
        setAvailableModels(models)
        if (!selectedModelRef.current && models[0]) {
          selectModel(models[0])
        }
      } catch (error) {
        console.warn('Failed to load models', error)
      }
    })()
    return () => { cancelled = true }
  }, [selectModel, setAvailableModels])

  function openCapture() {
    setValidationError(null)
    if (mode === 'specific' && !targetSpecies.trim()) {
      setValidationError('Enter a target species for Specific mode before capture.')
      return
    }

    selectMode(mode, mode === 'specific' ? targetSpecies.trim() : undefined)
    setPlatformContext(platform || null)
    setGearType(gear)
    setUserConstraints({ notes: notes.trim() || undefined })
    startCapture()
  }

  async function analyzeNow() {
    setValidationError(null)
    if (!state.captureResult) {
      setValidationError('Capture or upload a photo first.')
      return
    }

    const apiKey = await getApiKey()
    if (!apiKey) {
      onOpenSettings()
      return
    }

    let location: { lat: number; lon: number } | undefined
    if (locationMode === 'manual') {
      const lat = parseFloat(manualLat)
      const lon = parseFloat(manualLon)
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        setValidationError('Enter valid coordinates. Latitude must be -90 to 90, longitude -180 to 180.')
        return
      }
      location = { lat, lon }
    } else {
      const gpsResult = await getCurrentLocation()
      if (!gpsResult) {
        setValidationError('Location unavailable — proceeding without GPS context. Results may be less precise.')
        location = undefined
      } else {
        location = gpsResult
      }
    }

    try {
      setBusy(true)
      startAnalysis()
      startProcessing()

      const result = await runAnalysis({
        photoUri: state.captureResult.uri,
        location,
        options: {
          mode,
          targetSpecies: mode === 'specific' ? targetSpecies.trim() : undefined,
          platform: platform || undefined,
          gearType: gear,
        },
        model: state.selectedModel || 'gpt-5.4',
        apiKey,
        onProgress: (progress) => {
          if (progress.stage === 'processing') {
            startProcessing()
            updateProcessingProgress(progress.progress)
          } else if (progress.stage === 'enriching') {
            startEnrichment()
            updateEnrichmentProgress(progress.progress)
          } else if (progress.stage === 'analyzing') {
            startAIAnalysis()
            updateAIProgress(progress.progress)
          }
        },
      })

      if (!result.success || !result.data) {
        handleError(
          result.error || {
            code: 'UNKNOWN',
            message: 'Analysis failed unexpectedly',
            retryable: true,
          },
        )
        return
      }

      receiveResults(result.data, createSessionId())
    } catch (error) {
      handleError({
        code: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Analysis failed',
        retryable: true,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <section className="panel hero-panel">
        <h2>Set Your Fishing Context</h2>
        <p>Choose mode, snap a picture, then run AI analysis.</p>
      </section>

      <section className="panel form-grid">
        <label>
          Mode
          <select value={mode} onChange={(event) => setMode(event.target.value as 'general' | 'specific')}>
            <option value="general">General</option>
            <option value="specific">Specific Species</option>
          </select>
        </label>

        {mode === 'specific' ? (
          <label>
            Target species
            <input
              value={targetSpecies}
              onChange={(event) => setTargetSpecies(event.target.value)}
              placeholder="Largemouth bass"
            />
          </label>
        ) : null}

        <label>
          Platform
          <select value={platform} onChange={(event) => setPlatform(event.target.value as 'shore' | 'kayak' | 'boat' | '')}>
            <option value="">Not set</option>
            <option value="shore">Shore</option>
            <option value="kayak">Kayak</option>
            <option value="boat">Boat</option>
          </select>
        </label>

        <label>
          Gear
          <select value={gear} onChange={(event) => setGear(event.target.value as 'spinning' | 'baitcasting' | 'fly' | 'unknown')}>
            <option value="unknown">Unknown</option>
            <option value="spinning">Spinning</option>
            <option value="baitcasting">Baitcasting</option>
            <option value="fly">Fly</option>
          </select>
        </label>

        <label>
          Location
          <select value={locationMode} onChange={(event) => setLocationMode(event.target.value as 'device' | 'manual')}>
            <option value="device">Device (GPS)</option>
            <option value="manual">Enter manually</option>
          </select>
        </label>

        {locationMode === 'manual' ? (
          <>
            <label>
              Latitude
              <input
                type="number"
                value={manualLat}
                onChange={(event) => setManualLat(event.target.value)}
                placeholder="e.g. 40.7128"
                min={-90}
                max={90}
                step="any"
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                value={manualLon}
                onChange={(event) => setManualLon(event.target.value)}
                placeholder="e.g. -74.0060"
                min={-180}
                max={180}
                step="any"
              />
            </label>
          </>
        ) : null}

        <label>
          Model
          {state.availableModels.length > 0 ? (
            <select
              value={state.selectedModel ?? ''}
              onChange={(event) => selectModel(event.target.value)}
            >
              {state.availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <select disabled>
              <option>{state.selectedModel ?? 'Loading models…'}</option>
            </select>
          )}
        </label>

        <label className="wide">
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Water clarity, lure preferences, nearby structure"
            rows={3}
          />
        </label>
      </section>

      <section className="panel">
        <h3>Captured Media</h3>
        {state.captureResult ? (
          <div className="capture-preview">
            <img src={state.captureResult.uri} alt="Captured scene" />
            <p>
              {state.captureResult.width} x {state.captureResult.height} • {state.captureResult.mimeType}
            </p>
          </div>
        ) : (
          <p>No photo captured yet.</p>
        )}
      </section>

      {busy && (
        <section className="panel">
          <h3>Analysis Progress</h3>
          {[
            { key: 'Processing', label: 'Processing', description: 'Preparing image', progress: state.processingProgress },
            { key: 'Enriching', label: 'Enriching', description: 'Geo/weather lookup', progress: state.enrichmentProgress },
            { key: 'Analyzing', label: 'Analyzing', description: 'AI vision call', progress: state.aiProgress },
          ].map((step) => {
            const stateOrder = ['Processing', 'Enriching', 'Analyzing']
            const currentIndex = stateOrder.indexOf(state.state)
            const stepIndex = stateOrder.indexOf(step.key)
            const status = step.progress === 1 ? 'Done' : stepIndex === currentIndex ? 'In progress...' : 'Waiting'
            return (
              <div key={step.key} style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{step.label}</strong> — {step.description}</span>
                  <span>{status}</span>
                </div>
                <progress value={step.progress} max={1} style={{ width: '100%' }} />
              </div>
            )
          })}
        </section>
      )}

      {validationError && <p className="error-message" role="alert">{validationError}</p>}

      <section className="action-row">
        <span className="api-key-control">
          <button className="ghost" type="button" onClick={onOpenSettings}>
            API Key Settings
          </button>
          {apiKeyConfigured !== null && (
            <span className={`api-key-badge ${apiKeyConfigured ? 'ok' : 'missing'}`}>
              {apiKeyConfigured ? '✓ Configured' : '✗ Not set'}
            </span>
          )}
        </span>
        <button className="secondary" type="button" onClick={openCapture}>
          Capture or Upload
        </button>
        <button type="button" onClick={() => void analyzeNow()} disabled={!canStartAnalysis || busy}>
          {busy ? 'Analyzing...' : 'Analyze'}
        </button>
      </section>
    </main>
  )
}
