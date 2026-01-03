/**
 * Caption Generation Service
 *
 * Generates captions from transcripts with customizable styling.
 * Implements User Story 4 (Automated Caption Generation).
 *
 * Features:
 * - Generate captions from transcript segments
 * - Max 3-second caption duration for readability
 * - SRT and VTT export formats
 * - Auto-sync with transcript updates
 * - Customizable position and styling
 */

import { CAPTION_CONFIG } from './config';
import type { Caption, CaptionPosition, CaptionStyle, Transcript } from './types';

// ============================================================================
// Types
// ============================================================================

interface CaptionGenerationOptions {
  maxDuration?: number; // Max caption duration (seconds)
  position?: CaptionPosition;
  style?: CaptionStyle;
}

interface CaptionGenerationResult {
  success: true;
  captions: Caption[];
}

interface CaptionGenerationError {
  success: false;
  message: string;
}

type GenerateResult = CaptionGenerationResult | CaptionGenerationError;

// ============================================================================
// Caption Service Implementation
// ============================================================================

/**
 * Service for generating and managing captions
 * T104: CaptionService implementation
 */
class CaptionService {
  /**
   * T105: Generate captions from transcript
   *
   * Converts transcript segments into timed captions with optimal readability.
   * Ensures captions don't exceed max duration for comfortable reading pace.
   */
  generate(
    transcript: Transcript,
    options: CaptionGenerationOptions = {},
  ): GenerateResult {
    if (!transcript || !transcript.segments || transcript.segments.length === 0) {
      return {
        message: 'Transcript is empty or invalid',
        success: false,
      };
    }

    const maxDuration = options.maxDuration ?? CAPTION_CONFIG.MAX_DURATION_SEC;
    const position = options.position ?? CAPTION_CONFIG.DEFAULT_POSITION;
    const style = options.style ?? CAPTION_CONFIG.DEFAULT_STYLE;

    const captions: Caption[] = [];

    // T106: Segment captions by max duration
    for (const segment of transcript.segments) {
      const segmentDuration = segment.endTime - segment.startTime;

      if (segmentDuration <= maxDuration) {
        // Single caption for short segments
        captions.push({
          endTime: segment.endTime,
          id: crypto.randomUUID(),
          position,
          recordingId: transcript.recordingId,
          startTime: segment.startTime,
          style,
          text: segment.text.trim(),
          transcriptId: transcript.id,
        });
      } else {
        // T106: Split long segments into multiple captions
        const splitCaptions = this.splitSegmentBySentences(
          segment.text,
          segment.startTime,
          segment.endTime,
          maxDuration,
        );

        for (const splitCaption of splitCaptions) {
          captions.push({
            endTime: splitCaption.endTime,
            id: crypto.randomUUID(),
            position,
            recordingId: transcript.recordingId,
            startTime: splitCaption.startTime,
            style,
            text: splitCaption.text,
            transcriptId: transcript.id,
          });
        }
      }
    }

    return {
      captions,
      success: true,
    };
  }

  /**
   * T106: Split long segment into multiple captions
   *
   * Uses sentence boundaries and word timing for natural splits.
   * Ensures each caption is <= maxDuration seconds.
   */
  private splitSegmentBySentences(
    text: string,
    startTime: number,
    endTime: number,
    maxDuration: number,
  ): Array<{ text: string; startTime: number; endTime: number }> {
    const totalDuration = endTime - startTime;
    const words = text.split(/\s+/);
    const timePerWord = totalDuration / words.length;

    // Split by sentences first
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const captions: Array<{ text: string; startTime: number; endTime: number }> = [];

    let currentTime = startTime;
    let currentWords = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(/\s+/).length;
      const sentenceDuration = sentenceWords * timePerWord;

      if (sentenceDuration <= maxDuration) {
        // Sentence fits in one caption
        captions.push({
          endTime: Math.min(currentTime + sentenceDuration, endTime),
          startTime: currentTime,
          text: sentence.trim(),
        });
        currentTime += sentenceDuration;
        currentWords += sentenceWords;
      } else {
        // Split long sentence by word count
        const wordsInSentence = sentence.trim().split(/\s+/);
        const wordsPerCaption = Math.ceil(maxDuration / timePerWord);

        for (let i = 0; i < wordsInSentence.length; i += wordsPerCaption) {
          const chunk = wordsInSentence.slice(i, i + wordsPerCaption);
          const chunkDuration = chunk.length * timePerWord;

          captions.push({
            endTime: Math.min(currentTime + chunkDuration, endTime),
            startTime: currentTime,
            text: chunk.join(' '),
          });

          currentTime += chunkDuration;
        }
        currentWords += sentenceWords;
      }
    }

