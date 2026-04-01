import { useEffect, useMemo, useRef } from 'react'
import {
  createCoordinateMapper,
  getPolygonCenter,
  transformPathToScreen,
  transformPolygonToScreen,
  type Size,
} from '../../utils/coordinate-mapping'
import { findZoneAtPoint } from '../../utils/polygon-hit-test'
import type { Zone } from '../../types/contracts'

interface OverlayCanvasProps {
  zones: Zone[]
  imageSize: Size
  displaySize: Size
  fitMode: 'contain' | 'cover'
  selectedZoneId: string | null
  onZoneSelect: (zoneId: string | null) => void
  showCastArrows?: boolean
  showRetrievePaths?: boolean
}

const HINT_COLORS: Record<string, string> = {
  cover: '#2f7d4f',
  structure: '#2066c4',
  current: '#ce7028',
  depth_edge: '#7046b8',
  shade: '#5f7183',
  inflow: '#0d8b9e',
  unknown: '#8b8e98',
}

function colorForZone(zone: Zone): string {
  const hint = zone.style?.hint ?? 'unknown'
  return HINT_COLORS[hint] ?? HINT_COLORS.unknown
}

function drawArrow(ctx: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }) {
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()

  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const arrowSize = 10

  ctx.beginPath()
  ctx.moveTo(end.x, end.y)
  ctx.lineTo(end.x - arrowSize * Math.cos(angle - Math.PI / 6), end.y - arrowSize * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(end.x - arrowSize * Math.cos(angle + Math.PI / 6), end.y - arrowSize * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fill()
}

export function OverlayCanvas({
  zones,
  imageSize,
  displaySize,
  fitMode,
  selectedZoneId,
  onZoneSelect,
  showCastArrows = true,
  showRetrievePaths = true,
}: OverlayCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const mapper = useMemo(
    () => createCoordinateMapper(imageSize, displaySize, fitMode),
    [displaySize, fitMode, imageSize],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(displaySize.width * dpr))
    canvas.height = Math.max(1, Math.floor(displaySize.height * dpr))
    canvas.style.width = `${displaySize.width}px`
    canvas.style.height = `${displaySize.height}px`

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, displaySize.width, displaySize.height)

    const ordered = [...zones].sort((a, b) => {
      const pa = a.style?.priority ?? 999
      const pb = b.style?.priority ?? 999
      return pa - pb
    })

    for (const zone of ordered) {
      const color = colorForZone(zone)
      const selected = zone.zone_id === selectedZoneId
      const polygon = transformPolygonToScreen(zone.polygon, mapper)

      if (polygon.length < 3) {
        continue
      }

      ctx.beginPath()
      ctx.moveTo(polygon[0]!.x, polygon[0]!.y)
      for (let i = 1; i < polygon.length; i += 1) {
        const p = polygon[i]!
        ctx.lineTo(p.x, p.y)
      }
      ctx.closePath()

      ctx.fillStyle = `${color}33`
      ctx.strokeStyle = selected ? '#f3c96a' : color
      ctx.lineWidth = selected ? 3 : 2
      ctx.fill()
      ctx.stroke()

      if (showCastArrows) {
        const start = mapper.normalizedToScreen(zone.cast_arrow.start)
        const end = mapper.normalizedToScreen(zone.cast_arrow.end)
        ctx.strokeStyle = selected ? '#f3c96a' : color
        ctx.fillStyle = selected ? '#f3c96a' : color
        ctx.lineWidth = selected ? 3 : 2
        drawArrow(ctx, start, end)
      }

      if (showRetrievePaths && zone.retrieve_path?.length) {
        const path = transformPathToScreen(zone.retrieve_path, mapper)
        if (path.length > 1) {
          ctx.beginPath()
          ctx.setLineDash([6, 5])
          ctx.strokeStyle = selected ? '#f3c96a' : color
          ctx.lineWidth = 2
          ctx.moveTo(path[0]!.x, path[0]!.y)
          for (let i = 1; i < path.length; i += 1) {
            const point = path[i]!
            ctx.lineTo(point.x, point.y)
          }
          ctx.stroke()
          ctx.setLineDash([])
        }
      }

      const center = getPolygonCenter(polygon)
      ctx.fillStyle = selected ? '#f3c96a' : '#111c22'
      ctx.font = '600 12px Manrope, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(zone.label, center.x, center.y)
    }
  }, [displaySize, mapper, onZoneSelect, selectedZoneId, showCastArrows, showRetrievePaths, zones])

  function handlePointer(event: React.MouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    const zone = findZoneAtPoint(point, zones, mapper)
    onZoneSelect(zone?.zone_id ?? null)
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handlePointer}
      role="img"
      aria-label="Analysis overlay"
      style={{ display: 'block', cursor: 'crosshair' }}
    />
  )
}
