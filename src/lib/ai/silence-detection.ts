/**
 * Silence Detection Service
 *
 * Client-side silence detection using Web Audio AnalyserNode.
 * Supports both real-time monitoring and post-recording analysis.
 */

import { SILENCE_DETECTION_CONFIG } from './config';
import type { SilenceSegment } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SilenceDetectionOptions {
  thresholdDb?: number; // Audio threshold in dB (default: -40)
  minDurationSec?: number; // Minimum silence duration (default: 2.0)
  smoothingTimeConstant?: number; // AnalyserNode smoothing (default: 0.8)
}

export interface SilenceDetectionResult {
  success: true;
  segments: SilenceSegment[];
  totalSilenceDuration: number; // Total silence time in seconds
  silencePercentage: number; // % of recording that is silence
}

export type SilenceDetectionError =
  | { success: false; type: 'INVALID_AUDIO'; message: string }
  | { success: false; type: 'ANALYSIS_ERROR'; message: string };

export type SilenceDetectionOutcome =
  | SilenceDetectionResult
  | SilenceDetectionError;

// ============================================================================
// Service Class
// ============================================================================

export class SilenceDetectionService {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private silenceSegments: SilenceSegment[] = [];
  private currentSilenceStart: number | null = null;
  private isMonitoring = false;
  private recordingStartTime = 0;

