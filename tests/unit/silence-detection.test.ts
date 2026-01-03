/**
 * Silence Detection Tests
 *
 * Unit tests for silence detection algorithm and configuration.
 */

import { describe, expect, it } from 'vitest';
import type { SilenceSegment } from '@/lib/ai/types';
import {
  batchDeleteSilence,
  createInitialEditorState,
  getNextSilenceSegment,
  getPreviousSilenceSegment,
  getSilenceSegmentAtTime,
  getTimeSavedBySilenceRemoval,
  getTotalSilenceDuration,
  markSilenceForDeletion,
} from '@/lib/editor/timeline';
import type { EditorState } from '@/lib/types';

describe('Silence Detection Algorithm', () => {
  const mockSilenceSegments: SilenceSegment[] = [
    {
      averageDecibels: -45,
      deleted: false,
      duration: 3.0,
      endTime: 8.0,
      id: 'silence_1',
      recordingId: 'rec_1',
      reviewed: false,
      startTime: 5.0,
    },
    {
      averageDecibels: -42,
      deleted: false,
      duration: 3.5,
      endTime: 18.5,
      id: 'silence_2',
      recordingId: 'rec_1',
      reviewed: false,
      startTime: 15.0,
    },
    {
      averageDecibels: -40,
      deleted: false,
      duration: 2.0,
      endTime: 27.0,
      id: 'silence_3',
      recordingId: 'rec_1',
      reviewed: false,
      startTime: 25.0,
    },
  ];

  const mockEditorState: EditorState = {
    ...createInitialEditorState(30),
    silenceSegments: mockSilenceSegments,
  };

  // T070: Test silence detection algorithm
  describe('markSilenceForDeletion', () => {
    it('should mark a single silence segment for deletion', () => {
      const updated = markSilenceForDeletion(
        mockEditorState,
        'silence_1',
        true,
      );

      expect(updated.silenceSegments).toBeDefined();
      expect(updated.silenceSegments?.[0].deleted).toBe(true);
      expect(updated.silenceSegments?.[0].reviewed).toBe(true);
      expect(updated.silenceSegments?.[1].deleted).toBe(false);
      expect(updated.silenceSegments?.[2].deleted).toBe(false);
    });

    it('should unmark a silence segment', () => {
      const markedState = markSilenceForDeletion(
        mockEditorState,
        'silence_1',
        true,
      );
      const unmarked = markSilenceForDeletion(markedState, 'silence_1', false);

      expect(unmarked.silenceSegments?.[0].deleted).toBe(false);
      expect(unmarked.silenceSegments?.[0].reviewed).toBe(true); // Still reviewed
    });

    it('should not modify other segments', () => {
      const updated = markSilenceForDeletion(
        mockEditorState,
        'silence_2',
        true,
      );

      expect(updated.silenceSegments?.[0].deleted).toBe(false);
      expect(updated.silenceSegments?.[1].deleted).toBe(true);
      expect(updated.silenceSegments?.[2].deleted).toBe(false);
    });

    it('should handle missing silenceSegments array', () => {
      const stateWithoutSilence = createInitialEditorState(30);
      const updated = markSilenceForDeletion(
        stateWithoutSilence,
        'silence_1',
        true,
      );

      expect(updated).toEqual(stateWithoutSilence); // Should return same state structure
    });
  });

  // T072: Test batch deletion logic
  describe('batchDeleteSilence', () => {
    it('should mark all silence segments for deletion', () => {
      const updated = batchDeleteSilence(mockEditorState, true);

      expect(updated.silenceSegments).toBeDefined();
      expect(updated.silenceSegments?.every((s) => s.deleted)).toBe(true);
      expect(updated.silenceSegments?.every((s) => s.reviewed)).toBe(true);
    });

    it('should unmark all silence segments', () => {
      const markedState = batchDeleteSilence(mockEditorState, true);
      const unmarked = batchDeleteSilence(markedState, false);

      expect(unmarked.silenceSegments?.every((s) => !s.deleted)).toBe(true);
      expect(unmarked.silenceSegments?.every((s) => s.reviewed)).toBe(true);
    });

    it('should preserve segment metadata', () => {
      const updated = batchDeleteSilence(mockEditorState, true);

      expect(updated.silenceSegments?.[0].id).toBe('silence_1');
      expect(updated.silenceSegments?.[0].duration).toBe(3.0);
      expect(updated.silenceSegments?.[1].startTime).toBe(15.0);
    });
  });

  describe('Silence Navigation', () => {
    it('should find next silence segment', () => {
      const next = getNextSilenceSegment(mockEditorState, 10.0);
      expect(next).not.toBeNull();
      expect(next?.id).toBe('silence_2');
      expect(next?.startTime).toBe(15.0);
    });

    it('should return null when no next silence', () => {
      const next = getNextSilenceSegment(mockEditorState, 28.0);
      expect(next).toBeNull();
    });

    it('should find previous silence segment', () => {
      const prev = getPreviousSilenceSegment(mockEditorState, 20.0);
      expect(prev).not.toBeNull();
      expect(prev?.id).toBe('silence_2');
      expect(prev?.startTime).toBe(15.0);
    });

    it('should return null when no previous silence', () => {
      const prev = getPreviousSilenceSegment(mockEditorState, 3.0);
      expect(prev).toBeNull();
    });

    it('should find silence segment at specific time', () => {
      const atTime = getSilenceSegmentAtTime(mockEditorState, 16.0);
      expect(atTime).not.toBeNull();
      expect(atTime?.id).toBe('silence_2');
    });

    it('should return null when time is not in silence', () => {
      const atTime = getSilenceSegmentAtTime(mockEditorState, 10.0);
      expect(atTime).toBeNull();
    });
  });

  // T071: Test threshold configuration
  describe('Silence Duration Calculations', () => {
    it('should calculate total silence duration', () => {
      const total = getTotalSilenceDuration(mockEditorState);
      expect(total).toBe(8.5); // 3.0 + 3.5 + 2.0
    });

    it('should calculate time saved by removal', () => {
      const partiallyDeleted: EditorState = {
        ...mockEditorState,
        silenceSegments: [
          { ...mockSilenceSegments[0], deleted: true },
          { ...mockSilenceSegments[1], deleted: false },
          { ...mockSilenceSegments[2], deleted: true },
        ],
      };

      const saved = getTimeSavedBySilenceRemoval(partiallyDeleted);
      expect(saved).toBe(5.0); // 3.0 + 2.0
    });

    it('should return 0 when no silence segments', () => {
      const noSilence = createInitialEditorState(30);
      const total = getTotalSilenceDuration(noSilence);
      expect(total).toBe(0);
    });

    it('should return 0 when no deleted silence', () => {
      const saved = getTimeSavedBySilenceRemoval(mockEditorState);
      expect(saved).toBe(0); // None deleted
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty silence segments array', () => {
      const emptyState: EditorState = {
        ...createInitialEditorState(30),
        silenceSegments: [],
      };

      expect(getNextSilenceSegment(emptyState, 10)).toBeNull();
      expect(getPreviousSilenceSegment(emptyState, 10)).toBeNull();
      expect(getTotalSilenceDuration(emptyState)).toBe(0);
    });

    it('should handle single silence segment', () => {
      const singleState: EditorState = {
        ...createInitialEditorState(30),
        silenceSegments: [mockSilenceSegments[0]],
      };

      expect(getNextSilenceSegment(singleState, 3)).not.toBeNull();
      expect(getNextSilenceSegment(singleState, 10)).toBeNull();
      expect(getPreviousSilenceSegment(singleState, 10)).not.toBeNull();
    });

    it('should handle overlapping time queries', () => {
      // Test at exact start time
      const atStart = getSilenceSegmentAtTime(mockEditorState, 5.0);
      expect(atStart).not.toBeNull();
      expect(atStart?.id).toBe('silence_1');

      // Test at exact end time
      const atEnd = getSilenceSegmentAtTime(mockEditorState, 8.0);
      expect(atEnd).not.toBeNull();
      expect(atEnd?.id).toBe('silence_1');
    });
  });
});
