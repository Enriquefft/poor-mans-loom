/**
 * Storage Service Implementation
 *
 * localStorage-based persistence for AI-generated data.
 * Implements StorageService interface from contracts/storage-api.ts
 */

import { STORAGE_CONFIG } from '../ai/config';
import type {
  AIProcessingJob,
  BackgroundEffect,
  Caption,
  SilenceSegment,
  StorageBreakdown,
  StorageError,
  StorageResult,
  StorageStats,
  Transcript,
} from '../ai/types';

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  AI_JOBS: `${STORAGE_CONFIG.KEY_PREFIX}ai_jobs`,
  BG_EFFECTS: `${STORAGE_CONFIG.KEY_PREFIX}background_effects`,
  CAPTIONS: `${STORAGE_CONFIG.KEY_PREFIX}captions`,
  RECORDINGS: `${STORAGE_CONFIG.KEY_PREFIX}recordings`,
  SCHEMA_VERSION: `${STORAGE_CONFIG.KEY_PREFIX}schema_version`,
  SILENCE: `${STORAGE_CONFIG.KEY_PREFIX}silence`,
  TRANSCRIPTS: `${STORAGE_CONFIG.KEY_PREFIX}transcripts`,
} as const;

// ============================================================================
// Storage Service Class
// ============================================================================

export class StorageService {
  constructor() {
    this.initializeSchema();
  }

