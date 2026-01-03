/**
 * Immutable State Update Helpers
 *
 * Pure functions for updating AI data following immutable patterns.
 * Implements Constitution Principle IV: Immutable State Operations.
 */

import type {
  Caption,
  CaptionPosition,
  CaptionStyle,
  SilenceSegment,
  Transcript,
  TranscriptSegment,
} from './types';

// ============================================================================
// Transcript Update Helpers
// ============================================================================

/**
 * Update a transcript segment's text (user edit)
 * Returns new transcript with updated segment marked as edited
 */
export function updateTranscriptSegment(
  transcript: Transcript,
  segmentId: string,
  newText: string,
): Transcript {
  return {
    ...transcript,
    segments: transcript.segments.map((seg) =>
      seg.id === segmentId ? { ...seg, edited: true, text: newText } : seg,
    ),
    updatedAt: Date.now(),
  };
}

/**
 * Flag low confidence segments
 * Returns new transcript with flagged segments
 */
export function flagLowConfidenceSegments(
  transcript: Transcript,
  threshold = 0.7,
): Transcript {
  return {
    ...transcript,
    segments: transcript.segments.map((seg) => ({
      ...seg,
      flagged: seg.confidence < threshold,
    })),
  };
}

/**
 * Update multiple segments at once
 * Returns new transcript with all specified segments updated
 */
export function updateMultipleSegments(
  transcript: Transcript,
  updates: Map<string, Partial<TranscriptSegment>>,
): Transcript {
  return {
    ...transcript,
    segments: transcript.segments.map((seg) => {
      const update = updates.get(seg.id);
      return update ? { ...seg, ...update, edited: true } : seg;
    }),
    updatedAt: Date.now(),
  };
}

/**
 * Remove a segment from transcript
 * Returns new transcript without the specified segment
 */
export function removeTranscriptSegment(
  transcript: Transcript,
  segmentId: string,
): Transcript {
  return {
    ...transcript,
    segments: transcript.segments.filter((seg) => seg.id !== segmentId),
    updatedAt: Date.now(),
  };
}

// ============================================================================
// Silence Segment Update Helpers
// ============================================================================

/**
 * Mark silence segment for deletion
 * Returns new array with segment marked as deleted and reviewed
 */
export function markSilenceForDeletion(
  segments: SilenceSegment[],
  segmentId: string,
): SilenceSegment[] {
  return segments.map((seg) =>
    seg.id === segmentId ? { ...seg, deleted: true, reviewed: true } : seg,
  );
}

/**
 * Restore a deleted silence segment
 * Returns new array with segment unmarked for deletion
 */
export function restoreSilenceSegment(
  segments: SilenceSegment[],
  segmentId: string,
): SilenceSegment[] {
  return segments.map((seg) =>
    seg.id === segmentId ? { ...seg, deleted: false } : seg,
  );
}

/**
 * Mark silence segment as reviewed
 * Returns new array with segment marked as reviewed
 */
export function markSilenceReviewed(
  segments: SilenceSegment[],
  segmentId: string,
): SilenceSegment[] {
  return segments.map((seg) =>
    seg.id === segmentId ? { ...seg, reviewed: true } : seg,
  );
}

/**
 * Delete all silence segments
 * Returns new array with all segments marked for deletion
 */
export function deleteAllSilence(segments: SilenceSegment[]): SilenceSegment[] {
  return segments.map((seg) => ({ ...seg, deleted: true, reviewed: true }));
}

/**
 * Restore all silence segments
 * Returns new array with all segments unmarked for deletion
 */
export function restoreAllSilence(
  segments: SilenceSegment[],
): SilenceSegment[] {
  return segments.map((seg) => ({ ...seg, deleted: false }));
}

/**
 * Filter out permanently deleted segments
 * Returns new array with only non-deleted segments (for export)
 */
export function filterDeletedSilence(
  segments: SilenceSegment[],
): SilenceSegment[] {
  return segments.filter((seg) => !seg.deleted);
}

// ============================================================================
// Caption Update Helpers
// ============================================================================

/**
 * Update caption style for all captions
 * Returns new array with all captions using the new style
 */
export function updateCaptionStyle(
  captions: Caption[],
  newStyle: Partial<CaptionStyle>,
): Caption[] {
  return captions.map((caption) => ({
    ...caption,
    style: { ...caption.style, ...newStyle },
  }));
}

/**
 * Update caption position for all captions
 * Returns new array with all captions at the new position
 */
export function updateCaptionPosition(
  captions: Caption[],
  newPosition: Partial<CaptionPosition>,
): Caption[] {
  return captions.map((caption) => ({
    ...caption,
    position: { ...caption.position, ...newPosition },
  }));
}

/**
 * Update a single caption's text
 * Returns new array with the specified caption's text updated
 */
export function updateCaptionText(
  captions: Caption[],
  captionId: string,
  newText: string,
): Caption[] {
  return captions.map((caption) =>
    caption.id === captionId ? { ...caption, text: newText } : caption,
  );
}

/**
 * Update a single caption's timing
 * Returns new array with the specified caption's timestamps updated
 */
export function updateCaptionTiming(
  captions: Caption[],
  captionId: string,
  startTime: number,
  endTime: number,
): Caption[] {
  return captions.map((caption) =>
    caption.id === captionId ? { ...caption, endTime, startTime } : caption,
  );
}

/**
 * Regenerate captions from updated transcript
 * Preserves style and position, updates text and timing
 */
export function syncCaptionsWithTranscript(
  captions: Caption[],
  transcript: Transcript,
): Caption[] {
  if (captions.length === 0 || transcript.segments.length === 0) {
    return captions;
  }

  // Create a map of transcript segments by time ranges
  const _segmentMap = new Map(transcript.segments.map((seg) => [seg.id, seg]));

  return captions.map((caption) => {
    // Find corresponding transcript segment
    const matchingSegment = transcript.segments.find(
      (seg) =>
        Math.abs(seg.startTime - caption.startTime) < 0.5 &&
        Math.abs(seg.endTime - caption.endTime) < 0.5,
    );

    if (matchingSegment) {
      return {
        ...caption,
        endTime: matchingSegment.endTime,
        startTime: matchingSegment.startTime,
        text: matchingSegment.text,
      };
    }

    return caption;
  });
}

/**
 * Remove a caption
 * Returns new array without the specified caption
 */
export function removeCaption(
  captions: Caption[],
  captionId: string,
): Caption[] {
  return captions.filter((caption) => caption.id !== captionId);
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Apply multiple updates to transcripts efficiently
 * Returns new transcript with all updates applied
 */
export function batchUpdateTranscript(
  transcript: Transcript,
  operations: Array<{
    type: 'update_segment' | 'remove_segment';
    segmentId: string;
    data?: Partial<TranscriptSegment>;
  }>,
): Transcript {
  let result = { ...transcript, updatedAt: Date.now() };

  for (const op of operations) {
    switch (op.type) {
      case 'update_segment':
        if (op.data) {
          result = {
            ...result,
            segments: result.segments.map((seg) =>
              seg.id === op.segmentId
                ? { ...seg, ...op.data, edited: true }
                : seg,
            ),
          };
        }
        break;
      case 'remove_segment':
        result = {
          ...result,
          segments: result.segments.filter((seg) => seg.id !== op.segmentId),
        };
        break;
    }
  }

  return result;
}
