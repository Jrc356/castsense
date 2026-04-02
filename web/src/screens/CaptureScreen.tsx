import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pickMediaFromLibrary } from '../services/camera'
import { useApp } from '../state/AppContext'

export function CaptureScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const { state, startCapture, completeCapture } = useApp()

  useEffect(() => {
    startCapture()
  }, [startCapture])

  async function pickFromLibrary() {
    const media = await pickMediaFromLibrary()
    if (!media) return

    completeCapture({
      uri: media.uri,
      width: media.width,
      height: media.height,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
    })

    navigate('/')
  }

  return (
    <main className="screen capture-screen">
      <section className="panel hero-panel">
        <h2>Capture Scene</h2>
        <p>Choose a photo from your device to analyse.</p>
      </section>

      <section className="action-row">
        <button className="ghost" type="button" onClick={() => navigate('/')}>
          Back
        </button>
        <button type="button" onClick={() => void pickFromLibrary()}>
          Upload Photo
        </button>
      </section>

      {state.captureResult ? (
        <section className="panel">
          <p>Latest captured media is ready for analysis.</p>
        </section>
      ) : null}
    </main>
  )
}
