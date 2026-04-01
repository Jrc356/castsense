/**
 * CastSense Contract Types
 * 
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 * Generated from JSON Schemas in /contracts
 * 
 * To regenerate: cd contracts && npm run generate-types
 */

/* eslint-disable */
/* tslint:disable */

// Client to backend request metadata
// Source: metadata.schema.json

/**
 * Client to backend metadata payload per spec §7.2
 */
export interface CastSenseRequestMetadata {
  /**
   * Client device and app information
   */
  client: {
    /**
     * Client platform
     */
    platform: "web";
    /**
     * Semantic version of the app
     */
    app_version: string;
    /**
     * Device model identifier
     */
    device_model?: string;
    /**
     * User locale (e.g., en-US)
     */
    locale?: string;
    /**
     * IANA timezone identifier (e.g., America/Chicago)
     */
    timezone?: string;
  };
  /**
   * Request-specific parameters
   */
  request: {
    /**
     * Analysis mode
     */
    mode: "general" | "specific";
    /**
     * Target species for specific mode
     */
    target_species?: string | null;
    /**
     * User's fishing platform
     */
    platform_context?: "shore" | "kayak" | "boat";
    /**
     * Type of fishing gear being used
     */
    gear_type?: "spinning" | "baitcasting" | "fly" | "unknown";
    /**
     * Type of media captured
     */
    capture_type: "photo" | "video";
    /**
     * ISO 8601 timestamp of capture in UTC
     */
    capture_timestamp_utc: string;
  };
  /**
   * GPS location data
   */
  location?: {
    /**
     * Latitude in decimal degrees
     */
    lat: number;
    /**
     * Longitude in decimal degrees
     */
    lon: number;
    /**
     * GPS accuracy in meters
     */
    accuracy_m?: number;
    /**
     * Altitude in meters above sea level
     */
    altitude_m?: number;
    /**
     * Device heading in degrees (0-360)
     */
    heading_deg?: number;
    /**
     * Speed in meters per second
     */
    speed_mps?: number;
  };
  /**
   * User-specified constraints and preferences
   */
  user_constraints?: {
    /**
     * List of lures the user has available
     */
    lures_available?: string[];
    /**
     * Line test strength in pounds
     */
    line_test_lb?: number;
    /**
     * Additional user notes or constraints
     */
    notes?: string;
  };
}



// API response envelope wrapper
// Source: response.schema.json

/**
 * Response envelope wrapper per spec §7.4
 */
export interface CastSenseResponseEnvelope {
  /**
   * Unique identifier for this request
   */
  request_id: string;
  /**
   * Overall request status
   */
  status: "ok" | "degraded" | "error";
  /**
   * How the client should render results
   */
  rendering_mode?: "overlay" | "text_only";
  /**
   * Timing breakdown in milliseconds
   */
  timings_ms?: {
    /**
     * Time to receive and process upload
     */
    upload?: number;
    /**
     * Time for context enrichment calls
     */
    enrichment?: number;
    /**
     * Time for AI perception stage
     */
    ai_perception?: number;
    /**
     * Time for AI planning stage
     */
    ai_planning?: number;
    /**
     * Time for output validation
     */
    validation?: number;
    /**
     * Total request processing time
     */
    total?: number;
  };
  /**
   * Status of each enrichment provider
   */
  enrichment_status?: {
    /**
     * Reverse geocoding status
     */
    reverse_geocode?: "ok" | "failed" | "skipped";
    /**
     * Weather enrichment status
     */
    weather?: "ok" | "failed" | "skipped";
    /**
     * Solar times calculation status
     */
    solar?: "ok" | "failed" | "skipped";
    /**
     * Hydrology data status
     */
    hydrology?: "ok" | "failed" | "skipped";
  };
  /**
   * Canonical context pack passed to AI and returned for transparency
   */
  context_pack?: {
    mode?: "general" | "specific";
    target_species?: string | null;
    user_context?: {
      platform?: "shore" | "kayak" | "boat";
      gear_type?: "spinning" | "baitcasting" | "fly" | "unknown";
      constraints?: {
        lures_available?: string[];
        line_test_lb?: number;
        notes?: string;
      };
    };
    location?: {
      lat?: number;
      lon?: number;
      accuracy_m?: number;
      waterbody_name?: string | null;
      water_type?: "lake" | "river" | "pond" | "ocean" | "unknown";
      admin_area?: string | null;
      country?: string | null;
    };
    time?: {
      timestamp_utc?: string;
      local_time?: string;
      season?: "winter" | "spring" | "summer" | "fall";
      sunrise_local?: string;
      sunset_local?: string;
      daylight_phase?: "pre_dawn" | "sunrise" | "day" | "golden_hour" | "sunset" | "after_sunset" | "night";
    };
    weather?: {
      air_temp_f?: number;
      wind_speed_mph?: number;
      wind_direction_deg?: number;
      cloud_cover_pct?: number;
      precip_last_24h_in?: number;
      pressure_inhg?: number;
      pressure_trend?: "rising" | "steady" | "falling" | "unknown";
    };
    hydrology?: {
      flow_cfs?: number;
      gauge_height_ft?: number;
      source?: string | null;
      observed_at_utc?: string | null;
    };
    species_context?: {
      likely_species?: {
        species?: string;
        confidence?: number;
      }[];
      source?: "defaults" | "dataset" | "ai_inferred";
    };
    [k: string]: unknown | undefined;
  };
  /**
   * The analysis result (overlay-ready) - see result.schema.json for full definition
   */
  result?: {};
}



// Overlay-ready analysis result
// Source: result.schema.json

/**
 * Overlay-ready analysis result per spec §9
 */
