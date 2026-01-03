// Extend CanvasRenderingContext2D to include roundRect method polyfill
declare global {
  interface CanvasRenderingContext2D {
    roundRect(
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
    ): CanvasRenderingContext2D;
  }
}

export type CameraPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center';
export type CameraSize = 'small' | 'medium' | 'large';
export type CameraShape = 'circle' | 'rectangle';

export interface CameraSettings {
  position: CameraPosition;
  size: CameraSize;
  shape: CameraShape;
  customPosition?: { x: number; y: number };
  customSize?: { width: number; height: number };
}

export interface AudioSettings {
  microphoneEnabled: boolean;
  systemAudioEnabled: boolean;
  microphoneDeviceId?: string;
}

// Recording mode type
export type RecordingMode = 'screen-only' | 'camera-only' | 'screen+camera';

// Canvas dimension presets for camera-only mode
export interface CanvasDimension {
  width: number;
  height: number;
  label: string;
}

export const CANVAS_PRESETS: Record<string, CanvasDimension> = {
  '480p': { height: 480, label: '480p', width: 640 },
  '720p': { height: 720, label: '720p', width: 1280 },
  '1080p': { height: 1080, label: '1080p', width: 1920 },
};

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  startTime: number | null;
  mode: RecordingMode;
}

export interface TimelineSegment {
  id: string;
  startTime: number;
  endTime: number;
  deleted: boolean;
}

export interface EditorState {
  segments: TimelineSegment[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  silenceSegments?: import('./ai/types').SilenceSegment[]; // T050: Support silence segments
}

export interface ExportOptions {
  format: 'webm' | 'mp4';
  quality: 'low' | 'medium' | 'high';
  captions?: {
    enabled: boolean;
    burnIn: boolean; // If true, burn captions into video; if false, export as separate file
    captionIds?: string[]; // Optional: specific captions to include
  };
}

export interface ExportProgress {
  stage: 'preparing' | 'processing' | 'encoding' | 'complete' | 'error';
  progress: number;
  message: string;
}

export const CAMERA_SIZE_MAP: Record<
  CameraSize,
  { width: number; height: number }
> = {
  large: { height: 180, width: 240 },
  medium: { height: 135, width: 180 },
  small: { height: 90, width: 120 },
};

export const CAMERA_POSITION_MAP: Record<
  CameraPosition,
  { bottom?: string; top?: string; left?: string; right?: string }
> = {
  'bottom-center': { bottom: '1rem', left: '50%' },
  'bottom-left': { bottom: '1rem', left: '1rem' },
  'bottom-right': { bottom: '1rem', right: '1rem' },
  'top-left': { left: '1rem', top: '1rem' },
  'top-right': { right: '1rem', top: '1rem' },
};
