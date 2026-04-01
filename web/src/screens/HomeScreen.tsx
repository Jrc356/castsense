import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { runAnalysis } from '../services/analysis-orchestrator'
import { getApiKey } from '../services/api-key-storage'
import { fetchAvailableModels } from '../services/model-discovery'
import { getCurrentLocation } from '../services/metadata'
import { createSessionId } from '../services/langchain-memory'
import { useApp } from '../state/AppContext'

export function HomeScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const {
    state,
    canStartAnalysis,
    selectMode,
    setPlatformContext,
    setGearType,
    setUserConstraints,
    setAvailableModels,
    selectModel,
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
  const [busy, setBusy] = useState(false)

  const selectedModelRef = useRef(state.selectedModel)
  selectedModelRef.current = state.selectedModel

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const apiKey = await getApiKey()
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
    if (mode === 'specific' && !targetSpecies.trim()) {
      window.alert('Enter a target species for Specific mode before capture.')
      return
    }

    selectMode(mode, mode === 'specific' ? targetSpecies.trim() : undefined)
    setPlatformContext(platform || null)
    setGearType(gear)
    setUserConstraints({ notes: notes.trim() || undefined })
    navigate('/capture')
  }

  async function analyzeNow() {
    if (!state.captureResult) {
      window.alert('Capture or upload a photo first.')
      return
    }

    const apiKey = await getApiKey()
    if (!apiKey) {
      navigate('/settings')
      return
    }

    const location = await getCurrentLocation()
    if (!location) {
      handleError({
        code: 'NO_GPS',
        message: 'Location is unavailable. Enable location permission and retry.',
        retryable: true,
      })
      navigate('/error')
      return
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
          gear,
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
        navigate('/error')
        return
      }

      receiveResults(result.data, createSessionId())
      navigate('/results')
    } catch (error) {
      handleError({
        code: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Analysis failed',
        retryable: true,
      })
      navigate('/error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <section className="panel hero-panel">
        <h2>Set Your Fishing Context</h2>
        <p>Choose mode, capture a scene, then run AI analysis.</p>
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

      <section className="action-row">
        <button className="ghost" type="button" onClick={() => navigate('/settings')}>
          API Key Settings
        </button>
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
