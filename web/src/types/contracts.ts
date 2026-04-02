/**
 * Local CastSense domain types.
 *
 * This file replaces generated contract output and is now maintained directly
 * by the web app.
 */

export type AnalysisMode = 'general' | 'specific'

export type PlatformContext = 'shore' | 'kayak' | 'boat'

export type GearType = 'spinning' | 'baitcasting' | 'fly' | 'unknown'

export type CaptureType = 'photo'

export interface CastSenseRequestMetadata {
  client: {
    platform: 'web'
    app_version: string
    device_model?: string
    locale?: string
    timezone?: string
  }
  request: {
    mode: AnalysisMode
    target_species?: string | null
    platform_context?: PlatformContext
    gear_type?: GearType
    capture_type: CaptureType
    capture_timestamp_utc: string
  }
  location?: {
    lat: number
    lon: number
    accuracy_m?: number
    altitude_m?: number
    heading_deg?: number
    speed_mps?: number
  }
  user_constraints?: {
    lures_available?: string[]
    line_test_lb?: number
    notes?: string
  }
}

export type NormalizedPoint = [number, number]

export interface CastArrow {
  start: NormalizedPoint
  end: NormalizedPoint
}

export interface ZoneStyle {
  priority?: number
  hint?: 'cover' | 'structure' | 'current' | 'depth_edge' | 'shade' | 'inflow' | 'unknown'
}

export interface Zone {
  zone_id: string
  label: string
  confidence: number
  target_species: string
  polygon: [NormalizedPoint, NormalizedPoint, NormalizedPoint, ...NormalizedPoint[]]
  cast_arrow: CastArrow
  retrieve_path?: NormalizedPoint[]
  style?: ZoneStyle
}

export interface Tactic {
  zone_id: string
  recommended_rig: string
  alternate_rigs?: string[]
  target_depth: string
  retrieve_style: string
  cadence?: string
  cast_count_suggestion?: string
  why_this_zone_works: string[]
  steps?: string[]
}

export interface CastSenseAnalysisResult {
  mode: AnalysisMode
  likely_species?: Array<{
    species: string
    confidence: number
  }>
  analysis_frame?: {
    type: 'photo'
    width_px: number
    height_px: number
  }
  zones: Zone[]
  tactics: Tactic[]
  conditions_summary?: string[]
  plan_summary?: string[]
  explainability?: {
    scene_observations?: string[]
    assumptions?: string[]
  }
}
