# Quickstart Guide: AI-Powered Recording Enhancements

**Feature**: 001-ai-transformer-features
**Audience**: Developers implementing this feature
**Updated**: 2026-01-02

## Overview

This guide walks you through implementing the AI-powered features layer for Poor Man's Loom. You'll integrate transformer.js for transcription, MediaPipe for background effects, Web Audio API for silence detection, and caption generation—all running entirely in the browser.

---

## Prerequisites

### Required Knowledge

- TypeScript (strict mode)
- React 19+ with hooks
- Web APIs: Web Audio API, Canvas API, Web Workers
- Asynchronous JavaScript (Promises, async/await)
- localStorage basics

### Environment Setup

```bash
# Install dependencies
bun install

# Add AI-specific packages
bun add @xenova/transformers @mediapipe/tasks-vision

# Run development server
bun run dev
```

**Browser Requirements**: Chrome 120+, Firefox 120+, or Safari 17+ with:
- SharedArrayBuffer support (COOP/COEP headers already configured)
- WebGL for GPU acceleration
- ~200MB free disk space for AI models

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ UI Layer                                                 │
│  ├── TranscriptViewer (search, edit)                    │
│  ├── SilenceMarkers (timeline indicators)               │
│  ├── CaptionEditor (styling, positioning)               │
│  └── BackgroundControls (blur/removal toggles)          │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│ AI Services Layer (@/lib/ai/)                            │
│  ├── TranscriptionService (Whisper via transformer.js)  │
│  ├── SegmentationService (MediaPipe background effects) │
│  ├── SilenceDetectionService (Web Audio analysis)       │
│  ├── CaptionService (SRT/VTT generation)                │
│  └── AIJobManager (progress tracking)                   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│ Storage Layer (@/lib/storage/)                           │
│  └── StorageService (localStorage persistence)          │
└──────────────────────────────────────────────────────────┘
```

---

## Step 1: Set Up AI Configuration

Create `src/lib/ai/config.ts`:

```typescript
export const AI_CONFIG = {
  transcription: {
    modelId: 'Xenova/whisper-tiny.en', // 40MB, fast
    // Alternative: 'Xenova/whisper-base.en' // 150MB, more accurate
    chunkLengthSec: 30,
    strideLengthSec: 5,
    confidenceThreshold: 0.70 // Flag segments below this
  },

  segmentation: {
    modelUrl: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',
    wasmUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
    preferGPU: true
  },

  silenceDetection: {
    thresholdDb: -40,
    minDurationSec: 2.0,
    fftSize: 2048
  },

  captions: {
    maxDurationSec: 3.0, // Comfortable reading pace
    defaultStyle: {
      fontFamily: 'Arial',
      fontSize: 24,
      fontColor: '#FFFFFF',
      backgroundColor: '#000000AA',
      bold: false,
      italic: false,
      outline: true,
      outlineColor: '#000000'
    }
  }
} as const;
```

---

## Step 2: Implement Transcription Service

Create `src/lib/ai/transcription.ts`:

```typescript
import { pipeline } from '@xenova/transformers';
import type { TranscriptionService, TranscriptionResult } from '@/specs/001-ai-transformer-features/contracts/ai-services';
import { AI_CONFIG } from './config';

class WhisperTranscriptionService implements TranscriptionService {
  private model: any = null;
  private worker: Worker | null = null;

  async initialize(): Promise<TranscriptionInitResult> {
    try {
      // Load model in Web Worker to avoid blocking UI
      this.worker = new Worker(
        new URL('./transcription-worker.ts', import.meta.url),
        { type: 'module' }
      );

      return new Promise((resolve) => {
        this.worker!.onmessage = (e) => {
          if (e.data.type === 'ready') {
            resolve({
              success: true,
              modelVersion: AI_CONFIG.transcription.modelId
            });
          }
          if (e.data.type === 'error') {
            resolve({
              success: false,
              type: 'MODEL_LOAD_FAILED',
              message: e.data.message
            });
          }
        };

        this.worker!.postMessage({ type: 'init' });
      });
    } catch (error) {
      return {
        success: false,
        type: 'MODEL_LOAD_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error
      };
    }
  }