  /**
   * T046: Initialize real-time silence monitoring during recording
   */
  async startRealTimeMonitoring(
    stream: MediaStream,
    options: SilenceDetectionOptions = {},
  ): Promise<{ success: true } | SilenceDetectionError> {
    try {
      // Create audio context and analyser
      this.audioContext = new AudioContext();
      this.analyserNode = this.audioContext.createAnalyser();

      // T047: Configure thresholds
      this.analyserNode.fftSize = SILENCE_DETECTION_CONFIG.FFT_SIZE;
      this.analyserNode.smoothingTimeConstant =
        options.smoothingTimeConstant ??
        SILENCE_DETECTION_CONFIG.SMOOTHING_TIME_CONSTANT;

      // Connect stream to analyser
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyserNode);

      // Initialize data array
      const bufferLength = this.analyserNode.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      // Reset state
      this.silenceSegments = [];
      this.currentSilenceStart = null;
      this.isMonitoring = true;
      this.recordingStartTime = Date.now();

      // Start monitoring loop
      this.monitorAudioLevel(options);

      return { success: true };
    } catch (error) {
      return {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to start silence monitoring',
        success: false,
        type: 'ANALYSIS_ERROR',
      };
    }
  }

  /**
   * Stop real-time monitoring and return detected silence segments
   */
  stopRealTimeMonitoring(): SilenceSegment[] {
    this.isMonitoring = false;

    // If currently in silence, close the segment
    if (this.currentSilenceStart !== null) {
      const endTime = (Date.now() - this.recordingStartTime) / 1000;
      this.closeCurrentSilenceSegment(endTime);
    }

    // Cleanup
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyserNode = null;
    this.dataArray = null;

    return this.silenceSegments;
  }

  /**
   * T048: Post-recording analysis mode for existing recordings
   */
  async analyzeRecording(
    audioBlob: Blob,
    recordingId: string,
    options: SilenceDetectionOptions = {},
  ): Promise<SilenceDetectionOutcome> {
    try {
      // Create audio context
      const audioContext = new AudioContext();

      // Decode audio data
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // T049: Generate silence segments with timestamps
      const segments = this.detectSilenceInBuffer(
        audioBuffer,
        recordingId,
        options,
      );

      const totalDuration = audioBuffer.duration;
      const totalSilenceDuration = segments.reduce(
        (sum, seg) => sum + seg.duration,
        0,
      );
      const silencePercentage =
        totalDuration > 0 ? (totalSilenceDuration / totalDuration) * 100 : 0;

      // Cleanup
      await audioContext.close();

      return {
        segments,
        silencePercentage,
        success: true,
        totalSilenceDuration,
      };
    } catch (error) {
      return {
        message:
          error instanceof Error ? error.message : 'Failed to analyze audio',
        success: false,
        type: 'INVALID_AUDIO',
      };
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Monitor audio level in real-time using requestAnimationFrame
   */
  private monitorAudioLevel(options: SilenceDetectionOptions): void {
    if (!this.isMonitoring || !this.analyserNode || !this.dataArray) {
      return;
    }

    // Get time domain data (waveform)
    this.analyserNode.getByteTimeDomainData(this.dataArray);

    // Calculate average volume level
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const normalized = (this.dataArray[i] - 128) / 128; // Normalize to -1 to 1
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / this.dataArray.length);
    const db = 20 * Math.log10(rms);

    // T047: Check against threshold
    const thresholdDb =
      options.thresholdDb ?? SILENCE_DETECTION_CONFIG.THRESHOLD_DB;
    const currentTime = (Date.now() - this.recordingStartTime) / 1000;
    const isSilent = db < thresholdDb;

    if (isSilent) {
      // Start new silence segment if not already in one
      if (this.currentSilenceStart === null) {
        this.currentSilenceStart = currentTime;
      }
    } else {
      // End silence segment if we were in one
      if (this.currentSilenceStart !== null) {
        this.closeCurrentSilenceSegment(currentTime, options);
      }
    }

    // Continue monitoring
    requestAnimationFrame(() => this.monitorAudioLevel(options));
  }

  /**
   * Close current silence segment and add to array if it meets minimum duration
   */
  private closeCurrentSilenceSegment(
    endTime: number,
    options: SilenceDetectionOptions = {},
  ): void {
    if (this.currentSilenceStart === null) {
      return;
    }

    const duration = endTime - this.currentSilenceStart;
    const minDuration =
      options.minDurationSec ?? SILENCE_DETECTION_CONFIG.MIN_DURATION_SEC;

    // T047: Only add segment if it meets minimum duration
    if (duration >= minDuration) {
      const segment: SilenceSegment = {
        averageDecibels: 0, // Not available in real-time mode
        deleted: false,
        duration,
        endTime,
        id: `silence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        recordingId: 'recording_id', // Will be set by caller
        reviewed: false,
        startTime: this.currentSilenceStart,
      };
      this.silenceSegments.push(segment);
    }

    this.currentSilenceStart = null;
  }

  /**
   * Detect silence in pre-recorded audio buffer
   */
  private detectSilenceInBuffer(
    audioBuffer: AudioBuffer,
    recordingId: string,
    options: SilenceDetectionOptions,
  ): SilenceSegment[] {
    const thresholdDb =
      options.thresholdDb ?? SILENCE_DETECTION_CONFIG.THRESHOLD_DB;
    const minDuration =
      options.minDurationSec ?? SILENCE_DETECTION_CONFIG.MIN_DURATION_SEC;

    // Get audio data (use first channel for simplicity)
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Window size for analysis (100ms)
    const windowSize = Math.floor(sampleRate * 0.1);
    const segments: SilenceSegment[] = [];
    let silenceStart: number | null = null;
    let silenceDecibelSum = 0;
    let silenceSampleCount = 0;

    // Analyze audio in windows
    for (let i = 0; i < channelData.length; i += windowSize) {
      const windowEnd = Math.min(i + windowSize, channelData.length);
      const windowData = channelData.slice(i, windowEnd);

      // Calculate RMS and convert to dB
      let sum = 0;
      for (let j = 0; j < windowData.length; j++) {
        sum += windowData[j] * windowData[j];
      }
      const rms = Math.sqrt(sum / windowData.length);
      const db = rms > 0 ? 20 * Math.log10(rms) : -100;

      const currentTime = i / sampleRate;
      const isSilent = db < thresholdDb;

      if (isSilent) {
        if (silenceStart === null) {
          silenceStart = currentTime;
        }
        silenceDecibelSum += db;
        silenceSampleCount += windowData.length;
      } else {
        if (silenceStart !== null) {
          const silenceEnd = currentTime;
          const duration = silenceEnd - silenceStart;

          if (duration >= minDuration) {
            const segment: SilenceSegment = {
              averageDecibels:
                silenceSampleCount > 0
                  ? silenceDecibelSum / silenceSampleCount
                  : thresholdDb,
              deleted: false,
              duration,
              endTime: silenceEnd,
              id: `silence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              recordingId,
              reviewed: false,
              startTime: silenceStart,
            };
            segments.push(segment);
          }

          silenceStart = null;
          silenceDecibelSum = 0;
          silenceSampleCount = 0;
        }
      }
    }

    // Close final segment if recording ended in silence
    if (silenceStart !== null) {
      const silenceEnd = audioBuffer.duration;
      const duration = silenceEnd - silenceStart;

      if (duration >= minDuration) {
        const segment: SilenceSegment = {
          averageDecibels:
            silenceSampleCount > 0
              ? silenceDecibelSum / silenceSampleCount
              : thresholdDb,
          deleted: false,
          duration,
          endTime: silenceEnd,
          id: `silence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          recordingId,
          reviewed: false,
          startTime: silenceStart,
        };
        segments.push(segment);
      }
    }

    return segments;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const silenceDetectionService = new SilenceDetectionService();
