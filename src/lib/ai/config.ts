/**
 * AI Services Configuration
 *
 * Centralized configuration for AI models, thresholds, and CDN URLs.
 * Single source of truth for AI feature settings (Constitution Principle).
 */

// ============================================================================
// Model URLs (CDN-hosted)
// ============================================================================

export const AI_MODELS = {
  /**
   * MediaPipe Selfie Segmentation Model
   * Landscape variant for background blur/removal
   */
  MEDIAPIPE_SEGMENTATION: {
    modelPath:
      'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
    wasmPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm',
  },
  /**
   * Whisper Tiny English Model
   * Size: ~40MB | Accuracy: 90%+ | Speed: ~2x realtime
   *
   * T136: Multi-language support available by switching to:
   * - id: 'Xenova/whisper-tiny' (multilingual, ~75MB)
   * - language: undefined (for auto-detection)
   * See FR-022 for multi-language requirements
   */
  WHISPER_TINY_EN: {
    id: 'Xenova/whisper-tiny.en',
    language: 'en',
    size: '40MB',
    url: 'https://huggingface.co/Xenova/whisper-tiny.en',
  },
} as const;

// ============================================================================
// Transcription Configuration
// ============================================================================

export const TRANSCRIPTION_CONFIG = {
  /**
   * Chunk length for progressive transcription (seconds)
   * Balances memory usage and processing speed
   */
  CHUNK_LENGTH_SEC: 30,
  /**
   * Confidence threshold for flagging segments (FR-024)
   * Segments below this threshold highlighted for user review
   */
  CONFIDENCE_THRESHOLD: 0.7,

  /**
   * Default language for transcription
   * Auto-detection available via language: undefined
   */
  DEFAULT_LANGUAGE: 'en',

  /**
   * Maximum recording duration for transcription (hours)
   * Prevents excessive memory usage
   */
  MAX_DURATION_HOURS: 2,

  /**
   * Timestamp granularity
   * 'word' for word-level timestamps, 'segment' for sentence-level
   */
  RETURN_TIMESTAMPS: 'word' as const,

  /**
   * Overlap between chunks (seconds)
   * Prevents word cuts at chunk boundaries
   */
  STRIDE_LENGTH_SEC: 5,
} as const;

// ============================================================================
// Silence Detection Configuration
// ============================================================================

export const SILENCE_DETECTION_CONFIG = {
  /**
   * FFT size for audio analysis
   * Larger = more frequency resolution, slower
   */
  FFT_SIZE: 2048,

  /**
   * Minimum silence duration (seconds)
   * Shorter silences ignored to avoid over-detection
   */
  MIN_DURATION_SEC: 2.0,

  /**
   * Smoothing time constant (0-1)
   * Lower = faster response, higher = more stable
   */
  SMOOTHING_TIME_CONSTANT: 0.8,
  /**
   * Audio threshold in decibels (dB)
   * Audio below this level considered silence
   */
  THRESHOLD_DB: -40,
} as const;

// ============================================================================
// Caption Configuration
// ============================================================================

export const CAPTION_CONFIG = {
  /**
   * Default caption position
   */
  DEFAULT_POSITION: {
    horizontal: 'center' as const,
    vertical: 'bottom' as const,
  },

  /**
   * Default caption style
   */
  DEFAULT_STYLE: {
    backgroundColor: '#000000AA', // Black with 67% opacity
    bold: false,
    fontColor: '#FFFFFF',
    fontFamily: 'Arial',
    fontSize: 24,
    italic: false,
    outline: true,
    outlineColor: '#000000',
  },
  /**
   * Maximum caption duration (seconds)
   * Ensures comfortable reading pace (SC-005)
   */
  MAX_DURATION_SEC: 3.0,

  /**
   * Target sync accuracy (milliseconds)
   * Caption timing tolerance (SC-004)
   */
  SYNC_ACCURACY_MS: 200,
} as const;

// ============================================================================
// Background Effect Configuration
// ============================================================================

export const BACKGROUND_EFFECT_CONFIG = {
  /**
   * Default blur intensity (0-100)
   */
  DEFAULT_BLUR_INTENSITY: 50,

  /**
   * Default replacement color (hex)
   */
  DEFAULT_REPLACEMENT_COLOR: '#00FF00', // Green screen

  /**
   * Minimum FPS before showing performance warning
   */
  MIN_FPS_WARNING: 25,

  /**
   * GPU/CPU delegation preference
   */
  PREFER_GPU: true,
  /**
   * Target frame rate for real-time processing
   */
  TARGET_FPS: 30,
} as const;

// ============================================================================
// Storage Configuration
// ============================================================================

export const STORAGE_CONFIG = {
  /**
   * Storage keys prefix
   */
  KEY_PREFIX: 'pmr:',
  /**
   * localStorage quota limit (bytes)
   * ~10MB typical browser limit
   */
  QUOTA_LIMIT_BYTES: 10 * 1024 * 1024, // 10MB

  /**
   * Schema version for migrations
   */
  SCHEMA_VERSION: 1,

  /**
   * Warning threshold (percentage)
   * Show warning when storage exceeds this percentage
   */
  WARNING_THRESHOLD_PERCENT: 80,
} as const;

// ============================================================================
// Performance Configuration
// ============================================================================

export const PERFORMANCE_CONFIG = {
  /**
   * Maximum silence detection time for 20-minute recording (seconds)
   * Target: <10 seconds (SC-003)
   */
  MAX_SILENCE_DETECTION_TIME_20MIN: 10,
  /**
   * Maximum transcription time for 10-minute recording (seconds)
   * Target: <3 minutes (SC-001)
   */
  MAX_TRANSCRIPTION_TIME_10MIN: 180,

  /**
   * Worker thread pool size
   */
  WORKER_POOL_SIZE: 2,
} as const;

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  GPU_UNAVAILABLE:
    'GPU acceleration unavailable. Falling back to CPU (slower performance).',
  INFERENCE_ERROR: 'AI processing failed. Please try again.',
  INVALID_AUDIO: 'Invalid audio format. Please use WebM, WAV, or MP3.',
  MEDIAPIPE_INIT_FAILED:
    'Failed to initialize background effects. Try refreshing the page.',
  MODEL_LOAD_FAILED:
    'Failed to load AI model. Check your internet connection and try again.',
  NO_SPEECH: 'No speech detected in the recording.',
  QUOTA_EXCEEDED:
    'Storage quota exceeded. Delete old recordings to free up space.',
  SEGMENTATION_ERROR: 'Background effect processing failed.',
} as const;
