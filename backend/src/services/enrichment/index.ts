/**
 * Enrichment Services Index
 * 
 * Re-exports all enrichment modules
 */

// Reverse Geocode (T3.2)
export { reverseGeocode } from './reverse-geocode';

// Weather (T3.3)
export { fetchWeather } from './weather';

// Solar (T3.4)
export { calculateSolar } from './solar';

// Orchestrator (T3.5)
export { 
  runEnrichments, 
  canEnrich 
} from './orchestrator';
export type { EnrichmentOrchestrationResult } from './orchestrator';

// Re-export types for convenience
export type {
  EnrichmentError,
  ReverseGeocodeResult,
  WeatherResult,
  SolarResult,
  HydrologyResult,
  EnrichmentResults,
  EnrichmentStatus,
  EnrichmentStatusMap,
  ContextPack
} from '../../types/enrichment';
export { isEnrichmentError } from '../../types/enrichment';