  async transcribe(
    audioBlob: Blob,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    if (!this.worker) {
      return {
        success: false,
        type: 'MODEL_LOAD_FAILED',
        message: 'Transcription service not initialized'
      };
    }

    try {
      // Convert blob to array buffer for worker
      const arrayBuffer = await audioBlob.arrayBuffer();

      return new Promise((resolve) => {
        this.worker!.onmessage = (e) => {
          if (e.data.type === 'result') {
            const transcript = this.formatTranscript(e.data.data);
            resolve({ success: true, transcript });
          }
          if (e.data.type === 'error') {
            resolve({
              success: false,
              type: e.data.errorType || 'INFERENCE_ERROR',
              message: e.data.message
            });
          }
        };

        this.worker!.postMessage({
          type: 'transcribe',
          audioData: arrayBuffer,
          options: options || {}
        });
      });
    } catch (error) {
      return {
        success: false,
        type: 'INFERENCE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error
      };
    }
  }

  private formatTranscript(rawResult: any): Transcript {
    // Transform Whisper output to our Transcript type
    // Implementation details omitted for brevity
    // See data-model.md for Transcript structure
  }

  isReady(): boolean {
    return this.worker !== null;
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const transcriptionService = new WhisperTranscriptionService();
```

**Web Worker** (`src/lib/ai/transcription-worker.ts`):

```typescript
import { pipeline } from '@xenova/transformers';

let transcriber: any = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, audioData, options } = e.data;

  if (type === 'init') {
    try {
      transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.en'
      );
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Model load failed'
      });
    }
  }

  if (type === 'transcribe') {
    try {
      const result = await transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: 'word',
        ...options
      });
      self.postMessage({ type: 'result', data: result });
    } catch (error) {
      self.postMessage({
        type: 'error',
        errorType: 'INFERENCE_ERROR',
        message: error instanceof Error ? error.message : 'Transcription failed'
      });
    }
  }
};
```

---

## Step 3: Implement Background Segmentation

Create `src/lib/ai/segmentation.ts`:

```typescript
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';
import type { SegmentationService } from '@/specs/001-ai-transformer-features/contracts/ai-services';
import { AI_CONFIG } from './config';

class MediaPipeSegmentationService implements SegmentationService {
  private segmenter: ImageSegmenter | null = null;

  async initialize(options?: SegmentationOptions): Promise<SegmentationInitResult> {
    try {
      const vision = await FilesetResolver.forVisionTasks(AI_CONFIG.segmentation.wasmUrl);

      this.segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: AI_CONFIG.segmentation.modelUrl,
          delegate: options?.delegate || (AI_CONFIG.segmentation.preferGPU ? 'GPU' : 'CPU')
        },
        runningMode: 'VIDEO',
        outputCategoryMask: true
      });

      return {
        success: true,
        delegate: this.segmenter.getOptions().baseOptions.delegate as 'CPU' | 'GPU'
      };
    } catch (error) {
      return {
        success: false,
        type: 'MEDIAPIPE_INIT_FAILED',
        message: error instanceof Error ? error.message : 'Segmentation init failed',
        details: error
      };
    }
  }

  processFrame(
    videoElement: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    effect: BackgroundEffect
  ): SegmentationFrameResult {
    if (!this.segmenter) {
      return {
        success: false,
        type: 'MEDIAPIPE_INIT_FAILED',
        message: 'Segmenter not initialized'
      };
    }

    try {
      const timestamp = performance.now();
      const result = this.segmenter.segmentForVideo(videoElement, timestamp);
      const mask = result.categoryMask!;

      // Apply effect to canvas
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      if (effect.type === 'blur') {
        this.applyBlur(ctx, mask, effect.blurIntensity || 50);
      } else if (effect.type === 'removal') {
        this.applyRemoval(ctx, mask, effect.replacementColor || '#00FF00');
      }

      return {
        success: true,
        processedFrame: ctx.getImageData(0, 0, canvas.width, canvas.height)
      };
    } catch (error) {
      return {
        success: false,
        type: 'SEGMENTATION_ERROR',
        message: error instanceof Error ? error.message : 'Frame processing failed',
        details: error
      };
    }
  }

  private applyBlur(
    ctx: CanvasRenderingContext2D,
    mask: any,
    intensity: number
  ): void {
    // Implementation: blur background pixels based on mask
    // See MediaPipe docs for mask format
  }

  private applyRemoval(
    ctx: CanvasRenderingContext2D,
    mask: any,
    color: string
  ): void {
    // Implementation: replace background pixels with solid color
  }

  isReady(): boolean {
    return this.segmenter !== null;
  }

  async cleanup(): Promise<void> {
    if (this.segmenter) {
      this.segmenter.close();
      this.segmenter = null;
    }
  }
}

