/**
 * Services Index
 * 
 * Re-exports all media processing services for convenient importing
 */

// Media Storage (T2.1)
export {
  saveMedia,
  getMediaPath,
  deleteMedia,
  saveProcessedFile,
  purgeOldMedia
} from './media-storage';

// Image Processor (T2.2)
export {
  processPhoto,
  getImageDimensions,
  normalizeOrientation
} from './image-processor';

// Video Processor (T2.3)
export {
  getVideoDuration,
  extractKeyframes,
  getVideoMetadata
} from './video-processor';

// Analysis Frame (T2.4)
export {
  buildPhotoAnalysisFrame,
  buildVideoAnalysisFrame,
  isValidFrameIndex,
  getFrameAtIndex,
  selectBestFrame
} from './analysis-frame';
export type { VideoAnalysisFrameResult } from './analysis-frame';

// Context Pack Builder (T3.1)
export {
  buildContextPack,
  addSpeciesContext
} from './context-pack';

// Enrichment Services (T3.2-T3.5)
export {
  reverseGeocode,
  fetchWeather,
  calculateSolar,
  runEnrichments,
  canEnrich,
  isEnrichmentError
} from './enrichment';
export type { EnrichmentOrchestrationResult } from './enrichment';

// Re-export types for convenience
export type {
  KeyframeInfo,
  ProcessedImageInfo,
  AnalysisFrame
} from '../types/media';

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
} from '../types/enrichment';
