import type { EditorState, TimelineSegment } from '../types';
import type { SilenceSegment } from './ai/types';

export function createInitialEditorState(duration: number): EditorState {
  return {
    currentTime: 0,
    duration,
    isPlaying: false,
    segments: [
      {
        deleted: false,
        endTime: duration,
        id: crypto.randomUUID(),
        startTime: 0,
      },
    ],
    silenceSegments: [], // T050: Initialize empty silence segments array
  };
}

export function trimStart(
  state: EditorState,
  newStartTime: number,
): EditorState {
  if (state.segments.length === 0) return state;

  const firstSegment = state.segments.find((s) => !s.deleted);
  if (!firstSegment) return state;

  const clampedStart = Math.max(
    0,
    Math.min(newStartTime, firstSegment.endTime - 0.1),
  );

  return {
    ...state,
    segments: state.segments.map((s) =>
      s.id === firstSegment.id ? { ...s, startTime: clampedStart } : s,
    ),
  };
}

export function trimEnd(state: EditorState, newEndTime: number): EditorState {
  if (state.segments.length === 0) return state;

  const lastSegment = [...state.segments].reverse().find((s) => !s.deleted);
  if (!lastSegment) return state;

  const clampedEnd = Math.min(
    state.duration,
    Math.max(newEndTime, lastSegment.startTime + 0.1),
  );

  return {
    ...state,
    segments: state.segments.map((s) =>
      s.id === lastSegment.id ? { ...s, endTime: clampedEnd } : s,
    ),
  };
}

export function splitSegment(
  state: EditorState,
  segmentId: string,
  splitTime: number,
): EditorState {
  const segmentIndex = state.segments.findIndex((s) => s.id === segmentId);
  if (segmentIndex === -1) return state;

  const segment = state.segments[segmentIndex];
  if (segment.deleted) return state;

  if (splitTime <= segment.startTime || splitTime >= segment.endTime) {
    return state;
  }

  const leftSegment: TimelineSegment = {
    ...segment,
    endTime: splitTime,
  };

  const rightSegment: TimelineSegment = {
    deleted: false,
    endTime: segment.endTime,
    id: crypto.randomUUID(),
    startTime: splitTime,
  };

  const newSegments = [...state.segments];
  newSegments.splice(segmentIndex, 1, leftSegment, rightSegment);

  return {
    ...state,
    segments: newSegments,
  };
}

export function deleteSegment(
  state: EditorState,
  segmentId: string,
): EditorState {
  const activeSegments = state.segments.filter((s) => !s.deleted);
  if (activeSegments.length <= 1) {
    return state;
  }

  return {
    ...state,
    segments: state.segments.map((s) =>
      s.id === segmentId ? { ...s, deleted: true } : s,
    ),
  };
}

export function restoreSegment(
  state: EditorState,
  segmentId: string,
): EditorState {
  return {
    ...state,
    segments: state.segments.map((s) =>
      s.id === segmentId ? { ...s, deleted: false } : s,
    ),
  };
}

export function getActiveSegments(state: EditorState): TimelineSegment[] {
  return state.segments.filter((s) => !s.deleted);
}

export function getTotalActiveDuration(state: EditorState): number {
  return getActiveSegments(state).reduce(
    (total, segment) => total + (segment.endTime - segment.startTime),
    0,
  );
}

export function getSegmentAtTime(
  state: EditorState,
  time: number,
): TimelineSegment | null {
  return (
    state.segments.find(
      (s) => !s.deleted && time >= s.startTime && time <= s.endTime,
    ) || null
  );
}

export function isTimeInActiveSegment(
  state: EditorState,
  time: number,
): boolean {
  return getSegmentAtTime(state, time) !== null;
}

export function getNextActiveTime(
  state: EditorState,
  currentTime: number,
): number {
  const activeSegments = getActiveSegments(state).sort(
    (a, b) => a.startTime - b.startTime,
  );

  for (const segment of activeSegments) {
    if (currentTime < segment.startTime) {
      return segment.startTime;
    }
    if (currentTime >= segment.startTime && currentTime < segment.endTime) {
      return currentTime;
    }
  }

  return activeSegments[0]?.startTime || 0;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
}

// ============================================================================
// Silence Segment Operations (T050-T053)
// ============================================================================

/**
 * T051: Mark a silence segment for deletion (immutable operation)
 */
export function markSilenceForDeletion(
  state: EditorState,
  silenceSegmentId: string,
  deleted: boolean,
): EditorState {
  if (!state.silenceSegments) {
    return state;
  }

  return {
    ...state,
    silenceSegments: state.silenceSegments.map((seg) =>
      seg.id === silenceSegmentId ? { ...seg, deleted, reviewed: true } : seg,
    ),
  };
}

/**
 * T052: Mark all silence segments for deletion (batch operation)
 */
export function batchDeleteSilence(
  state: EditorState,
  deleted: boolean,
): EditorState {
  if (!state.silenceSegments) {
    return state;
  }

  return {
    ...state,
    silenceSegments: state.silenceSegments.map((seg) => ({
      ...seg,
      deleted,
      reviewed: true,
    })),
  };
}

/**
 * T053: Get next silence segment for navigation
 */
export function getNextSilenceSegment(
  state: EditorState,
  currentTime: number,
): SilenceSegment | null {
  if (!state.silenceSegments || state.silenceSegments.length === 0) {
    return null;
  }

  // Find silence segments that start after current time
  const upcomingSilence = state.silenceSegments
    .filter((seg) => seg.startTime > currentTime)
    .sort((a, b) => a.startTime - b.startTime);

  return upcomingSilence[0] || null;
}

/**
 * T053: Get previous silence segment for navigation
 */
export function getPreviousSilenceSegment(
  state: EditorState,
  currentTime: number,
): SilenceSegment | null {
  if (!state.silenceSegments || state.silenceSegments.length === 0) {
    return null;
  }

  // Find silence segments that start before current time
  const previousSilence = state.silenceSegments
    .filter((seg) => seg.startTime < currentTime)
    .sort((a, b) => b.startTime - a.startTime); // Sort descending

  return previousSilence[0] || null;
}

/**
 * Get silence segment at specific time
 */
export function getSilenceSegmentAtTime(
  state: EditorState,
  time: number,
): SilenceSegment | null {
  if (!state.silenceSegments) {
    return null;
  }

  return (
    state.silenceSegments.find(
      (seg) => time >= seg.startTime && time <= seg.endTime,
    ) || null
  );
}

/**
 * Get total silence duration (for statistics)
 */
export function getTotalSilenceDuration(state: EditorState): number {
  if (!state.silenceSegments) {
    return 0;
  }

  return state.silenceSegments.reduce((total, seg) => total + seg.duration, 0);
}

/**
 * Get time saved by removing silence
 */
export function getTimeSavedBySilenceRemoval(state: EditorState): number {
  if (!state.silenceSegments) {
    return 0;
  }

  return state.silenceSegments
    .filter((seg) => seg.deleted)
    .reduce((total, seg) => total + seg.duration, 0);
}