export const segmentationService = new MediaPipeSegmentationService();
```

---

## Step 4: Integrate with Existing Compositor

Update `src/lib/recorder/compositor.ts` to support background effects:

```typescript
import { segmentationService } from '@/lib/ai/segmentation';

export async function createCompositeStream(
  screenStream: MediaStream,
  cameraStream: MediaStream | null,
  audioStream: MediaStream | null,
  backgroundEffect?: BackgroundEffect
): Promise<MediaStream> {
  // ... existing screen + camera setup ...

  // NEW: Initialize segmentation if background effect enabled
  if (backgroundEffect?.enabled && cameraStream) {
    const initResult = await segmentationService.initialize();
    if (!initResult.success) {
      console.error('Segmentation failed:', initResult.message);
      // Fall back to no background effect
    }
  }

  function draw() {
    // ... existing screen drawing ...

    if (cameraStream && cameraVideo.readyState === cameraVideo.HAVE_ENOUGH_DATA) {
      // NEW: Apply background effect if enabled
      if (backgroundEffect?.enabled) {
        const result = segmentationService.processFrame(
          cameraVideo,
          tempCanvas,
          backgroundEffect
        );
        if (result.success) {
          ctx.drawImage(tempCanvas, cameraX, cameraY, cameraWidth, cameraHeight);
        } else {
          // Fallback: draw camera without effect
          ctx.drawImage(cameraVideo, cameraX, cameraY, cameraWidth, cameraHeight);
        }
      } else {
        ctx.drawImage(cameraVideo, cameraX, cameraY, cameraWidth, cameraHeight);
      }
    }

    requestAnimationFrame(draw);
  }

  draw();
  return canvas.captureStream(30);
}
```

---

## Step 5: Implement Storage Service

Create `src/lib/storage/persistence.ts`:

```typescript
import type { StorageService } from '@/specs/001-ai-transformer-features/contracts/storage-api';

class LocalStorageService implements StorageService {
  async saveTranscript(transcript: Transcript): Promise<StorageResult> {
    try {
      const key = `${STORAGE_KEYS.TRANSCRIPTS}:${transcript.recordingId}`;
      localStorage.setItem(key, JSON.stringify(transcript));
      return { success: true };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        return {
          success: false,
          type: 'QUOTA_EXCEEDED',
          message: 'Storage quota exceeded. Please delete old recordings.'
        };
      }
      return {
        success: false,
        type: 'SERIALIZATION_ERROR',
        message: error instanceof Error ? error.message : 'Save failed'
      };
    }
  }

  // ... implement other methods from StorageService interface ...

  getStorageStats(): StorageStats {
    let totalBytes = 0;
    for (const key in localStorage) {
      if (key.startsWith('pmr:')) {
        totalBytes += localStorage.getItem(key)!.length * 2; // UTF-16 encoding
      }
    }

    const quotaBytes = 10 * 1024 * 1024; // 10MB typical limit
    return {
      totalBytes,
      availableBytes: quotaBytes - totalBytes,
      usagePercentage: (totalBytes / quotaBytes) * 100,
      // ... calculate other stats ...
    };
  }
}

export const storageService = new LocalStorageService();
```

---

## Step 6: Create React Hook for AI Operations

Create `src/hooks/use-ai-processing.ts`:

```typescript
import { useState, useEffect } from 'react';
import { transcriptionService } from '@/lib/ai/transcription';
import type { AIProcessingJob } from '@/specs/001-ai-transformer-features/contracts/ai-services';