export interface CastSenseAnalysisResult {
  /**
   * Analysis mode used
   */
  mode: "general" | "specific";
  /**
   * Likely species with confidence scores
   */
  likely_species?: {
    /**
     * Species name
     */
    species: string;
    /**
     * Confidence score (0-1)
     */
    confidence: number;
  }[];
  /**
   * Reference frame for overlay coordinates
   */
  analysis_frame?: {
    /**
     * Type of analysis frame
     */
    type: "photo" | "video_frame";
    /**
     * Frame width in pixels
     */
    width_px: number;
    /**
     * Frame height in pixels
     */
    height_px: number;
    /**
     * For video: index of selected keyframe
     */
    selected_frame_index?: number;
    /**
     * For video: timestamp of frame in milliseconds
     */
    frame_timestamp_ms?: number;
  };
  /**
   * Cast zones with overlay data
   *
   * @minItems 0
   * @maxItems 10
   */
  zones:
    | []
    | [
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        }
      ]
    | [
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        }
      ]
    | [
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        }
      ]
    | [
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        }
      ]
    | [
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        }
      ]
    | [
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        }
      ]
    | [
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        }
      ]
    | [
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        }
      ]
    | [
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        }
      ]
    | [
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        },
        {
          /**
           * Unique zone identifier
           */
          zone_id: string;
          /**
           * Zone label (Primary, Secondary, Tertiary, or custom)
           */
          label: string;
          /**
           * Zone confidence score (0-1)
           */
          confidence: number;
          /**
           * Target species for this zone
           */
          target_species: string;
          /**
           * Zone boundary as array of [x,y] normalized coordinates
           *
           * @minItems 3
           */
          polygon: [[number, number], [number, number], [number, number], ...[number, number][]];
          /**
           * Cast direction arrow
           */
          cast_arrow: {
            /**
             * Arrow start point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            start: [number, number];
            /**
             * Arrow end point [x, y]
             *
             * @minItems 2
             * @maxItems 2
             */
            end: [number, number];
          };
          /**
           * Optional retrieve path as polyline
           */
          retrieve_path?: [number, number][];
          /**
           * Rendering style hints
           */
          style?: {
            /**
             * Priority for rendering order (1 = highest)
             */
            priority?: number;
            /**
             * Type of fishing structure/feature
             */
            hint?: "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown";
          };
        }
      ];
  /**
   * Tactics for each zone
   */
  tactics: {
    /**
     * Zone this tactic applies to
     */
    zone_id: string;
    /**
     * Recommended lure/rig setup
     */
    recommended_rig: string;
    /**
     * Alternative rig options
     */
    alternate_rigs?: string[];
    /**
     * Recommended target depth
     */
    target_depth: string;
    /**
     * How to retrieve the lure
     */
    retrieve_style: string;
    /**
     * Retrieve cadence description
     */
    cadence?: string;
    /**
     * Suggested number of casts
     */
    cast_count_suggestion?: string;
    /**
     * Reasons this zone is productive
     *
     * @minItems 1
     */
    why_this_zone_works: [string, ...string[]];
    /**
     * Step-by-step fishing instructions
     */
    steps?: string[];
  }[];
  /**
   * Summary of current conditions
   */
  conditions_summary?: string[];
  /**
   * Overall fishing plan summary
   */
  plan_summary?: string[];
  /**
   * AI reasoning transparency
   */
  explainability?: {
    /**
     * What the AI observed in the scene
     */
    scene_observations?: string[];
    /**
     * Assumptions made during analysis
     */
    assumptions?: string[];
  };
}



// Standard error response
// Source: error.schema.json

/**
 * Standard error response per spec §10.1
 */
export interface CastSenseErrorResponse {
  /**
   * Unique identifier for this request
   */
  request_id: string;
  /**
   * Always 'error' for error responses
   */
  status: "error";
  /**
   * Error details
   */
  error: {
    /**
     * Error code
     */
    code: "NO_GPS" | "NO_NETWORK" | "INVALID_MEDIA" | "AI_TIMEOUT" | "ENRICHMENT_FAILED" | "UNKNOWN";
    /**
     * Human-readable error message
     */
    message: string;
    /**
     * Whether the client should retry this request
     */
    retryable: boolean;
    /**
     * Additional error details
     */
    details?: {
      [k: string]: unknown | undefined;
    };
  };
}




// Utility Types

/** Normalized coordinate point [x, y] where values are 0-1 */
export type NormalizedPoint = [number, number];

/** Polygon as array of normalized points */
export type NormalizedPolygon = NormalizedPoint[];

/** Extract zone from result */
export type Zone = CastSenseAnalysisResult['zones'][number];

/** Extract tactic from result */
export type Tactic = CastSenseAnalysisResult['tactics'][number];

/** Status values */
export type ResponseStatus = CastSenseResponseEnvelope['status'];

/** Error codes */
export type ErrorCode = CastSenseErrorResponse['error']['code'];

/** Rendering modes */
export type RenderingMode = NonNullable<CastSenseResponseEnvelope['rendering_mode']>;

/** Fishing modes */
export type FishingMode = 'general' | 'specific';

/** Platform context */
export type PlatformContext = 'shore' | 'kayak' | 'boat';

/** Gear types */
export type GearType = 'spinning' | 'baitcasting' | 'fly' | 'unknown';

/** Capture types */
export type CaptureType = 'photo' | 'video';

// Type aliases for convenience
export type RequestMetadata = CastSenseRequestMetadata;
export type ResponseEnvelope = CastSenseResponseEnvelope;
export type AnalysisResult = CastSenseAnalysisResult;
export type ErrorResponse = CastSenseErrorResponse;
