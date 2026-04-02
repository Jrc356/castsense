import { useEffect, useRef, useState } from 'react'
import { OverlayCanvas } from '../components/overlays'
import { TacticsPanel, TextOnlyResults } from '../components'
import type { CastSenseAnalysisResult, Tactic, Zone } from '../types/contracts'
import type { Size } from '../utils/coordinate-mapping'
import { useApp } from '../state/AppContext'

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

export function ResultsScreen(): React.JSX.Element {
  const { state, reset, retry } = useApp()
  const containerRef = useRef<HTMLDivElement | null>(null)

  const data = state.analysisResult?.result as CastSenseAnalysisResult | undefined
  const zones = (data?.zones ?? []) as Zone[]
  const tactics = (data?.tactics ?? []) as Tactic[]
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(zones[0]?.zone_id ?? null)

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
