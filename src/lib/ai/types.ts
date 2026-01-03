/**
 * AI Services Type Definitions
 *
 * TypeScript interfaces for AI-generated data and service operations.
 * Implements contracts from specs/001-ai-transformer-features/contracts/
 */

// ============================================================================
// Transcript Types
// ============================================================================

export interface Transcript {
  id: string; // Unique identifier (UUIDv4)
  recordingId: string; // Foreign key to recording
  language: string; // ISO 639-1 code (e.g., 'en', 'es')
  createdAt: number; // Unix timestamp (milliseconds)
  updatedAt: number; // Unix timestamp (last edit)
  segments: TranscriptSegment[]; // Ordered array of speech segments
  metadata: TranscriptMetadata; // Processing metadata
}

export interface TranscriptSegment {
  id: string; // Unique segment identifier
  text: string; // Transcribed text content
  startTime: number; // Start timestamp (seconds)
  endTime: number; // End timestamp (seconds)
  confidence: number; // 0.0-1.0 (model confidence score)
  speaker?: string; // Optional speaker label ('Speaker 1', 'Speaker 2')
  words: TranscriptWord[]; // Word-level breakdown
  flagged: boolean; // True if confidence < 0.70 (FR-024)
  edited: boolean; // True if manually corrected by user
}

export interface TranscriptWord {
  text: string; // Individual word
  startTime: number; // Word start (seconds)
  endTime: number; // Word end (seconds)
  confidence: number; // Word-level confidence
}

export interface TranscriptMetadata {
  modelVersion: string; // e.g., 'Xenova/whisper-tiny.en'
  processingDuration: number; // Time taken to generate (seconds)
  totalDuration: number; // Audio duration (seconds)
  wordCount: number; // Total words in transcript
  averageConfidence: number; // Mean confidence across all segments
  lowConfidenceSegments: number; // Count of flagged segments
}

// ============================================================================
// Silence Detection Types
// ============================================================================

export interface SilenceSegment {
  id: string; // Unique identifier (UUIDv4)
  recordingId: string; // Foreign key to recording
  startTime: number; // Silence start (seconds)
  endTime: number; // Silence end (seconds)
  duration: number; // Computed: endTime - startTime
  averageDecibels: number; // Average audio level during segment (dB)
  deleted: boolean; // User decision: remove this segment
  reviewed: boolean; // User has seen and decided on segment
}

// ============================================================================
// Caption Types
// ============================================================================

export interface Caption {
  id: string; // Unique identifier (UUIDv4)
  recordingId: string; // Foreign key to recording
  transcriptId: string; // Foreign key to transcript (source of truth)
  text: string; // Caption text content
  startTime: number; // Display start (seconds)
  endTime: number; // Display end (seconds)
  position: CaptionPosition; // Screen position
  style: CaptionStyle; // Visual appearance
}

export interface CaptionPosition {
  horizontal: 'left' | 'center' | 'right'; // Horizontal alignment
  vertical: 'top' | 'middle' | 'bottom'; // Vertical alignment
  offsetX?: number; // Optional pixel offset from alignment
  offsetY?: number; // Optional pixel offset from alignment
}

export interface CaptionStyle {
  fontFamily: string; // Font name (e.g., 'Arial', 'Helvetica')
  fontSize: number; // Font size in pixels
  fontColor: string; // Hex color (e.g., '#FFFFFF')
  backgroundColor: string; // Hex color with alpha (e.g., '#000000AA')
  bold: boolean; // Bold text
  italic: boolean; // Italic text
  outline: boolean; // Text outline/stroke
  outlineColor?: string; // Outline color if enabled
}

// ============================================================================
// Background Effect Types
// ============================================================================

export interface BackgroundEffect {
  type: 'blur' | 'removal'; // Effect mode
  enabled: boolean; // Toggle on/off during recording
  blurIntensity?: number; // 0-100 (only for blur mode)
  replacementColor?: string; // Hex color (only for removal mode)
  replacementImage?: string; // Base64 image data (only for removal mode)
}

// ============================================================================
// AI Processing Job Types
// ============================================================================

export interface AIProcessingJob {
  id: string; // Unique identifier (UUIDv4)
  recordingId: string; // Foreign key to recording
  type: AIJobType; // Job type
  status: JobStatus; // Current state
  progress: number; // 0.0-1.0 (percentage complete)
  startedAt: number; // Unix timestamp (start)
  completedAt?: number; // Unix timestamp (completion)
  error?: AIProcessingError; // Error details if failed
  result?: unknown; // Typed result (Transcript | SilenceSegment[] | Caption[])
}

export type AIJobType =
  | 'transcription'
  | 'silence_detection'
  | 'caption_generation';

