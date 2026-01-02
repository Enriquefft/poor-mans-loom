import { TimelineSegment, EditorState } from '../types';

export function createInitialEditorState(duration: number): EditorState {
  return {
    segments: [
      {
        id: crypto.randomUUID(),
        startTime: 0,
        endTime: duration,
        deleted: false,
      },
    ],
    currentTime: 0,
    duration,
    isPlaying: false,
  };
}

export function trimStart(state: EditorState, newStartTime: number): EditorState {
  if (state.segments.length === 0) return state;
  
  const firstSegment = state.segments.find(s => !s.deleted);
  if (!firstSegment) return state;
  
  const clampedStart = Math.max(0, Math.min(newStartTime, firstSegment.endTime - 0.1));
  
  return {
    ...state,
    segments: state.segments.map(s =>
      s.id === firstSegment.id ? { ...s, startTime: clampedStart } : s
    ),
  };
}

export function trimEnd(state: EditorState, newEndTime: number): EditorState {
  if (state.segments.length === 0) return state;
  
  const lastSegment = [...state.segments].reverse().find(s => !s.deleted);
  if (!lastSegment) return state;
  
  const clampedEnd = Math.min(state.duration, Math.max(newEndTime, lastSegment.startTime + 0.1));
  
  return {
    ...state,
    segments: state.segments.map(s =>
      s.id === lastSegment.id ? { ...s, endTime: clampedEnd } : s
    ),
  };
}

export function splitSegment(state: EditorState, segmentId: string, splitTime: number): EditorState {
  const segmentIndex = state.segments.findIndex(s => s.id === segmentId);
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
    id: crypto.randomUUID(),
    startTime: splitTime,
    endTime: segment.endTime,
    deleted: false,
  };
  
  const newSegments = [...state.segments];
  newSegments.splice(segmentIndex, 1, leftSegment, rightSegment);
  
  return {
    ...state,
    segments: newSegments,
  };
}

export function deleteSegment(state: EditorState, segmentId: string): EditorState {
  const activeSegments = state.segments.filter(s => !s.deleted);
  if (activeSegments.length <= 1) {
    return state;
  }
  
  return {
    ...state,
    segments: state.segments.map(s =>
      s.id === segmentId ? { ...s, deleted: true } : s
    ),
  };
}

export function restoreSegment(state: EditorState, segmentId: string): EditorState {
  return {
    ...state,
    segments: state.segments.map(s =>
      s.id === segmentId ? { ...s, deleted: false } : s
    ),
  };
}

export function getActiveSegments(state: EditorState): TimelineSegment[] {
  return state.segments.filter(s => !s.deleted);
}

export function getTotalActiveDuration(state: EditorState): number {
  return getActiveSegments(state).reduce(
    (total, segment) => total + (segment.endTime - segment.startTime),
    0
  );
}

export function getSegmentAtTime(state: EditorState, time: number): TimelineSegment | null {
  return state.segments.find(
    s => !s.deleted && time >= s.startTime && time <= s.endTime
  ) || null;
}

export function isTimeInActiveSegment(state: EditorState, time: number): boolean {
  return getSegmentAtTime(state, time) !== null;
}

export function getNextActiveTime(state: EditorState, currentTime: number): number {
  const activeSegments = getActiveSegments(state).sort((a, b) => a.startTime - b.startTime);
  
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

