/**
 * Transcription Web Worker
 *
 * Runs Whisper model in separate thread to avoid blocking UI.
 * Implements automatic speech recognition using @xenova/transformers.
 */

import {
  type AutomaticSpeechRecognitionPipeline,
  pipeline,
} from '@xenova/transformers';
import { AI_MODELS, TRANSCRIPTION_CONFIG } from './config';

// ============================================================================
// Worker State
// ============================================================================

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let isInitializing = false;

// ============================================================================
// Message Types
// ============================================================================

interface InitMessage {
  type: 'init';
}

interface TranscribeMessage {
  type: 'transcribe';
  audioData: ArrayBuffer;
  options?: {
    language?: string;
    chunkLengthSec?: number;
    strideLengthSec?: number;
    returnTimestamps?: 'word' | 'segment';
  };
}

interface CancelMessage {
  type: 'cancel';
}

type WorkerMessage = InitMessage | TranscribeMessage | CancelMessage;

interface ProgressUpdate {
  type: 'progress';
  progress: number;
  status: string;
}

interface ReadyMessage {
  type: 'ready';
  modelVersion: string;
}

interface ResultMessage {
  type: 'result';
  data: unknown;
}

interface ErrorMessage {
  type: 'error';
  error: {
    type: string;
    message: string;
    details?: unknown;
  };
}

type WorkerResponse =
  | ProgressUpdate
  | ReadyMessage
  | ResultMessage
  | ErrorMessage;

// ============================================================================
// Model Initialization
// ============================================================================

async function initializeModel(): Promise<void> {
  if (transcriber || isInitializing) return;

  isInitializing = true;

  try {
    // Send progress update
    self.postMessage({
      progress: 0,
      status: 'Loading Whisper model...',
      type: 'progress',
    } as ProgressUpdate);

    // Initialize pipeline with progress callback
    transcriber = await pipeline(
      'automatic-speech-recognition',
      AI_MODELS.WHISPER_TINY_EN.id,
      {
        progress_callback: (progress: {
          status: string;
          progress?: number;
        }) => {
          self.postMessage({
            progress: progress.progress || 0,
            status: progress.status,
            type: 'progress',
          } as ProgressUpdate);
        },
      },
    );

    self.postMessage({
      modelVersion: AI_MODELS.WHISPER_TINY_EN.id,
      type: 'ready',
    } as ReadyMessage);
  } catch (error) {
    self.postMessage({
      error: {
        details: error,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load Whisper model',
        type: 'MODEL_LOAD_FAILED',
      },
      type: 'error',
    } as ErrorMessage);
  } finally {
    isInitializing = false;
  }
}

// ============================================================================
// Transcription
// ============================================================================

async function transcribeAudio(
  audioData: ArrayBuffer,
  options?: TranscribeMessage['options'],
): Promise<void> {
  if (!transcriber) {
    self.postMessage({
      error: {
        message: 'Transcriber not initialized. Call init first.',
        type: 'MODEL_LOAD_FAILED',
      },
      type: 'error',
    } as ErrorMessage);
    return;
  }

  try {
    // Send progress update
    self.postMessage({
      progress: 0,
      status: 'Transcribing audio...',
      type: 'progress',
    } as ProgressUpdate);

    // Convert ArrayBuffer to Float32Array
    const audioArray = new Float32Array(audioData);

    // Run transcription
    const result = await transcriber(audioArray, {
      chunk_length_s:
        options?.chunkLengthSec || TRANSCRIPTION_CONFIG.CHUNK_LENGTH_SEC,
      language: options?.language || TRANSCRIPTION_CONFIG.DEFAULT_LANGUAGE,
      return_timestamps:
        options?.returnTimestamps || TRANSCRIPTION_CONFIG.RETURN_TIMESTAMPS,
      stride_length_s:
        options?.strideLengthSec || TRANSCRIPTION_CONFIG.STRIDE_LENGTH_SEC,
    });

    // Send result
    self.postMessage({
      data: result,
      type: 'result',
    } as ResultMessage);
  } catch (error) {
    // Check if no speech detected
    const isNoSpeech =
      error instanceof Error && error.message.includes('no speech');

    self.postMessage({
      error: {
        details: error,
        message:
          error instanceof Error ? error.message : 'Transcription failed',
        type: isNoSpeech ? 'NO_SPEECH' : 'INFERENCE_ERROR',
      },
      type: 'error',
    } as ErrorMessage);
  }
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  switch (type) {
    case 'init':
      await initializeModel();
      break;

    case 'transcribe': {
      const { audioData, options } = event.data;
      await transcribeAudio(audioData, options);
      break;
    }

    case 'cancel':
      // Cancel not yet implemented in transformers.js
      // For now, just terminate the worker
      self.postMessage({
        error: {
          message: 'Transcription cancelled',
          type: 'INFERENCE_ERROR',
        },
        type: 'error',
      } as ErrorMessage);
      break;

    default:
      self.postMessage({
        error: {
          message: `Unknown message type: ${type}`,
          type: 'INFERENCE_ERROR',
        },
        type: 'error',
      } as ErrorMessage);
  }
};

// ============================================================================
// Error Handler
// ============================================================================

self.onerror = (error) => {
  self.postMessage({
    error: {
      details: error,
      message: error.message || 'Worker error',
      type: 'INFERENCE_ERROR',
    },
    type: 'error',
  } as ErrorMessage);
};
