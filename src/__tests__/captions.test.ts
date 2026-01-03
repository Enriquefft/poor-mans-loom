/**
 * Caption Service Tests
 *
 * T128: Unit test for caption generation from transcript
 * T129: Unit test for SRT format export
 * T130: Unit test for VTT format export
 * T131: Unit test for caption auto-update on transcript edit
 */

import { describe, expect, it } from 'vitest';
import { captionService } from '@/lib/ai/captions';
import { CAPTION_CONFIG } from '@/lib/ai/config';
import type { Caption, Transcript } from '@/lib/ai/types';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockTranscript: Transcript = {
  createdAt: Date.now(),
  id: 'transcript-1',
  language: 'en',
  metadata: {
    averageConfidence: 0.92,
    lowConfidenceSegments: 0,
    modelVersion: 'Xenova/whisper-tiny.en',
    processingDuration: 15.5,
    totalDuration: 45.0,
    wordCount: 150,
  },
  recordingId: 'rec-1',
  segments: [
    {
      confidence: 0.95,
      edited: false,
      endTime: 3.0,
      flagged: false,
      id: 'seg-1',
      startTime: 0.0,
      text: 'Hello and welcome to this video tutorial.',
      words: [
        { confidence: 0.96, endTime: 0.5, startTime: 0.0, text: 'Hello' },
        { confidence: 0.94, endTime: 1.0, startTime: 0.5, text: 'and' },
        { confidence: 0.95, endTime: 1.8, startTime: 1.0, text: 'welcome' },
        { confidence: 0.93, endTime: 2.0, startTime: 1.8, text: 'to' },
        { confidence: 0.97, endTime: 2.5, startTime: 2.0, text: 'this' },
        { confidence: 0.95, endTime: 2.8, startTime: 2.5, text: 'video' },
        { confidence: 0.96, endTime: 3.0, startTime: 2.8, text: 'tutorial' },
      ],
    },
    {
      confidence: 0.88,
      edited: false,
      endTime: 6.5,
      flagged: false,
      id: 'seg-2',
      startTime: 3.5,
      text: 'Today we will learn about screen recording.',
      words: [
        { confidence: 0.9, endTime: 3.8, startTime: 3.5, text: 'Today' },
        { confidence: 0.87, endTime: 4.0, startTime: 3.8, text: 'we' },
        { confidence: 0.88, endTime: 4.3, startTime: 4.0, text: 'will' },
        { confidence: 0.89, endTime: 4.7, startTime: 4.3, text: 'learn' },
        { confidence: 0.86, endTime: 5.0, startTime: 4.7, text: 'about' },
        { confidence: 0.88, endTime: 5.5, startTime: 5.0, text: 'screen' },
        { confidence: 0.9, endTime: 6.5, startTime: 5.5, text: 'recording' },
      ],
    },
    {
      confidence: 0.91,
      edited: false,
      endTime: 15.0,
      flagged: false,
      id: 'seg-3',
      startTime: 7.0,
      text: 'This is a very long segment that contains multiple sentences. It should be split into multiple captions because it exceeds the maximum caption duration. Each caption should be comfortable to read.',
      words: [],
    },
  ],
  updatedAt: Date.now(),
};

const mockTranscriptEdited: Transcript = {
  ...mockTranscript,
  segments: [
    {
      ...mockTranscript.segments[0],
      edited: true,
      text: 'Hello and welcome to this updated tutorial.',
    },
    mockTranscript.segments[1],
    mockTranscript.segments[2],
  ],
};

// ============================================================================
// T128: Caption Generation Tests
// ============================================================================