export function useAIProcessing(recordingId: string) {
  const [jobs, setJobs] = useState<AIProcessingJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const startTranscription = async (audioBlob: Blob) => {
    setIsProcessing(true);

    // Initialize model if needed
    if (!transcriptionService.isReady()) {
      const initResult = await transcriptionService.initialize();
      if (!initResult.success) {
        console.error('Init failed:', initResult.message);
        setIsProcessing(false);
        return;
      }
    }

    // Transcribe
    const result = await transcriptionService.transcribe(audioBlob);
    setIsProcessing(false);

    if (result.success) {
      // Save to storage
      await storageService.saveTranscript(result.transcript);
      return result.transcript;
    } else {
      console.error('Transcription failed:', result.message);
    }
  };

  return {
    jobs,
    isProcessing,
    startTranscription
  };
}
```

---

## Step 7: Update Agent Context

Run the agent context update script:

```bash
.specify/scripts/bash/update-agent-context.sh claude
```

This updates `.claude/CLAUDE.md` with the new AI technologies for future development sessions.

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/ai-transcription.test.ts
import { describe, it, expect, vi } from 'vitest';
import { transcriptionService } from '@/lib/ai/transcription';

describe('TranscriptionService', () => {
  it('should format Whisper output correctly', () => {
    const mockResult = { /* Whisper raw output */ };
    const transcript = transcriptionService['formatTranscript'](mockResult);
    expect(transcript.segments).toBeDefined();
    expect(transcript.metadata.averageConfidence).toBeGreaterThan(0);
  });

  it('should flag low confidence segments', () => {
    const segment = { confidence: 0.65, /* ... */ };
    expect(isLowConfidenceSegment(segment)).toBe(true);
  });
});
```

### Integration Tests

```typescript
// tests/integration/ai-pipeline.test.ts
describe('AI Pipeline', () => {
  it('should transcribe → detect silence → generate captions', async () => {
    const mockAudioBlob = new Blob([/* ... */]);

    const transcript = await transcriptionService.transcribe(mockAudioBlob);
    expect(transcript.success).toBe(true);

    const captions = captionService.generate(transcript.transcript);
    expect(captions.length).toBeGreaterThan(0);
  });
});
```

### Manual Testing

- Record 1-minute video with speech → verify transcript accuracy
- Enable background blur → verify 30fps performance
- Record with intentional pauses → verify silence detection
- Export with captions → verify SRT/VTT format

---

## Common Pitfalls

### 1. Model Download Failures

**Issue**: CDN unavailable or CORS errors

**Solution**:
```typescript
const FALLBACK_MODELS = [
  'https://huggingface.co/Xenova/whisper-tiny.en',
  'https://cdn.jsdelivr.net/npm/@xenova/transformers/models/whisper-tiny.en'
];

// Try fallbacks on failure
```

### 2. localStorage Quota Exceeded

**Issue**: User hits 10MB limit

**Solution**:
- Display storage warning at 80% capacity
- Implement cleanup UI
- Suggest exporting transcripts to files

### 3. GPU Unavailable for MediaPipe

**Issue**: Browser doesn't support WebGL

**Solution**:
```typescript
const initResult = await segmentationService.initialize({ delegate: 'CPU' });
// Warn user about slower performance
```

### 4. Stream Cleanup Not Called

**Issue**: Camera stays on after recording stops

**Solution**:
```typescript
useEffect(() => {
  return () => {
    segmentationService.cleanup(); // Always cleanup in useEffect return
  };
}, []);
```

---

## Performance Optimization Checklist

- [ ] Models lazy-loaded (not in main bundle)
- [ ] Transcription runs in Web Worker
- [ ] Canvas context uses `{alpha: false, desynchronized: true}`
- [ ] MediaPipe uses GPU delegation when available
- [ ] localStorage writes batched (not per-word edit)
- [ ] Silence detection uses requestAnimationFrame (not intervals)
- [ ] Old recordings cleaned up before quota exceeded

---

## Next Steps

1. ✅ Implement services following contracts
2. ✅ Create UI components for transcript/caption editing
3. ✅ Integrate with existing recording workflow
4. ⏭️ Run `/speckit.tasks` to generate task breakdown
5. ⏭️ Implement P1 features first (transcription)
6. ⏭️ Add P2/P3 features incrementally

---

## Resources

- [transformer.js Docs](https://huggingface.co/docs/transformers.js)
- [MediaPipe Segmentation Guide](https://developers.google.com/mediapipe/solutions/vision/image_segmenter)
- [Web Audio API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [SRT Format Specification](https://en.wikipedia.org/wiki/SubRip)

**Questions?** See `specs/001-ai-transformer-features/spec.md` for requirements or `research.md` for technical decisions.
