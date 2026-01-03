/**
 * Transcript Editor Operations
 *
 * Search, edit, export operations for transcripts.
 * Pure functions following immutable state patterns.
 */

import { updateTranscriptSegment } from '@/lib/ai/state-helpers';
import type { Transcript, TranscriptSegment } from '@/lib/ai/types';

// ============================================================================
// Search Functions
// ============================================================================

export interface SearchResult {
  segmentId: string;
  segmentIndex: number;
  text: string;
  startTime: number;
  endTime: number;
  matches: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

/**
 * Search transcript for word or phrase
 * Returns array of matching segments with match positions
 */
export function searchTranscript(
  transcript: Transcript,
  query: string,
  options?: {
    caseSensitive?: boolean;
    wholeWord?: boolean;
  },
): SearchResult[] {
  if (!query.trim()) return [];

  const results: SearchResult[] = [];
  const searchQuery = options?.caseSensitive ? query : query.toLowerCase();

  transcript.segments.forEach((segment, index) => {
    const text = options?.caseSensitive
      ? segment.text
      : segment.text.toLowerCase();

    // Find all occurrences in the segment
    const matches: SearchResult['matches'] = [];

    if (options?.wholeWord) {
      // Whole word search
      const regex = new RegExp(
        `\\b${escapeRegex(searchQuery)}\\b`,
        options.caseSensitive ? 'g' : 'gi',
      );
      let match;
      while ((match = regex.exec(segment.text)) !== null) {
        matches.push({
          end: match.index + match[0].length,
          start: match.index,
          text: match[0],
        });
      }
    } else {
      // Substring search
      let pos = 0;
      while ((pos = text.indexOf(searchQuery, pos)) !== -1) {
        matches.push({
          end: pos + searchQuery.length,
          start: pos,
          text: segment.text.substring(pos, pos + searchQuery.length),
        });
        pos += searchQuery.length;
      }
    }

    if (matches.length > 0) {
      results.push({
        endTime: segment.endTime,
        matches,
        segmentId: segment.id,
        segmentIndex: index,
        startTime: segment.startTime,
        text: segment.text,
      });
    }
  });

  return results;
}

/**
 * Jump to video timestamp for a search result
 */
export function getTimestampForResult(result: SearchResult): number {
  return result.startTime;
}

// ============================================================================
// Edit Operations
// ============================================================================

/**
 * Update segment text (user edit)
 * Returns new transcript with updated segment
 */
export function editSegmentText(
  transcript: Transcript,
  segmentId: string,
  newText: string,
): Transcript {
  return updateTranscriptSegment(transcript, segmentId, newText);
}

/**
 * Merge two adjacent segments
 * Returns new transcript with merged segment
 */
export function mergeSegments(
  transcript: Transcript,
  segmentId1: string,
  segmentId2: string,
): Transcript {
  const seg1Index = transcript.segments.findIndex((s) => s.id === segmentId1);
  const seg2Index = transcript.segments.findIndex((s) => s.id === segmentId2);

  if (seg1Index === -1 || seg2Index === -1) return transcript;
  if (Math.abs(seg1Index - seg2Index) !== 1) return transcript;

  const [firstIndex, secondIndex] =
    seg1Index < seg2Index ? [seg1Index, seg2Index] : [seg2Index, seg1Index];

  const first = transcript.segments[firstIndex];
  const second = transcript.segments[secondIndex];

  const merged: TranscriptSegment = {
    ...first,
    confidence: (first.confidence + second.confidence) / 2,
    edited: true,
    endTime: second.endTime,
    text: `${first.text} ${second.text}`,
    words: [...first.words, ...second.words],
  };

  return {
    ...transcript,
    segments: [
      ...transcript.segments.slice(0, firstIndex),
      merged,
      ...transcript.segments.slice(secondIndex + 1),
    ],
    updatedAt: Date.now(),
  };
}

/**
 * Split segment at character position
 * Returns new transcript with split segments
 */
export function splitSegment(
  transcript: Transcript,
  segmentId: string,
  splitPosition: number,
): Transcript {
  const segIndex = transcript.segments.findIndex((s) => s.id === segmentId);
  if (segIndex === -1) return transcript;

  const segment = transcript.segments[segIndex];
  if (splitPosition <= 0 || splitPosition >= segment.text.length)
    return transcript;

  const firstText = segment.text.substring(0, splitPosition).trim();
  const secondText = segment.text.substring(splitPosition).trim();

  const midTime =
    segment.startTime +
    (segment.endTime - segment.startTime) *
      (splitPosition / segment.text.length);

  const first: TranscriptSegment = {
    ...segment,
    edited: true,
    endTime: midTime,
    id: `${segment.id}_1`,
    text: firstText,
    words: segment.words.filter((w) => w.endTime <= midTime),
  };

  const second: TranscriptSegment = {
    ...segment,
    edited: true,
    id: `${segment.id}_2`,
    startTime: midTime,
    text: secondText,
    words: segment.words.filter((w) => w.startTime >= midTime),
  };

  return {
    ...transcript,
    segments: [
      ...transcript.segments.slice(0, segIndex),
      first,
      second,
      ...transcript.segments.slice(segIndex + 1),
    ],
    updatedAt: Date.now(),
  };
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export transcript to SRT format
 */
export function toSRT(transcript: Transcript): string {
  const lines: string[] = [];

  transcript.segments.forEach((segment, index) => {
    lines.push(String(index + 1));
    lines.push(
      `${formatTimestamp(segment.startTime, 'srt')} --> ${formatTimestamp(segment.endTime, 'srt')}`,
    );
    lines.push(segment.text);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Export transcript to WebVTT format
 */
export function toVTT(transcript: Transcript): string {
  const lines: string[] = ['WEBVTT', ''];

  transcript.segments.forEach((segment) => {
    lines.push(
      `${formatTimestamp(segment.startTime, 'vtt')} --> ${formatTimestamp(segment.endTime, 'vtt')}`,
    );
    lines.push(segment.text);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Export transcript to plain text
 */
export function toTXT(transcript: Transcript): string {
  return transcript.segments.map((seg) => seg.text).join('\n');
}

/**
 * Export transcript to plain text with timestamps
 */
export function toTXTWithTimestamps(transcript: Transcript): string {
  return transcript.segments
    .map((seg) => `[${formatTimestamp(seg.startTime, 'plain')}] ${seg.text}`)
    .join('\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format timestamp for subtitle formats
 */
function formatTimestamp(
  seconds: number,
  format: 'srt' | 'vtt' | 'plain',
): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  if (format === 'srt') {
    return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(millis, 3)}`;
  }
  if (format === 'vtt') {
    return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)}.${pad(millis, 3)}`;
  }
  // plain format for display
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)}`;
}

function pad(num: number, width: number): string {
  return String(num).padStart(width, '0');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Calculate transcript statistics
 */
export function getTranscriptStats(transcript: Transcript) {
  const wordCount = transcript.segments.reduce(
    (sum, seg) => sum + seg.words.length,
    0,
  );

  const characterCount = transcript.segments.reduce(
    (sum, seg) => sum + seg.text.length,
    0,
  );

  const speakingDuration = transcript.segments.reduce(
    (sum, seg) => sum + (seg.endTime - seg.startTime),
    0,
  );

  const confidences = transcript.segments.map((seg) => seg.confidence);
  const averageConfidence =
    confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

  const lowConfidenceCount = transcript.segments.filter(
    (seg) => seg.flagged,
  ).length;

  const speakers = new Set(
    transcript.segments.map((seg) => seg.speaker).filter(Boolean),
  );

  return {
    averageConfidence,
    characterCount,
    lowConfidenceCount,
    speakerCount: speakers.size,
    speakingDuration,
    wordCount,
  };
}
