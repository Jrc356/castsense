import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pickMediaFromLibrary } from '../services/camera'
import { useApp } from '../state/AppContext'

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function CaptureScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const { state, startCapture, completeCapture } = useApp()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    startCapture()
  }, [startCapture])

  useEffect(() => {
    let active = true

    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setLoading(false)
        return
      }

      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (!active) {
          stopStream(media)
          return
        }

        setStream(media)
        streamRef.current = media
        if (videoRef.current) {
          videoRef.current.srcObject = media
        }
      } catch {
        setStream(null)
      } finally {
        setLoading(false)
      }
    })()

    return () => {
      active = false
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [])

  const hasCamera = useMemo(() => Boolean(stream), [stream])

  function captureFromVideo() {
    const video = videoRef.current
    if (!video) return

    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, width, height)
    const uri = canvas.toDataURL('image/jpeg', 0.85)

    completeCapture({
      uri,
      width,
      height,
      mimeType: 'image/jpeg',
    })

    navigate('/')
  }

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
        <p>Use live camera capture or choose an existing photo from your device.</p>
      </section>

      <section className="panel capture-stage">
        {loading ? <p>Loading camera...</p> : null}
        {hasCamera ? (
          <video ref={videoRef} autoPlay playsInline muted className="camera-preview" />
        ) : (
          <div className="camera-fallback">Camera preview unavailable in this browser or permission state.</div>
        )}
      </section>

      <section className="action-row">
        <button className="ghost" type="button" onClick={() => navigate('/')}>
          Back
        </button>
        <button className="secondary" type="button" onClick={() => void pickFromLibrary()}>
          Upload Photo
        </button>
        <button type="button" onClick={captureFromVideo} disabled={!hasCamera}>
          Capture Frame
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