  /**
   * Initialize storage schema version
   */
  private initializeSchema(): void {
    const currentVersion = localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION);
    if (!currentVersion) {
      localStorage.setItem(
        STORAGE_KEYS.SCHEMA_VERSION,
        String(STORAGE_CONFIG.SCHEMA_VERSION),
      );
    }
  }

  // ==========================================================================
  // Transcript Operations
  // ==========================================================================

  /**
   * Save transcript to localStorage
   */
  async saveTranscript(transcript: Transcript): Promise<StorageResult> {
    try {
      const key = this.getTranscriptKey(transcript.recordingId);
      const data = JSON.stringify(transcript);

      // Check quota before saving
      const quotaCheck = this.checkQuota(data.length);
      if (!quotaCheck.success) {
        return quotaCheck;
      }

      localStorage.setItem(key, data);
      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        return this.createQuotaError();
      }
      return this.createSerializationError(error);
    }
  }

  /**
   * Retrieve transcript by recording ID
   */
  getTranscript(recordingId: string): Transcript | null {
    try {
      const key = this.getTranscriptKey(recordingId);
      const data = localStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data) as Transcript;
    } catch {
      return null;
    }
  }

  /**
   * Update existing transcript
   */
  async updateTranscript(transcript: Transcript): Promise<StorageResult> {
    return this.saveTranscript(transcript);
  }

  /**
   * Delete transcript
   */
  async deleteTranscript(recordingId: string): Promise<void> {
    const key = this.getTranscriptKey(recordingId);
    localStorage.removeItem(key);
  }

  // ==========================================================================
  // Silence Segment Operations
  // ==========================================================================

  /**
   * Save silence segments
   */
  async saveSilenceSegments(
    recordingId: string,
    segments: SilenceSegment[],
  ): Promise<StorageResult> {
    try {
      const key = this.getSilenceKey(recordingId);
      const data = JSON.stringify(segments);

      const quotaCheck = this.checkQuota(data.length);
      if (!quotaCheck.success) {
        return quotaCheck;
      }

      localStorage.setItem(key, data);
      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        return this.createQuotaError();
      }
      return this.createSerializationError(error);
    }
  }

  /**
   * Retrieve silence segments
   */
  getSilenceSegments(recordingId: string): SilenceSegment[] {
    try {
      const key = this.getSilenceKey(recordingId);
      const data = localStorage.getItem(key);
      if (!data) return [];
      return JSON.parse(data) as SilenceSegment[];
    } catch {
      return [];
    }
  }

  // ==========================================================================
  // Caption Operations
  // ==========================================================================

  /**
   * Save captions
   */
  async saveCaptions(
    recordingId: string,
    captions: Caption[],
  ): Promise<StorageResult> {
    try {
      const key = this.getCaptionsKey(recordingId);
      const data = JSON.stringify(captions);

      const quotaCheck = this.checkQuota(data.length);
      if (!quotaCheck.success) {
        return quotaCheck;
      }

      localStorage.setItem(key, data);
      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        return this.createQuotaError();
      }
      return this.createSerializationError(error);
    }
  }

  /**
   * Retrieve captions
   */
  getCaptions(recordingId: string): Caption[] {
    try {
      const key = this.getCaptionsKey(recordingId);
      const data = localStorage.getItem(key);
      if (!data) return [];
      return JSON.parse(data) as Caption[];
    } catch {
      return [];
    }
  }

  // ==========================================================================
  // Background Effect Operations
  // ==========================================================================

  /**
   * Save background effect settings
   */
  async saveBackgroundEffect(
    recordingId: string,
    effect: BackgroundEffect,
  ): Promise<StorageResult> {
    try {
      const key = this.getBackgroundEffectKey(recordingId);
      const data = JSON.stringify(effect);

      const quotaCheck = this.checkQuota(data.length);
      if (!quotaCheck.success) {
        return quotaCheck;
      }

      localStorage.setItem(key, data);
      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        return this.createQuotaError();
      }
      return this.createSerializationError(error);
    }
  }

  /**
   * Retrieve background effect settings
   */
  getBackgroundEffect(recordingId: string): BackgroundEffect | null {
    try {
      const key = this.getBackgroundEffectKey(recordingId);
      const data = localStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data) as BackgroundEffect;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // AI Job Operations
  // ==========================================================================

  /**
   * Save AI processing job
   */
  async saveAIJob(job: AIProcessingJob): Promise<StorageResult> {
    try {
      const jobs = this.getAIJobs(job.recordingId);
      const existingIndex = jobs.findIndex((j) => j.id === job.id);

      if (existingIndex >= 0) {
        jobs[existingIndex] = job;
      } else {
        jobs.push(job);
      }

      const key = this.getAIJobsKey(job.recordingId);
      const data = JSON.stringify(jobs);

      const quotaCheck = this.checkQuota(data.length);
      if (!quotaCheck.success) {
        return quotaCheck;
      }

      localStorage.setItem(key, data);
      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        return this.createQuotaError();
      }
      return this.createSerializationError(error);
    }
  }

  /**
   * Retrieve AI jobs for recording
   */
  getAIJobs(recordingId: string): AIProcessingJob[] {
    try {
      const key = this.getAIJobsKey(recordingId);
      const data = localStorage.getItem(key);
      if (!data) return [];
      return JSON.parse(data) as AIProcessingJob[];
    } catch {
      return [];
    }
  }

  /**
   * Update AI job status
   */
  async updateAIJob(
    jobId: string,
    updates: Partial<AIProcessingJob>,
  ): Promise<StorageResult> {
    try {
      // Find job across all recordings
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.includes(STORAGE_KEYS.AI_JOBS)) continue;

        const jobs = JSON.parse(
          localStorage.getItem(key) || '[]',
        ) as AIProcessingJob[];
        const jobIndex = jobs.findIndex((j) => j.id === jobId);

        if (jobIndex >= 0) {
          jobs[jobIndex] = { ...jobs[jobIndex], ...updates };
          localStorage.setItem(key, JSON.stringify(jobs));
          return { success: true };
        }
      }

      return this.createNotFoundError();
    } catch (error) {
      return this.createSerializationError(error);
    }
  }

  // ==========================================================================
  // Storage Statistics
  // ==========================================================================

  /**
   * Get storage usage statistics
   */
  getStorageStats(): StorageStats {
    let totalBytes = 0;
    const breakdown: StorageBreakdown = {
      aiJobs: 0,
      captions: 0,
      other: 0,
      silenceSegments: 0,
      transcripts: 0,
    };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const value = localStorage.getItem(key);
      if (!value) continue;

      const bytes = new Blob([value]).size;
      totalBytes += bytes;

      if (key.includes(STORAGE_KEYS.TRANSCRIPTS)) {
        breakdown.transcripts += bytes;
      } else if (key.includes(STORAGE_KEYS.SILENCE)) {
        breakdown.silenceSegments += bytes;
      } else if (key.includes(STORAGE_KEYS.CAPTIONS)) {
        breakdown.captions += bytes;
      } else if (key.includes(STORAGE_KEYS.AI_JOBS)) {
        breakdown.aiJobs += bytes;
      } else if (key.startsWith(STORAGE_CONFIG.KEY_PREFIX)) {
        breakdown.other += bytes;
      }
    }

    const availableBytes = STORAGE_CONFIG.QUOTA_LIMIT_BYTES - totalBytes;
    const usagePercentage =
      (totalBytes / STORAGE_CONFIG.QUOTA_LIMIT_BYTES) * 100;

    const transcriptCount = this.countKeys(STORAGE_KEYS.TRANSCRIPTS);
    const recordingCount = this.countRecordings();

    return {
      availableBytes: Math.max(0, availableBytes),
      breakdown,
      recordingCount,
      totalBytes,
      transcriptCount,
      usagePercentage: Math.min(100, usagePercentage),
    };
  }

  // ==========================================================================
  // Cleanup Operations
  // ==========================================================================

  /**
   * Clear all AI data for a recording
   */
  async clearRecordingData(recordingId: string): Promise<void> {
    await this.deleteTranscript(recordingId);
    localStorage.removeItem(this.getSilenceKey(recordingId));
    localStorage.removeItem(this.getCaptionsKey(recordingId));
    localStorage.removeItem(this.getBackgroundEffectKey(recordingId));
    localStorage.removeItem(this.getAIJobsKey(recordingId));
  }

  /**
   * Clear all stored data (factory reset)
   */
  async clearAll(): Promise<void> {
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith(STORAGE_CONFIG.KEY_PREFIX),
    );
    keys.forEach((key) => localStorage.removeItem(key));
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private getTranscriptKey(recordingId: string): string {
    return `${STORAGE_KEYS.TRANSCRIPTS}:${recordingId}`;
  }

  private getSilenceKey(recordingId: string): string {
    return `${STORAGE_KEYS.SILENCE}:${recordingId}`;
  }

  private getCaptionsKey(recordingId: string): string {
    return `${STORAGE_KEYS.CAPTIONS}:${recordingId}`;
  }

  private getBackgroundEffectKey(recordingId: string): string {
    return `${STORAGE_KEYS.BG_EFFECTS}:${recordingId}`;
  }

  private getAIJobsKey(recordingId: string): string {
    return `${STORAGE_KEYS.AI_JOBS}:${recordingId}`;
  }

  private checkQuota(additionalBytes: number): StorageResult {
    const stats = this.getStorageStats();
    if (stats.totalBytes + additionalBytes > STORAGE_CONFIG.QUOTA_LIMIT_BYTES) {
      return this.createQuotaError();
    }
    return { success: true };
  }

  private countKeys(prefix: string): number {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.includes(prefix)) count++;
    }
    return count;
  }

  private countRecordings(): number {
    const recordingIds = new Set<string>();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_CONFIG.KEY_PREFIX)) continue;

      const parts = key.split(':');
      if (parts.length >= 2) {
        recordingIds.add(parts[parts.length - 1]);
      }
    }

    return recordingIds.size;
  }

  private createQuotaError(): StorageError {
    return {
      message:
        'Storage quota exceeded. Delete old recordings to free up space.',
      success: false,
      type: 'QUOTA_EXCEEDED',
    };
  }

  private createSerializationError(error: unknown): StorageError {
    return {
      details: error,
      message: error instanceof Error ? error.message : 'Serialization error',
      success: false,
      type: 'SERIALIZATION_ERROR',
    };
  }

  private createNotFoundError(): StorageError {
    return {
      message: 'Item not found in storage',
      success: false,
      type: 'NOT_FOUND',
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const storageService = new StorageService();
