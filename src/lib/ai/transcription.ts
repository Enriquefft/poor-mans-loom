/**
 * Transcription Service
 *
 * Client-side speech-to-text using Whisper model via Web Workers.
 * Implements TranscriptionService interface from contracts.
 */

import { ERROR_MESSAGES, TRANSCRIPTION_CONFIG } from './config';
import { flagLowConfidenceSegments } from './state-helpers';
import type {
  Transcript,
  TranscriptionError,
  TranscriptionResult,
  TranscriptMetadata,
  TranscriptSegment,
  TranscriptWord,
} from './types';

// ============================================================================
// Internal Types
// ============================================================================

interface WhisperChunk {
  text: string;
  timestamp?: [number, number];
}

interface WhisperOutput {
  text: string;
  chunks?: WhisperChunk[];
}

// ============================================================================
// Service Class
// ============================================================================

export class TranscriptionService {
  private worker: Worker | null = null;
  private isReady = false;
  private modelVersion = '';

  /**
   * Initialize Whisper model in Web Worker
   */
  async initialize(): Promise<
    { success: true; modelVersion: string } | TranscriptionError
  > {
    if (this.isReady && this.worker) {
      return { modelVersion: this.modelVersion, success: true };
    }

    try {
      // Create Web Worker
      this.worker = new Worker(
        new URL('./transcription-worker.ts', import.meta.url),
        { type: 'module' },
      );

      // Wait for ready message
      const result = await new Promise<
        { success: true; modelVersion: string } | TranscriptionError
      >((resolve) => {
        if (!this.worker) {
          resolve({
            message: ERROR_MESSAGES.MODEL_LOAD_FAILED,
            success: false,
            type: 'MODEL_LOAD_FAILED',
          });
          return;
        }

        this.worker.onmessage = (event) => {
          const { type, modelVersion, error } = event.data;

          if (type === 'ready') {
            this.isReady = true;
            this.modelVersion = modelVersion;
            resolve({ modelVersion, success: true });
          } else if (type === 'error') {
            resolve({
              details: error.details,
              message: error.message,
              success: false,
              type: error.type,
            });
          }
        };

        this.worker.onerror = (error) => {
          resolve({
            details: error,
            message: error.message || ERROR_MESSAGES.MODEL_LOAD_FAILED,
            success: false,
            type: 'MODEL_LOAD_FAILED',
          });
        };

        // Send init message
        this.worker.postMessage({ type: 'init' });
      });

      return result;
    } catch (error) {
      return {
        details: error,
        message:
          error instanceof Error
            ? error.message
            : ERROR_MESSAGES.MODEL_LOAD_FAILED,
        success: false,
        type: 'MODEL_LOAD_FAILED',
      };
    }
  }

  /**
   * Transcribe audio blob to text with timestamps
   */
  async transcribe(
    audioBlob: Blob,
    options?: {
      language?: string;
      chunkLengthSec?: number;
      strideLengthSec?: number;
      returnTimestamps?: 'word' | 'segment';
    },
    progressCallback?: (progress: number, status: string) => void,
  ): Promise<TranscriptionResult> {
    if (!this.isReady || !this.worker) {
      return {
        message: 'Transcription service not initialized',
        success: false,
        type: 'MODEL_LOAD_FAILED',
      };
    }

    try {
      const startTime = Date.now();

      // Convert blob to ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Send transcription request
      this.worker.postMessage(
        {
          audioData: arrayBuffer,
          options,
          type: 'transcribe',
        },
        [arrayBuffer],
      ); // Transfer ownership for performance

      // Wait for result
      const result = await new Promise<TranscriptionResult>((resolve) => {
        if (!this.worker) {
          resolve({
            message: ERROR_MESSAGES.MODEL_LOAD_FAILED,
            success: false,
            type: 'MODEL_LOAD_FAILED',
          });
          return;
        }

        this.worker.onmessage = (event) => {
          const { type, data, progress, status, error } = event.data;

          if (type === 'progress' && progressCallback) {
            progressCallback(progress, status);
          } else if (type === 'result') {
            const processingDuration = (Date.now() - startTime) / 1000;
            const transcript = this.formatTranscript(data, processingDuration);
            resolve({ success: true, transcript });
          } else if (type === 'error') {
            resolve({
              details: error.details,
              message: error.message,
              success: false,
              type: error.type,
            });
          }
        };

        this.worker.onerror = (error) => {
          resolve({
            details: error,
            message: error.message || ERROR_MESSAGES.INFERENCE_ERROR,
            success: false,
            type: 'INFERENCE_ERROR',
          });
        };
      });

      return result;
    } catch (error) {
      return {
        details: error,
        message:
          error instanceof Error
            ? error.message
            : ERROR_MESSAGES.INFERENCE_ERROR,
        success: false,
        type: 'INFERENCE_ERROR',
      };
    }
  }

  /**
   * Check if model is loaded and ready
   */
  isModelReady(): boolean {
    return this.isReady;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.modelVersion = '';
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Format Whisper output to Transcript type
   */
  private formatTranscript(
    whisperOutput: WhisperOutput,
    processingDuration: number,
  ): Transcript {
    const recordingId = `rec_${Date.now()}`; // Will be replaced with actual recording ID
    const transcriptId = `transcript_${Date.now()}`;

    // Extract segments from Whisper output
    const segments: TranscriptSegment[] = [];
    const chunks = Array.isArray(whisperOutput.chunks)
      ? whisperOutput.chunks
      : [whisperOutput];

    let segmentId = 0;
    let totalWords = 0;
    let totalConfidence = 0;
    let lowConfidenceCount = 0;

    for (const chunk of chunks) {
      const words: TranscriptWord[] = [];

      // Extract word-level timestamps if available
      if (chunk.timestamp && Array.isArray(chunk.timestamp)) {
        const [startTime, endTime] = chunk.timestamp;
        words.push({
          confidence: 1.0, // Whisper doesn't provide word confidence
          endTime: endTime || 0,
          startTime: startTime || 0,
          text: chunk.text,
        });
      }

      const segment: TranscriptSegment = {
        confidence: 1.0, // Whisper doesn't expose confidence, default to 1.0
        edited: false,
        endTime: chunk.timestamp?.[1] || 0,
        flagged: false,
        id: `seg_${segmentId++}`,
        startTime: chunk.timestamp?.[0] || 0,
        text: chunk.text || '',
        words,
      };

      totalWords += words.length;
      totalConfidence += segment.confidence;

      if (segment.confidence < TRANSCRIPTION_CONFIG.CONFIDENCE_THRESHOLD) {
        lowConfidenceCount++;
      }

      segments.push(segment);
    }

    const metadata: TranscriptMetadata = {
      averageConfidence:
        segments.length > 0 ? totalConfidence / segments.length : 0,
      lowConfidenceSegments: lowConfidenceCount,
      modelVersion: this.modelVersion,
      processingDuration,
      totalDuration: segments[segments.length - 1]?.endTime || 0,
      wordCount: totalWords,
    };

    const transcript: Transcript = {
      createdAt: Date.now(),
      id: transcriptId,
      language: TRANSCRIPTION_CONFIG.DEFAULT_LANGUAGE,
      metadata,
      recordingId,
      segments,
      updatedAt: Date.now(),
    };

    // Flag low confidence segments
    return flagLowConfidenceSegments(
      transcript,
      TRANSCRIPTION_CONFIG.CONFIDENCE_THRESHOLD,
    );
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const transcriptionService = new TranscriptionService();