describe('CaptionService - Generation (T128)', () => {
  it('should generate captions from a valid transcript', () => {
    const result = captionService.generate(mockTranscript);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.captions).toBeDefined();
      expect(result.captions.length).toBeGreaterThan(0);

      // Check first caption
      const firstCaption = result.captions[0];
      expect(firstCaption.recordingId).toBe(mockTranscript.recordingId);
      expect(firstCaption.transcriptId).toBe(mockTranscript.id);
      expect(firstCaption.text).toBeTruthy();
      expect(firstCaption.startTime).toBeGreaterThanOrEqual(0);
      expect(firstCaption.endTime).toBeGreaterThan(firstCaption.startTime);
    }
  });

  it('should reject empty transcript', () => {
    const emptyTranscript: Transcript = {
      ...mockTranscript,
      segments: [],
    };

    const result = captionService.generate(emptyTranscript);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain('empty');
    }
  });

  it('should split long segments into multiple captions', () => {
    const result = captionService.generate(mockTranscript);

    expect(result.success).toBe(true);
    if (result.success) {
      // The long segment (seg-3) should be split into multiple captions
      const longSegmentCaptions = result.captions.filter(
        (c) => c.startTime >= 7.0 && c.endTime <= 15.0,
      );

      expect(longSegmentCaptions.length).toBeGreaterThan(1);
    }
  });

  it('should respect max caption duration (with tolerance)', () => {
    const result = captionService.generate(mockTranscript);

    expect(result.success).toBe(true);
    if (result.success) {
      for (const caption of result.captions) {
        const duration = caption.endTime - caption.startTime;
        // Allow small tolerance for rounding in word-based splitting (100ms)
        expect(duration).toBeLessThanOrEqual(
          CAPTION_CONFIG.MAX_DURATION_SEC + 0.1,
        );
      }
    }
  });

  it('should use default style and position', () => {
    const result = captionService.generate(mockTranscript);

    expect(result.success).toBe(true);
    if (result.success) {
      const firstCaption = result.captions[0];

      // Check style
      expect(firstCaption.style).toEqual(CAPTION_CONFIG.DEFAULT_STYLE);

      // Check position
      expect(firstCaption.position).toEqual(CAPTION_CONFIG.DEFAULT_POSITION);
    }
  });

  it('should accept custom style and position options', () => {
    const customStyle = {
      backgroundColor: '#FF0000AA',
      bold: true,
      fontColor: '#00FF00',
      fontFamily: 'Courier New',
      fontSize: 32,
      italic: false,
      outline: false,
    };

    const customPosition = {
      horizontal: 'left' as const,
      vertical: 'top' as const,
    };

    const result = captionService.generate(mockTranscript, {
      position: customPosition,
      style: customStyle,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const firstCaption = result.captions[0];
      expect(firstCaption.style).toEqual(customStyle);
      expect(firstCaption.position).toEqual(customPosition);
    }
  });

  it('should assign unique IDs to each caption', () => {
    const result = captionService.generate(mockTranscript);

    expect(result.success).toBe(true);
    if (result.success) {
      const ids = result.captions.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });
});

// ============================================================================
// T129: SRT Export Tests
// ============================================================================

describe('CaptionService - SRT Export (T129)', () => {
  let testCaptions: Caption[];

  // Create test captions
  testCaptions = [
    {
      endTime: 3.0,
      id: 'cap-1',
      position: CAPTION_CONFIG.DEFAULT_POSITION,
      recordingId: 'rec-1',
      startTime: 0.0,
      style: CAPTION_CONFIG.DEFAULT_STYLE,
      text: 'First caption text.',
      transcriptId: 'transcript-1',
    },
    {
      endTime: 6.5,
      id: 'cap-2',
      position: CAPTION_CONFIG.DEFAULT_POSITION,
      recordingId: 'rec-1',
      startTime: 3.5,
      style: CAPTION_CONFIG.DEFAULT_STYLE,
      text: 'Second caption text.',
      transcriptId: 'transcript-1',
    },
  ];

  it('should export captions to SRT format', () => {
    const srt = captionService.toSRT(testCaptions);

    expect(srt).toBeTruthy();
    expect(typeof srt).toBe('string');

    // Check SRT structure
    expect(srt).toContain('1\n'); // Sequence number
    expect(srt).toContain('00:00:00,000 --> 00:00:03,000'); // Timestamp
    expect(srt).toContain('First caption text.'); // Text
    expect(srt).toContain('2\n'); // Second sequence number
    expect(srt).toContain('00:00:03,500 --> 00:00:06,500'); // Second timestamp
    expect(srt).toContain('Second caption text.'); // Second text
  });

  it('should format SRT timestamps correctly', () => {
    const srt = captionService.toSRT(testCaptions);

    // SRT uses comma for milliseconds separator
    expect(srt).toMatch(/\d{2}:\d{2}:\d{2},\d{3}/);

    // Should have proper arrow separator
    expect(srt).toContain(' --> ');
  });

  it('should include blank lines between captions', () => {
    const srt = captionService.toSRT(testCaptions);

    // SRT format requires blank lines between caption blocks
    const lines = srt.split('\n');
    const blankLines = lines.filter((line) => line.trim() === '');
    expect(blankLines.length).toBeGreaterThan(0);
  });

  it('should return empty string for empty caption array', () => {
    const srt = captionService.toSRT([]);

    expect(srt).toBe('');
  });

  it('should handle captions with special characters', () => {
    const specialCaptions: Caption[] = [
      {
        ...testCaptions[0],
        text: 'This is a test with \'quotes\' and "double quotes".',
      },
    ];

    const srt = captionService.toSRT(specialCaptions);

    expect(srt).toContain(
      'This is a test with \'quotes\' and "double quotes".',
    );
  });
});