    return captions;
  }

  /**
   * T107: Export captions to SRT format
   *
   * SRT (SubRip) format structure:
   * 1
   * 00:00:01,000 --> 00:00:03,500
   * Caption text here
   */
  toSRT(captions: Caption[]): string {
    if (!captions || captions.length === 0) {
      return '';
    }

    return captions
      .map((caption, index) => {
        const startTime = this.formatSRTTime(caption.startTime);
        const endTime = this.formatSRTTime(caption.endTime);

        return [
          index + 1,
          `${startTime} --> ${endTime}`,
          caption.text,
          '', // Empty line separator
        ].join('\n');
      })
      .join('\n');
  }

  /**
   * T108: Export captions to VTT format
   *
   * WebVTT format structure:
   * WEBVTT
   *
   * 00:00:01.000 --> 00:00:03.500
   * Caption text here
   */
  toVTT(captions: Caption[]): string {
    if (!captions || captions.length === 0) {
      return 'WEBVTT\n\n';
    }

    const cues = captions
      .map((caption) => {
        const startTime = this.formatVTTTime(caption.startTime);
        const endTime = this.formatVTTTime(caption.endTime);

        return [
          `${startTime} --> ${endTime}`,
          caption.text,
          '', // Empty line separator
        ].join('\n');
      })
      .join('\n');

    return `WEBVTT\n\n${cues}`;
  }

  /**
   * Export captions to plain text format
   * Each caption on a new line with timestamp prefix
   */
  toTXT(captions: Caption[]): string {
    if (!captions || captions.length === 0) {
      return '';
    }

    return captions
      .map((caption) => {
        const timestamp = this.formatTimestamp(caption.startTime);
        return `[${timestamp}] ${caption.text}`;
      })
      .join('\n');
  }

  /**
   * T109: Update captions when transcript is edited
   *
   * Regenerates captions from updated transcript while preserving
   * custom styling and position settings from existing captions.
   */
  updateFromTranscript(
    transcript: Transcript,
    existingCaptions: Caption[],
  ): GenerateResult {
    if (!existingCaptions || existingCaptions.length === 0) {
      // No existing captions, generate new ones
      return this.generate(transcript);
    }

    // Preserve style and position from first caption
    const referenceCaption = existingCaptions[0];

    return this.generate(transcript, {
      position: referenceCaption.position,
      style: referenceCaption.style,
    });
  }

  /**
   * Format time for SRT (HH:MM:SS,mmm)
   */
  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  }

  /**
   * Format time for VTT (HH:MM:SS.mmm)
   */
  private formatVTTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  /**
   * Format time for human-readable timestamp (MM:SS)
   */
  private formatTimestamp(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * Validate caption timing accuracy (±200ms tolerance)
   * Per SC-004 success criteria
   */
  validateTiming(
    captions: Caption[],
    transcript: Transcript,
  ): { valid: boolean; maxOffset: number } {
    let maxOffset = 0;

    for (const caption of captions) {
      // Find matching transcript segment
      const segment = transcript.segments.find(
        (seg) =>
          caption.startTime >= seg.startTime && caption.endTime <= seg.endTime,
      );

      if (segment) {
        const startOffset = Math.abs(caption.startTime - segment.startTime);
        const endOffset = Math.abs(caption.endTime - segment.endTime);
        maxOffset = Math.max(maxOffset, startOffset, endOffset);
      }
    }

    const valid = maxOffset * 1000 <= CAPTION_CONFIG.SYNC_ACCURACY_MS; // Convert to ms

    return { maxOffset, valid };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Singleton instance
 */
export const captionService = new CaptionService();
