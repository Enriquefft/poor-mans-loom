/**
 * Storage API Contract
 *
 * Type definitions for localStorage persistence layer.
 * Handles transcripts, captions, silence markers, and AI job state.
 */

// ============================================================================
// Storage Service Interface
// ============================================================================

export interface StorageService {
  /**
   * Save transcript to localStorage
   * @param transcript - Transcript to persist
   * @throws QuotaExceededError if storage full
   */
  saveTranscript(transcript: Transcript): Promise<StorageResult>;

  /**
   * Retrieve transcript by recording ID
   * @param recordingId - Recording identifier
   */
  getTranscript(recordingId: string): Transcript | null;

  /**
   * Update existing transcript
   * @param transcript - Updated transcript
   */
  updateTranscript(transcript: Transcript): Promise<StorageResult>;

  /**
   * Delete transcript
   * @param recordingId - Recording identifier
   */
  deleteTranscript(recordingId: string): Promise<void>;

  /**
   * Save silence segments
   * @param recordingId - Recording identifier
   * @param segments - Silence segments to persist
   */
  saveSilenceSegments(
    recordingId: string,
    segments: SilenceSegment[],
  ): Promise<StorageResult>;

  /**
   * Retrieve silence segments
   * @param recordingId - Recording identifier
   */
  getSilenceSegments(recordingId: string): SilenceSegment[];

  /**
   * Save captions
   * @param recordingId - Recording identifier
   * @param captions - Captions to persist
   */
  saveCaptions(
    recordingId: string,
    captions: Caption[],
  ): Promise<StorageResult>;

  /**
   * Retrieve captions
   * @param recordingId - Recording identifier
   */
  getCaptions(recordingId: string): Caption[];

  /**
   * Save background effect settings
   * @param recordingId - Recording identifier
   * @param effect - Effect configuration
   */
  saveBackgroundEffect(
    recordingId: string,
    effect: BackgroundEffect,
  ): Promise<StorageResult>;

  /**
   * Retrieve background effect settings
   * @param recordingId - Recording identifier
   */
  getBackgroundEffect(recordingId: string): BackgroundEffect | null;

  /**
   * Save AI processing job
   * @param job - Job to persist
   */
  saveAIJob(job: AIProcessingJob): Promise<StorageResult>;

  /**
   * Retrieve AI jobs for recording
   * @param recordingId - Recording identifier
   */
  getAIJobs(recordingId: string): AIProcessingJob[];

  /**
   * Update AI job status
   * @param jobId - Job identifier
   * @param updates - Partial job updates
   */
  updateAIJob(
    jobId: string,
    updates: Partial<AIProcessingJob>,
  ): Promise<StorageResult>;

  /**
   * Get storage usage statistics
   */
  getStorageStats(): StorageStats;

  /**
   * Clear all AI data for a recording
   * @param recordingId - Recording identifier
   */
  clearRecordingData(recordingId: string): Promise<void>;

  /**
   * Clear all stored data (factory reset)
   */
  clearAll(): Promise<void>;
}

// ============================================================================
// Result Types
// ============================================================================

export type StorageResult = { success: true } | StorageError;

export interface StorageError {
  success: false;
  type: 'QUOTA_EXCEEDED' | 'SERIALIZATION_ERROR' | 'NOT_FOUND';
  message: string;
  details?: unknown;
}

// ============================================================================
// Storage Statistics
// ============================================================================

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
// Storage Keys (Internal)
// ============================================================================

export const STORAGE_KEYS = {
  AI_JOBS: 'pmr:ai_jobs',
  BG_EFFECTS: 'pmr:background_effects',
  CAPTIONS: 'pmr:captions',
  RECORDINGS: 'pmr:recordings',
  SCHEMA_VERSION: 'pmr:schema_version',
  SILENCE: 'pmr:silence',
  TRANSCRIPTS: 'pmr:transcripts',
} as const;

export const CURRENT_SCHEMA_VERSION = 1;

// ============================================================================
// Migration Support
// ============================================================================

export interface StorageMigration {
  fromVersion: number;
  toVersion: number;
  migrate(data: unknown): unknown;
}

export interface MigrationService {
  /**
   * Check if migration needed
   */
  needsMigration(): boolean;

  /**
   * Run migrations to current version
   */
  runMigrations(): Promise<void>;

  /**
   * Get current schema version
   */
  getCurrentVersion(): number;
}

// ============================================================================
// Shared Types (imported from ai-services.ts)
// ============================================================================

import type {
  AIProcessingJob,
  BackgroundEffect,
  Caption,
  SilenceSegment,
  Transcript,
} from './ai-services';

export type {
  Transcript,
  SilenceSegment,
  Caption,
  BackgroundEffect,
  AIProcessingJob,
};