export type JobStatus =
  | 'queued' // Waiting to start
  | 'loading_model' // Downloading AI model
  | 'processing' // Active inference
  | 'completed' // Successfully finished
  | 'failed' // Error occurred
  | 'cancelled'; // User cancelled

export interface AIProcessingError {
  type:
    | 'MODEL_LOAD_FAILED'
    | 'INFERENCE_ERROR'
    | 'NO_SPEECH'
    | 'INVALID_AUDIO'
    | 'QUOTA_EXCEEDED'
    | 'GPU_UNAVAILABLE'
    | 'MEDIAPIPE_INIT_FAILED'
    | 'SEGMENTATION_ERROR';
  message: string; // Human-readable error
  details?: unknown; // Additional context (stack trace, etc.)
}

// ============================================================================
// Service Result Types (Type-Safe Error Handling)
// ============================================================================

export type TranscriptionResult =
  | { success: true; transcript: Transcript }
  | TranscriptionError;

export interface TranscriptionError {
  success: false;
  type: 'MODEL_LOAD_FAILED' | 'INFERENCE_ERROR' | 'NO_SPEECH' | 'INVALID_AUDIO';
  message: string;
  details?: unknown;
}

export type SilenceDetectionResult =
  | { success: true; segments: SilenceSegment[] }
  | SilenceDetectionError;

export interface SilenceDetectionError {
  success: false;
  type: 'AUDIO_CONTEXT_ERROR' | 'STREAM_ERROR';
  message: string;
  details?: unknown;
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
// Storage Types
// ============================================================================

export type StorageResult = { success: true } | StorageError;

export interface StorageError {
  success: false;
  type: 'QUOTA_EXCEEDED' | 'SERIALIZATION_ERROR' | 'NOT_FOUND';
  message: string;
  details?: unknown;
}

export interface StorageStats {
  totalBytes: number; // Total localStorage usage
  availableBytes: number; // Remaining quota
  usagePercentage: number; // 0-100
  recordingCount: number; // Number of recordings
  transcriptCount: number; // Number of transcripts
  breakdown: StorageBreakdown;
}

export interface StorageBreakdown {
  transcripts: number; // Bytes used by transcripts
  silenceSegments: number; // Bytes used by silence data
  captions: number; // Bytes used by captions
  aiJobs: number; // Bytes used by job state
  other: number; // Other data
}

// ============================================================================
// Derived/Computed Types
// ============================================================================

export interface TranscriptStats {
  wordCount: number; // Total words
  characterCount: number; // Total characters
  speakingDuration: number; // Non-silence time (seconds)
  averageConfidence: number; // Mean confidence
  lowConfidenceCount: number; // Flagged segments count
  speakerCount: number; // Distinct speakers detected
}

export interface SilenceStats {
  totalSilenceTime: number; // Sum of all silence durations (seconds)
  silencePercentage: number; // Silence / total duration
  longestSilence: number; // Max silence duration (seconds)
  segmentCount: number; // Total silence segments
  deletedCount: number; // Marked for removal
  timeSaved: number; // Total time to be removed (seconds)
}

// ============================================================================
// Type Guards
// ============================================================================

export function isTranscriptionSuccess(
  result: TranscriptionResult,
): result is { success: true; transcript: Transcript } {
  return result.success === true;
}

export function isTranscriptionError(
  result: TranscriptionResult,
): result is TranscriptionError {
  return result.success === false;
}

export function isSilenceDetectionSuccess(
  result: SilenceDetectionResult,
): result is { success: true; segments: SilenceSegment[] } {
  return result.success === true;
}

export function isSilenceDetectionError(
  result: SilenceDetectionResult,
): result is SilenceDetectionError {
  return result.success === false;
}

export function isSegmentationSuccess(
  result: SegmentationFrameResult,
): result is { success: true; processedFrame: ImageData } {
  return result.success === true;
}

export function isSegmentationError(
  result: SegmentationFrameResult,
): result is SegmentationError {
  return result.success === false;
}

export function isStorageSuccess(
  result: StorageResult,
): result is { success: true } {
  return result.success === true;
}

export function isStorageError(result: StorageResult): result is StorageError {
  return result.success === false;
}

export function isLowConfidenceSegment(segment: TranscriptSegment): boolean {
  return segment.confidence < 0.7;
}

export function isJobComplete(
  job: AIProcessingJob,
): job is AIProcessingJob & { result: unknown } {
  return job.status === 'completed' && job.result !== undefined;
}

export function isJobFailed(
  job: AIProcessingJob,
): job is AIProcessingJob & { error: AIProcessingError } {
  return job.status === 'failed' && job.error !== undefined;
}

export function shouldDeleteSegment(segment: SilenceSegment): boolean {
  return segment.deleted && segment.reviewed;
}