// ============================================================================
// T130: VTT Export Tests
// ============================================================================

describe('CaptionService - VTT Export (T130)', () => {
  let testCaptions: Caption[];

  // Create test captions
  testCaptions = [
    {
      endTime: 3.0,
      id: 'cap-1',
      position: CAPTION_CONFIG.DEFAULT_POSITION,
      recordingId: 'rec-1',
      startTime: 0.0,
      style: CAPTION_CONFIG.DEFAULT_STYLE,
      text: 'First caption text.',
      transcriptId: 'transcript-1',
    },
    {
      endTime: 6.5,
      id: 'cap-2',
      position: CAPTION_CONFIG.DEFAULT_POSITION,
      recordingId: 'rec-1',
      startTime: 3.5,
      style: CAPTION_CONFIG.DEFAULT_STYLE,
      text: 'Second caption text.',
      transcriptId: 'transcript-1',
    },
  ];

  it('should export captions to VTT format', () => {
    const vtt = captionService.toVTT(testCaptions);

    expect(vtt).toBeTruthy();
    expect(typeof vtt).toBe('string');

    // Check VTT header
    expect(vtt).toMatch(/^WEBVTT/);

    // Check timestamps and text
    expect(vtt).toContain('00:00:00.000 --> 00:00:03.000');
    expect(vtt).toContain('First caption text.');
    expect(vtt).toContain('00:00:03.500 --> 00:00:06.500');
    expect(vtt).toContain('Second caption text.');
  });

  it('should format VTT timestamps correctly', () => {
    const vtt = captionService.toVTT(testCaptions);

    // VTT uses period for milliseconds separator
    expect(vtt).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);

    // Should have proper arrow separator
    expect(vtt).toContain(' --> ');
  });

  it('should start with WEBVTT header', () => {
    const vtt = captionService.toVTT(testCaptions);

    expect(vtt.startsWith('WEBVTT')).toBe(true);
  });

  it('should return WEBVTT header for empty caption array', () => {
    const vtt = captionService.toVTT([]);

    expect(vtt).toBe('WEBVTT\n\n');
  });

  it('should handle captions with newlines in text', () => {
    const multilineCaptions: Caption[] = [
      {
        ...testCaptions[0],
        text: 'First line\nSecond line',
      },
    ];

    const vtt = captionService.toVTT(multilineCaptions);

    expect(vtt).toContain('First line\nSecond line');
  });
});

// ============================================================================
// T131: Caption Auto-Update Tests
// ============================================================================

