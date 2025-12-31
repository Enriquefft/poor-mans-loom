// Extend CanvasRenderingContext2D to include roundRect method polyfill
declare global {
  interface CanvasRenderingContext2D {
    roundRect(x: number, y: number, width: number, height: number, radius: number): CanvasRenderingContext2D;
  }
}

export type CameraPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-center';
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

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  startTime: number | null;
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
}

export interface ExportOptions {
  format: 'webm' | 'mp4';
  quality: 'low' | 'medium' | 'high';
}

export interface ExportProgress {
  stage: 'preparing' | 'processing' | 'encoding' | 'complete' | 'error';
  progress: number;
  message: string;
}

export const CAMERA_SIZE_MAP: Record<CameraSize, { width: number; height: number }> = {
  small: { width: 120, height: 90 },
  medium: { width: 180, height: 135 },
  large: { width: 240, height: 180 },
};

export const CAMERA_POSITION_MAP: Record<CameraPosition, { bottom?: string; top?: string; left?: string; right?: string }> = {
  'top-left': { top: '1rem', left: '1rem' },
  'top-right': { top: '1rem', right: '1rem' },
  'bottom-left': { bottom: '1rem', left: '1rem' },
  'bottom-right': { bottom: '1rem', right: '1rem' },
  'bottom-center': { bottom: '1rem', left: '50%' },
};
