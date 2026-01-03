/**
 * AI Transcription Tests
 *
 * Unit tests for transcript export and confidence flagging.
 */

import { describe, expect, it } from 'vitest';
import { flagLowConfidenceSegments } from '@/lib/ai/state-helpers';
import type { Transcript } from '@/lib/ai/types';
import { toSRT, toTXT, toVTT } from '@/lib/editor/transcript';

describe('Transcript Export', () => {
  const mockTranscript: Transcript = {
    createdAt: Date.now(),
    id: 'transcript_1',
    language: 'en',
    metadata: {
      averageConfidence: 0.92,
      lowConfidenceSegments: 0,
      modelVersion: 'Xenova/whisper-tiny.en',
      processingDuration: 10,
      totalDuration: 5,
      wordCount: 6,
    },
    recordingId: 'rec_1',
    segments: [
      {
        confidence: 0.95,
        edited: false,
        endTime: 2.5,
        flagged: false,
        id: 'seg_1',
        startTime: 0,
        text: 'Hello world',
        words: [],
      },
      {
        confidence: 0.88,
        edited: false,
        endTime: 5.0,
        flagged: false,
        id: 'seg_2',
        startTime: 2.5,
        text: 'This is a test',
        words: [],
      },
    ],
    updatedAt: Date.now(),
  };

  describe('toSRT', () => {
    it('should export to SRT format', () => {
      const srt = toSRT(mockTranscript);
      expect(srt).toContain('1\n');
      expect(srt).toContain('00:00:00,000 --> 00:00:02,500');
      expect(srt).toContain('Hello world');
      expect(srt).toContain('2\n');
      expect(srt).toContain('00:00:02,500 --> 00:00:05,000');
      expect(srt).toContain('This is a test');
    });

    it('should format timestamps correctly', () => {
      const srt = toSRT(mockTranscript);
      expect(srt).toMatch(/\d{2}:\d{2}:\d{2},\d{3}/);
    });
  });

  describe('toVTT', () => {
    it('should export to VTT format', () => {
      const vtt = toVTT(mockTranscript);
      expect(vtt).toContain('WEBVTT');
      expect(vtt).toContain('00:00:00.000 --> 00:00:02.500');
      expect(vtt).toContain('Hello world');
      expect(vtt).toContain('00:00:02.500 --> 00:00:05.000');
      expect(vtt).toContain('This is a test');
    });

    it('should use periods for milliseconds', () => {
      const vtt = toVTT(mockTranscript);
      expect(vtt).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
    });
  });

  describe('toTXT', () => {
    it('should export to plain text', () => {
      const txt = toTXT(mockTranscript);
      expect(txt).toBe('Hello world\nThis is a test');
    });

    it('should separate segments with newlines', () => {
      const txt = toTXT(mockTranscript);
      expect(txt.split('\n')).toHaveLength(2);
    });
  });
});

describe('Confidence Flagging', () => {
  const mockTranscript: Transcript = {
    createdAt: Date.now(),
    id: 'transcript_1',
    language: 'en',
    metadata: {
      averageConfidence: 0.73,
      lowConfidenceSegments: 0,
      modelVersion: 'Xenova/whisper-tiny.en',
      processingDuration: 10,
      totalDuration: 6,
      wordCount: 9,
    },
    recordingId: 'rec_1',
    segments: [
      {
        confidence: 0.95,
        edited: false,
        endTime: 2,
        flagged: false,
        id: 'seg_1',
        startTime: 0,
        text: 'High confidence segment',
        words: [],
      },
      {
        confidence: 0.65,
        edited: false,
        endTime: 4,
        flagged: false,
        id: 'seg_2',
        startTime: 2,
        text: 'Low confidence segment',
        words: [],
      },
      {
        confidence: 0.6,
        edited: false,
        endTime: 6,
        flagged: false,
        id: 'seg_3',
        startTime: 4,
        text: 'Another low confidence',
        words: [],
      },
    ],
    updatedAt: Date.now(),
  };

  it('should flag segments below threshold', () => {
    const flagged = flagLowConfidenceSegments(mockTranscript, 0.7);
    expect(flagged.segments[0].flagged).toBe(false); // 0.95 > 0.70
    expect(flagged.segments[1].flagged).toBe(true); // 0.65 < 0.70
    expect(flagged.segments[2].flagged).toBe(true); // 0.60 < 0.70
  });

  it('should not modify other segment properties', () => {
    const flagged = flagLowConfidenceSegments(mockTranscript, 0.7);
    expect(flagged.segments[0].text).toBe(mockTranscript.segments[0].text);
    expect(flagged.segments[0].confidence).toBe(
      mockTranscript.segments[0].confidence,
    );
  });

  it('should support custom thresholds', () => {
    const flagged = flagLowConfidenceSegments(mockTranscript, 0.8);
    expect(flagged.segments.filter((s) => s.flagged).length).toBe(2);
  });
});
