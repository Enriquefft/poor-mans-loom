/**
 * AI Services Contract
 *
 * Type definitions for AI service layer operations.
 * All services return Result types for type-safe error handling (Constitution Principle VI).
 */

// ============================================================================
// Transcription Service
// ============================================================================

export interface TranscriptionService {
  /**
   * Initialize Whisper model (lazy loaded on first use)
   * @throws Never - returns typed error result
   */
  initialize(): Promise<TranscriptionInitResult>;

  /**
   * Transcribe audio blob to text with timestamps
   * @param audioBlob - Audio data (WebM, WAV, MP3)
   * @param options - Transcription options
   * @returns Transcript or error
   */
  transcribe(
    audioBlob: Blob,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult>;

  /**
   * Check if model is loaded and ready
   */
  isReady(): boolean;

  /**
   * Unload model from memory
   */
  cleanup(): Promise<void>;
}

export interface TranscriptionOptions {
  language?: string; // ISO 639-1 code (e.g., 'en', 'es')
  chunkLengthSec?: number; // Process in chunks (default: 30)
  strideLengthSec?: number; // Overlap between chunks (default: 5)
  returnTimestamps?: 'word' | 'segment'; // Granularity
}

export type TranscriptionInitResult =
  | { success: true; modelVersion: string }
  | TranscriptionError;

export type TranscriptionResult =
  | { success: true; transcript: Transcript }
  | TranscriptionError;

export interface TranscriptionError {
  success: false;
  type: 'MODEL_LOAD_FAILED' | 'INFERENCE_ERROR' | 'NO_SPEECH' | 'INVALID_AUDIO';
  message: string;
  details?: unknown;
}

// ============================================================================
// Segmentation Service (Background Blur/Removal)
// ============================================================================

export interface SegmentationService {
  /**
   * Initialize MediaPipe segmentation model
   * @param options - Segmentation configuration
   */
  initialize(options?: SegmentationOptions): Promise<SegmentationInitResult>;

  /**
   * Apply background effect to video frame
   * @param videoElement - Source video element
   * @param canvas - Target canvas for output
   * @param effect - Effect configuration
   */
  processFrame(
    videoElement: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    effect: BackgroundEffect,
  ): SegmentationFrameResult;

  /**
   * Check if segmentation is ready
   */
  isReady(): boolean;

  /**
   * Clean up resources
   */
  cleanup(): Promise<void>;
}

export interface SegmentationOptions {
  delegate?: 'CPU' | 'GPU'; // Processing backend (default: GPU)
  modelAssetPath?: string; // Custom model URL
}

export type SegmentationInitResult =
  | { success: true; delegate: 'CPU' | 'GPU' }
  | SegmentationError;

export type SegmentationFrameResult =
  | { success: true; processedFrame: ImageData }
  | SegmentationError;

export interface SegmentationError {
  success: false;
  type: 'MEDIAPIPE_INIT_FAILED' | 'SEGMENTATION_ERROR' | 'GPU_UNAVAILABLE';
  message: string;
  details?: unknown;
}

// ============================================================================
// Silence Detection Service
// ============================================================================

export interface SilenceDetectionService {
  /**
   * Analyze audio stream for silence periods
   * @param audioContext - Web Audio API context
   * @param stream - Media stream to analyze
   * @param options - Detection options
   * @returns Array of detected silence segments
   */
  detect(
    audioContext: AudioContext,
    stream: MediaStream,
    options?: SilenceDetectionOptions,
  ): Promise<SilenceDetectionResult>;

  /**
   * Real-time silence monitoring (returns observable/callback)
   * @param audioContext - Web Audio API context
   * @param stream - Media stream to monitor
   * @param callback - Called when silence detected
   */
  monitor(
    audioContext: AudioContext,
    stream: MediaStream,
    callback: (segment: SilenceSegment) => void,
  ): SilenceMonitor;
}

export interface SilenceDetectionOptions {
  thresholdDb?: number; // Silence threshold in dB (default: -40)
  minDurationSec?: number; // Minimum silence duration (default: 2.0)
}

export type SilenceDetectionResult =
  | { success: true; segments: SilenceSegment[] }
  | SilenceDetectionError;

export interface SilenceMonitor {
  stop(): void; // Stop monitoring
  updateThreshold(db: number): void; // Adjust threshold in real-time
}

export interface SilenceDetectionError {
  success: false;
  type: 'AUDIO_CONTEXT_ERROR' | 'STREAM_ERROR';
  message: string;
  details?: unknown;
}

// ============================================================================
// Caption Generation Service
// ============================================================================

export interface CaptionService {
  /**
   * Generate captions from transcript
   * @param transcript - Source transcript
   * @param style - Visual styling
   * @returns Array of timed captions
   */
  generate(transcript: Transcript, style?: Partial<CaptionStyle>): Caption[];