describe('CaptionService - Auto-Update (T131)', () => {
  it('should regenerate captions from updated transcript', () => {
    // Generate initial captions
    const initialResult = captionService.generate(mockTranscript);
    expect(initialResult.success).toBe(true);

    if (initialResult.success) {
      // Update captions with edited transcript
      const updateResult = captionService.updateFromTranscript(
        mockTranscriptEdited,
        initialResult.captions,
      );

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        // Should have new captions
        expect(updateResult.captions).toBeDefined();
        expect(updateResult.captions.length).toBeGreaterThan(0);

        // First caption should reflect the updated text
        const firstCaption = updateResult.captions[0];
        expect(firstCaption.text).toContain('updated tutorial');
      }
    }
  });

  it('should preserve style from existing captions', () => {
    const customStyle = {
      backgroundColor: '#FF0000AA',
      bold: true,
      fontColor: '#00FF00',
      fontFamily: 'Courier New',
      fontSize: 32,
      italic: true,
      outline: true,
      outlineColor: '#000000',
    };

    // Generate captions with custom style
    const initialResult = captionService.generate(mockTranscript, {
      style: customStyle,
    });

    expect(initialResult.success).toBe(true);
    if (initialResult.success) {
      // Update with edited transcript
      const updateResult = captionService.updateFromTranscript(
        mockTranscriptEdited,
        initialResult.captions,
      );

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        // Style should be preserved
        const firstCaption = updateResult.captions[0];
        expect(firstCaption.style).toEqual(customStyle);
      }
    }
  });

  it('should preserve position from existing captions', () => {
    const customPosition = {
      horizontal: 'left' as const,
      vertical: 'top' as const,
    };

    // Generate captions with custom position
    const initialResult = captionService.generate(mockTranscript, {
      position: customPosition,
    });

    expect(initialResult.success).toBe(true);
    if (initialResult.success) {
      // Update with edited transcript
      const updateResult = captionService.updateFromTranscript(
        mockTranscriptEdited,
        initialResult.captions,
      );

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        // Position should be preserved
        const firstCaption = updateResult.captions[0];
        expect(firstCaption.position).toEqual(customPosition);
      }
    }
  });

  it('should generate new captions if none exist', () => {
    const result = captionService.updateFromTranscript(mockTranscript, []);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.captions.length).toBeGreaterThan(0);
    }
  });

  it('should update transcriptId to match new transcript', () => {
    const initialResult = captionService.generate(mockTranscript);
    expect(initialResult.success).toBe(true);

    if (initialResult.success) {
      const updateResult = captionService.updateFromTranscript(
        mockTranscriptEdited,
        initialResult.captions,
      );

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        // All captions should reference the new transcript
        for (const caption of updateResult.captions) {
          expect(caption.transcriptId).toBe(mockTranscriptEdited.id);
        }
      }
    }
  });
});

// ============================================================================
// Additional Tests
// ============================================================================

describe('CaptionService - Timing Validation', () => {
  it('should validate caption timing accuracy', () => {
    const result = captionService.generate(mockTranscript);

    expect(result.success).toBe(true);
    if (result.success) {
      const validation = captionService.validateTiming(
        result.captions,
        mockTranscript,
      );

      expect(validation).toBeDefined();
      expect(typeof validation.valid).toBe('boolean');
      expect(typeof validation.maxOffset).toBe('number');

      // Max offset should be a reasonable number
      expect(validation.maxOffset).toBeGreaterThanOrEqual(0);
      expect(validation.maxOffset).toBeLessThan(10); // Reasonable upper bound
    }
  });

  it('should return validation structure', () => {
    const result = captionService.generate(mockTranscript);

    expect(result.success).toBe(true);
    if (result.success) {
      const validation = captionService.validateTiming(
        result.captions,
        mockTranscript,
      );

      // Validation should return the expected structure
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('maxOffset');
      expect(typeof validation.valid).toBe('boolean');
      expect(typeof validation.maxOffset).toBe('number');
    }
  });
});

describe('CaptionService - TXT Export', () => {
  let testCaptions: Caption[];

  testCaptions = [
    {
      endTime: 3.0,
      id: 'cap-1',
      position: CAPTION_CONFIG.DEFAULT_POSITION,
      recordingId: 'rec-1',
      startTime: 0.0,
      style: CAPTION_CONFIG.DEFAULT_STYLE,
      text: 'First caption.',
      transcriptId: 'transcript-1',
    },
    {
      endTime: 65.5,
      id: 'cap-2',
      position: CAPTION_CONFIG.DEFAULT_POSITION,
      recordingId: 'rec-1',
      startTime: 63.0,
      style: CAPTION_CONFIG.DEFAULT_STYLE,
      text: 'Second caption.',
      transcriptId: 'transcript-1',
    },
  ];

  it('should export captions to plain text format', () => {
    const txt = captionService.toTXT(testCaptions);

    expect(txt).toBeTruthy();
    expect(typeof txt).toBe('string');

    // Should contain timestamps and text
    expect(txt).toContain('[00:00]');
    expect(txt).toContain('First caption.');
    expect(txt).toContain('[01:03]');
    expect(txt).toContain('Second caption.');
  });

  it('should return empty string for empty caption array', () => {
    const txt = captionService.toTXT([]);

    expect(txt).toBe('');
  });
});
