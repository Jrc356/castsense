import { useEffect, useRef, useState } from 'react'
import { OverlayCanvas } from '../components/overlays'
import { TacticsPanel, TextOnlyResults } from '../components'
import type { CastSenseAnalysisResult, Tactic, Zone } from '../types/contracts'
import type { Size } from '../utils/coordinate-mapping'
import { useApp } from '../state/AppContext'
import { streamFollowUpQuestion } from '../services/langchain-followup'
import { getApiKey } from '../services/api-key-storage'

function useDisplaySize(ref: React.RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 1, height: 1 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => {
      const rect = element.getBoundingClientRect()
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)

    return () => observer.disconnect()
  }, [ref])

  return size
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function ResultsScreen(): React.JSX.Element {
  const { state, reset, retry } = useApp()
  const containerRef = useRef<HTMLDivElement | null>(null)

  const data = state.analysisResult?.result as CastSenseAnalysisResult | undefined
  const zones = (data?.zones ?? []) as Zone[]
  const tactics = (data?.tactics ?? []) as Tactic[]
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(zones[0]?.zone_id ?? null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [followUpInput, setFollowUpInput] = useState('')
  const [followUpError, setFollowUpError] = useState<string | null>(null)
  const [followUpBusy, setFollowUpBusy] = useState(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const imageSize: Size = data?.analysis_frame
    ? {
        width: data.analysis_frame.width_px,
        height: data.analysis_frame.height_px,
      }
    : {
        width: state.captureResult?.width ?? 1920,
        height: state.captureResult?.height ?? 1080,
      }

  const displaySize = useDisplaySize(containerRef)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, streamingContent])

  async function submitFollowUp() {
    const question = followUpInput.trim()
    if (!question) return
    if (!state.sessionId) {
      setFollowUpError('No active session. Please run a new analysis.')
      return
    }
    const apiKey = await getApiKey()
    if (!apiKey) {
      setFollowUpError('API key not configured.')
      return
    }
    setFollowUpError(null)
    setFollowUpBusy(true)
    setFollowUpInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: question }])
    setStreamingContent('')

    const result = await streamFollowUpQuestion(
      state.sessionId,
      question,
      apiKey,
      (chunk) => setStreamingContent((prev) => prev + chunk),
      state.selectedModel ?? undefined
    )

    if (result.success) {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: result.response }])
    } else {
      setChatMessages((prev) => prev.slice(0, -1)) // remove optimistic user message
      setFollowUpError(result.error.message)
    }
    setStreamingContent('')
    setFollowUpBusy(false)
  }

  if (!state.captureResult || !data) {
    return (
      <main className="screen">
        <section className="panel">
          <h2>No analysis results available.</h2>
          <button type="button" onClick={reset}>Back Home</button>
        </section>
      </main>
    )
  }

  return (
    <main className="screen">
      <section className="panel hero-panel">
        <h2>Analysis Results</h2>
        <p>Tap zones in the overlay to inspect tactical recommendations.</p>
      </section>

      <section className="panel media-panel">
        <div className="media-frame" ref={containerRef}>
          <img src={state.captureResult.uri} alt="Analyzed capture" />
          {zones.length ? (
            <div className="overlay-layer">
              <OverlayCanvas
                zones={zones}
                imageSize={imageSize}
                displaySize={displaySize}
                fitMode="contain"
                selectedZoneId={selectedZoneId}
                onZoneSelect={setSelectedZoneId}
                showCastArrows={true}
                showRetrievePaths={true}
              />
            </div>
          ) : null}
        </div>
      </section>

      {zones.length ? (
        <section className="panel zone-row">
          {zones.map((zone) => (
            <button
              key={zone.zone_id}
              type="button"
              className={selectedZoneId === zone.zone_id ? 'zone-pill active' : 'zone-pill'}
              onClick={() => setSelectedZoneId(zone.zone_id)}
            >
              {zone.label} ({Math.round(zone.confidence * 100)}%)
            </button>
          ))}
        </section>
      ) : (
        <TextOnlyResults
          result={data}
          unavailableReason="No cast zones were detected for this frame. Try another angle or lighting condition."
        />
      )}

      <TacticsPanel tactics={tactics} zones={zones} selectedZoneId={selectedZoneId} />

      <section className="panel">
        <h3>Conditions</h3>
        {data.conditions_summary?.length ? (
          <ul>
            {data.conditions_summary.map((line, index) => (
              <li key={`condition-${index}`}>{line}</li>
            ))}
          </ul>
        ) : (
          <p>No condition summary provided.</p>
        )}
      </section>

      <section className="panel">
        <h3>Ask a Follow-Up</h3>

        {chatMessages.length > 0 || streamingContent ? (
          <div className="chat-log">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant'}`}
              >
                <p>{msg.content}</p>
              </div>
            ))}
            {streamingContent ? (
              <div className="chat-bubble chat-bubble--streaming">
                <p>
                  {streamingContent}
                  <span style={{ display: 'inline-block', width: '0.5em', height: '1em', background: 'currentColor', marginLeft: '1px', verticalAlign: 'text-bottom', opacity: 0.7 }}>▋</span>
                </p>
              </div>
            ) : followUpBusy ? (
              <div className="chat-bubble--thinking">…</div>
            ) : null}
            <div ref={chatEndRef} />
          </div>
        ) : null}

        {followUpError && <p className="error-message" role="alert">{followUpError}</p>}

        <div className="followup-input-row">
          <textarea
            rows={2}
            placeholder="Ask about zones, lures, timing…"
            value={followUpInput}
            disabled={followUpBusy}
            onChange={(e) => setFollowUpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void submitFollowUp()
              }
            }}
          />
          <button
            type="button"
            onClick={() => void submitFollowUp()}
            disabled={followUpBusy || !followUpInput.trim()}
          >
            {followUpBusy ? '…' : 'Ask'}
          </button>
        </div>

        {chatMessages.length === 0 && !followUpBusy && (
          <p className="followup-hint">Shift+Enter for a new line.</p>
        )}
      </section>

      <section className="action-row">
        <button className="ghost" type="button" onClick={retry}>
          Retry Analysis
        </button>
        <button type="button" onClick={reset}>
          New Analysis
        </button>
      </section>
    </main>
  )
}
