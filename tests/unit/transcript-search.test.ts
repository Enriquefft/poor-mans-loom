/**
 * Transcript Search Tests
 *
 * Unit tests for transcript search functionality.
 */

import { describe, expect, it } from 'vitest';
import type { Transcript } from '@/lib/ai/types';
import { searchTranscript } from '@/lib/editor/transcript';

describe('searchTranscript', () => {
  const mockTranscript: Transcript = {
    createdAt: Date.now(),
    id: 'transcript_1',
    language: 'en',
    metadata: {
      averageConfidence: 0.92,
      lowConfidenceSegments: 0,
      modelVersion: 'Xenova/whisper-tiny.en',
      processingDuration: 10,
      totalDuration: 9,
      wordCount: 15,
    },
    recordingId: 'rec_1',
    segments: [
      {
        confidence: 0.95,
        edited: false,
        endTime: 3,
        flagged: false,
        id: 'seg_1',
        startTime: 0,
        text: 'Hello world, welcome to the test',
        words: [],
      },
      {
        confidence: 0.88,
        edited: false,
        endTime: 6,
        flagged: false,
        id: 'seg_2',
        startTime: 3,
        text: 'This is a test of the search functionality',
        words: [],
      },
      {
        confidence: 0.92,
        edited: false,
        endTime: 9,
        flagged: false,
        id: 'seg_3',
        startTime: 6,
        text: 'Testing is important for quality',
        words: [],
      },
    ],
    updatedAt: Date.now(),
  };

  it('should find case-insensitive matches', () => {
    const results = searchTranscript(mockTranscript, 'TEST');
    expect(results).toHaveLength(3);
    expect(results[0].segmentId).toBe('seg_1');
    expect(results[1].segmentId).toBe('seg_2');
    expect(results[2].segmentId).toBe('seg_3');
  });

  it('should find case-sensitive matches', () => {
    const results = searchTranscript(mockTranscript, 'test', {
      caseSensitive: true,
    });
    expect(results).toHaveLength(2);
    expect(results[0].text).toContain('test');
  });

  it('should find whole word matches', () => {
    const results = searchTranscript(mockTranscript, 'test', {
      wholeWord: true,
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.matches.some((m) => m.text === 'test'))).toBe(
      true,
    );
  });

  it('should return empty array for empty query', () => {
    const results = searchTranscript(mockTranscript, '');
    expect(results).toHaveLength(0);
  });

  it('should find multiple occurrences in same segment', () => {
    const transcript: Transcript = {
      ...mockTranscript,
      segments: [
        {
          confidence: 1,
          edited: false,
          endTime: 2,
          flagged: false,
          id: 'seg_1',
          startTime: 0,
          text: 'test test test',
          words: [],
        },
      ],
    };
    const results = searchTranscript(transcript, 'test');
    expect(results).toHaveLength(1);
    expect(results[0].matches).toHaveLength(3);
  });

  it('should provide match positions', () => {
    const results = searchTranscript(mockTranscript, 'test');
    expect(results[0].matches[0]).toHaveProperty('start');
    expect(results[0].matches[0]).toHaveProperty('end');
    expect(results[0].matches[0]).toHaveProperty('text');
  });
});