  /**
   * Export captions to subtitle format
   * @param captions - Caption array
   * @param format - Export format
   * @returns Subtitle file content
   */
  export(captions: Caption[], format: 'SRT' | 'VTT' | 'TXT'): string;

  /**
   * Update captions when transcript changes
   * @param captions - Existing captions
   * @param transcript - Updated transcript
   * @returns Updated captions
   */
  updateFromTranscript(captions: Caption[], transcript: Transcript): Caption[];
}

// ============================================================================
// AI Processing Job Manager
// ============================================================================

export interface AIJobManager {
  /**
   * Start an AI processing job
   * @param type - Job type
   * @param recordingId - Target recording
   * @param input - Job-specific input data
   * @returns Job ID
   */
  startJob(
    type: AIJobType,
    recordingId: string,
    input: unknown,
  ): Promise<string>;

  /**
   * Get job status and progress
   * @param jobId - Job identifier
   */
  getJob(jobId: string): AIProcessingJob | undefined;

  /**
   * Cancel running job
   * @param jobId - Job identifier
   */
  cancelJob(jobId: string): Promise<void>;

  /**
   * Subscribe to job progress updates
   * @param jobId - Job identifier
   * @param callback - Progress callback
   */
  subscribe(
    jobId: string,
    callback: (job: AIProcessingJob) => void,
  ): () => void; // Returns unsubscribe function
}

export type AIJobType =
  | 'transcription'
  | 'silence_detection'
  | 'caption_generation';

// ============================================================================
// Shared Types (from data-model.md)
// ============================================================================

export interface Transcript {
  id: string;
  recordingId: string;
  language: string;
  createdAt: number;
  updatedAt: number;
  segments: TranscriptSegment[];
  metadata: TranscriptMetadata;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  speaker?: string;
  words: TranscriptWord[];
  flagged: boolean;
  edited: boolean;
}

export interface TranscriptWord {
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface TranscriptMetadata {
  modelVersion: string;
  processingDuration: number;
  totalDuration: number;
  wordCount: number;
  averageConfidence: number;
  lowConfidenceSegments: number;
}

export interface SilenceSegment {
  id: string;
  recordingId: string;
  startTime: number;
  endTime: number;
  duration: number;
  averageDecibels: number;
  deleted: boolean;
  reviewed: boolean;
}

export interface Caption {
  id: string;
  recordingId: string;
  transcriptId: string;
  text: string;
  startTime: number;
  endTime: number;
  position: CaptionPosition;
  style: CaptionStyle;
}

export interface CaptionPosition {
  horizontal: 'left' | 'center' | 'right';
  vertical: 'top' | 'middle' | 'bottom';
  offsetX?: number;
  offsetY?: number;
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  bold: boolean;
  italic: boolean;
  outline: boolean;
  outlineColor?: string;
}

export interface BackgroundEffect {
  type: 'blur' | 'removal';
  enabled: boolean;
  blurIntensity?: number;
  replacementColor?: string;
  replacementImage?: string;
}

export interface AIProcessingJob {
  id: string;
  recordingId: string;
  type: AIJobType;
  status: JobStatus;
  progress: number;
  startedAt: number;
  completedAt?: number;
  error?: AIProcessingError;
  result?: unknown;
}

export type JobStatus =
  | 'queued'
  | 'loading_model'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AIProcessingError {
  type:
    | 'MODEL_LOAD_FAILED'
    | 'INFERENCE_ERROR'
    | 'NO_SPEECH'
    | 'QUOTA_EXCEEDED';
  message: string;
  details?: unknown;
}
