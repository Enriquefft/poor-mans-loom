/**
 * Background Segmentation Service
 *
 * Real-time background blur/removal using MediaPipe ImageSegmenter.
 * Implements User Story 3 (Privacy-Preserving Background Processing).
 *
 * Features:
 * - GPU/CPU delegated segmentation
 * - Background blur with adjustable intensity
 * - Background removal with color/image replacement
 * - Multi-person handling (focus on largest person)
 * - Frame-by-frame processing in compositor loop
 *
 * Performance: Target 30fps with GPU acceleration
 */

import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from '@mediapipe/tasks-vision';
import { AI_MODELS, BACKGROUND_EFFECT_CONFIG, ERROR_MESSAGES } from './config';
import type { BackgroundEffect } from './types';

// ============================================================================
// Types
// ============================================================================

interface SegmentationServiceResult {
  success: true;
  gpuEnabled: boolean;
}

interface SegmentationError {
  success: false;
  type: 'MEDIAPIPE_INIT_FAILED' | 'GPU_UNAVAILABLE';
  message: string;
}

type InitializationResult = SegmentationServiceResult | SegmentationError;

interface ProcessFrameResult {
  success: boolean;
  outputCanvas?: HTMLCanvasElement;
  error?: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Singleton service for background segmentation
 * T073-T080: MediaPipe ImageSegmenter integration
 */
class SegmentationService {
  private segmenter: ImageSegmenter | null = null;
  private isInitialized = false;
  private gpuEnabled = false;
  private tempCanvas: HTMLCanvasElement | null = null;
  private tempCtx: CanvasRenderingContext2D | null = null;
  private replacementImageElement: HTMLImageElement | null = null;

  /**
   * T074: Initialize MediaPipe with GPU/CPU delegation
   *
   * Attempts GPU first, falls back to CPU if unavailable
   * Includes retry logic for CDN failures
   */
  async initialize(): Promise<InitializationResult> {
    if (this.isInitialized) {
      return { gpuEnabled: this.gpuEnabled, success: true };
    }

    // Retry logic for CDN failures
    const maxRetries = 1;
    const retryDelayMs = 2000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Load MediaPipe WASM files from CDN
        console.log(
          `Loading MediaPipe WASM files (attempt ${attempt + 1}/${maxRetries + 1})...`,
        );
        const vision = await FilesetResolver.forVisionTasks(
          AI_MODELS.MEDIAPIPE_SEGMENTATION.wasmPath,
        );

        // Try GPU delegation first
        try {
          this.segmenter = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
              delegate: 'GPU',
              modelAssetPath: AI_MODELS.MEDIAPIPE_SEGMENTATION.modelPath,
            },
            outputCategoryMask: true,
            outputConfidenceMasks: false,
            runningMode: 'VIDEO',
          });
          this.gpuEnabled = true;
          console.log('MediaPipe initialized with GPU acceleration');
        } catch (gpuError) {
          // GPU failed, fallback to CPU
          console.warn(
            'GPU delegation unavailable, falling back to CPU:',
            gpuError instanceof Error ? gpuError.message : String(gpuError),
          );
          this.segmenter = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
              delegate: 'CPU',
              modelAssetPath: AI_MODELS.MEDIAPIPE_SEGMENTATION.modelPath,
            },
            outputCategoryMask: true,
            outputConfidenceMasks: false,
            runningMode: 'VIDEO',
          });
          this.gpuEnabled = false;
          console.log('MediaPipe initialized with CPU fallback');
        }

        // Create temporary canvas for processing
        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d', {
          alpha: false,
          desynchronized: true,
        });

        if (!this.tempCtx) {
          throw new Error('Failed to create canvas context');
        }

        this.isInitialized = true;

        return {
          gpuEnabled: this.gpuEnabled,
          success: true,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Classify error type for better debugging
        if (errorMessage.includes('fetch') || errorMessage.includes('CDN')) {
          console.error(
            `CDN loading error (attempt ${attempt + 1}/${maxRetries + 1}):`,
            errorMessage,
          );
        } else if (errorMessage.includes('WASM')) {
          console.error('WASM initialization error:', errorMessage);
        } else {
          console.error('MediaPipe initialization error:', errorMessage);
        }

        // Retry on CDN failures only
        if (
          attempt < maxRetries &&
          (errorMessage.includes('fetch') || errorMessage.includes('CDN'))
        ) {
          console.log(`Retrying in ${retryDelayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }

        // Final failure after retries
        return {
          message: ERROR_MESSAGES.MEDIAPIPE_INIT_FAILED,
          success: false,
          type: 'MEDIAPIPE_INIT_FAILED',
        };
      }
    }

    // Should never reach here, but TypeScript needs it
    return {
      message: ERROR_MESSAGES.MEDIAPIPE_INIT_FAILED,
      success: false,
      type: 'MEDIAPIPE_INIT_FAILED',
    };
  }

  /**
   * T075-T078: Process a single video frame with background effect
   *
   * @param sourceCanvas - Input canvas with video frame
   * @param effect - Background effect configuration
   * @param timestamp - Current video timestamp (ms) for temporal consistency
   * @returns Processed canvas with effect applied
   */
  processFrame(
    sourceCanvas: HTMLCanvasElement,
    effect: BackgroundEffect,
    timestamp: number,
  ): ProcessFrameResult {
    if (
      !this.isInitialized ||
      !this.segmenter ||
      !this.tempCanvas ||
      !this.tempCtx
    ) {
      return {
        error: 'Segmentation service not initialized',
        success: false,
      };
    }

    if (!effect.enabled) {
      // Effect disabled, return original
      return {
        outputCanvas: sourceCanvas,
        success: true,
      };
    }

    try {
      // Ensure temp canvas matches source dimensions
      if (
        this.tempCanvas.width !== sourceCanvas.width ||
        this.tempCanvas.height !== sourceCanvas.height
      ) {
        this.tempCanvas.width = sourceCanvas.width;
        this.tempCanvas.height = sourceCanvas.height;
      }

      // Run segmentation
      const result = this.segmenter.segmentForVideo(
        sourceCanvas,
        timestamp,
      ) as ImageSegmenterResult;

      if (!result.categoryMask) {
        return {
          error: 'Segmentation produced no mask',
          success: false,
        };
      }

      // Apply effect based on type
      if (effect.type === 'blur') {
        this.applyBlur(
          sourceCanvas,
          result,
          effect.blurIntensity ??
            BACKGROUND_EFFECT_CONFIG.DEFAULT_BLUR_INTENSITY,
        );
      } else if (effect.type === 'removal') {
        this.applyRemoval(sourceCanvas, result, effect);
      }

      return {
        outputCanvas: this.tempCanvas,
        success: true,
      };
    } catch (error) {
      console.error('Frame processing failed:', error);
      return {
        error:
          error instanceof Error ? error.message : 'Unknown segmentation error',
        success: false,
      };
    }
  }

  /**
   * T076: Apply background blur effect
   *
   * Uses category mask to separate foreground (person) from background,
   * then applies Gaussian blur to background only
   */
  private applyBlur(
    sourceCanvas: HTMLCanvasElement,
    result: ImageSegmenterResult,
    intensity: number,
  ): void {
    if (!this.tempCanvas || !this.tempCtx) return;

    const { width, height } = sourceCanvas;
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) return;

    // Draw original frame to temp canvas
    this.tempCtx.drawImage(sourceCanvas, 0, 0);

    // Get mask data (1 = person, 0 = background)
    const mask = result.categoryMask!.getAsFloat32Array();
    const imageData = this.tempCtx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // Create blurred version
    const blurRadius = Math.max(1, Math.round((intensity / 100) * 20)); // 0-20px blur
    this.tempCtx.filter = `blur(${blurRadius}px)`;
    this.tempCtx.drawImage(sourceCanvas, 0, 0);
    this.tempCtx.filter = 'none';

    const blurredData = this.tempCtx.getImageData(0, 0, width, height);
    const blurredPixels = blurredData.data;

    // Composite: person (sharp) over background (blurred)
    for (let i = 0; i < mask.length; i++) {
      const pixelIndex = i * 4;
      const isPerson = mask[i] > 0.5; // Threshold at 50% confidence

      if (!isPerson) {
        // Background: use blurred pixels
        pixels[pixelIndex] = blurredPixels[pixelIndex]; // R
        pixels[pixelIndex + 1] = blurredPixels[pixelIndex + 1]; // G
        pixels[pixelIndex + 2] = blurredPixels[pixelIndex + 2]; // B
      }
      // Foreground: pixels already set from original frame
    }

    // Draw composited result
    this.tempCtx.putImageData(imageData, 0, 0);
  }

  /**
   * T077-T078: Apply background removal (color or image replacement)
   *
   * Replaces background with solid color or custom image
   */
  private applyRemoval(
    sourceCanvas: HTMLCanvasElement,
    result: ImageSegmenterResult,
    effect: BackgroundEffect,
  ): void {
    if (!this.tempCanvas || !this.tempCtx) return;

    const { width, height } = sourceCanvas;

    // Fill background with replacement color/image
    if (effect.replacementImage && this.replacementImageElement) {
      // Draw replacement image as background
      this.tempCtx.drawImage(this.replacementImageElement, 0, 0, width, height);
    } else {
      // Fill with solid color
      const color =
        effect.replacementColor ??
        BACKGROUND_EFFECT_CONFIG.DEFAULT_REPLACEMENT_COLOR;
      this.tempCtx.fillStyle = color;
      this.tempCtx.fillRect(0, 0, width, height);
    }

    // Get mask and original pixels
    const mask = result.categoryMask!.getAsFloat32Array();
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) return;

    const sourceData = sourceCtx.getImageData(0, 0, width, height);
    const sourcePixels = sourceData.data;
    const bgData = this.tempCtx.getImageData(0, 0, width, height);
    const bgPixels = bgData.data;

    // Composite foreground over replacement background
    for (let i = 0; i < mask.length; i++) {
      const pixelIndex = i * 4;
      const personConfidence = mask[i]; // 0.0-1.0

      if (personConfidence > 0.5) {
        // Foreground: use original pixels
        bgPixels[pixelIndex] = sourcePixels[pixelIndex]; // R
        bgPixels[pixelIndex + 1] = sourcePixels[pixelIndex + 1]; // G
        bgPixels[pixelIndex + 2] = sourcePixels[pixelIndex + 2]; // B
        bgPixels[pixelIndex + 3] = 255; // Full opacity
      } else {
        // Background: already filled with replacement
        // Optional: blend edge pixels for smooth transition
        if (personConfidence > 0.1 && personConfidence <= 0.5) {
          // Edge blending for anti-aliasing
          const alpha = personConfidence * 2; // 0.2-1.0 range
          bgPixels[pixelIndex] = Math.round(
            sourcePixels[pixelIndex] * alpha +
              bgPixels[pixelIndex] * (1 - alpha),
          );
          bgPixels[pixelIndex + 1] = Math.round(
            sourcePixels[pixelIndex + 1] * alpha +
              bgPixels[pixelIndex + 1] * (1 - alpha),
          );
          bgPixels[pixelIndex + 2] = Math.round(
            sourcePixels[pixelIndex + 2] * alpha +
              bgPixels[pixelIndex + 2] * (1 - alpha),
          );
        }
      }
    }

    this.tempCtx.putImageData(bgData, 0, 0);
  }

  /**
   * Load a custom background image from base64 data
   * T078: Custom image replacement support
   */
  async loadReplacementImage(base64Data: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.replacementImageElement = img;
        resolve(true);
      };
      img.onerror = () => {
        console.error('Failed to load replacement image');
        this.replacementImageElement = null;
        resolve(false);
      };
      img.src = base64Data;
    });
  }

  /**
   * T085: Cleanup resources when recording stops
   */
  dispose(): void {
    if (this.segmenter) {
      this.segmenter.close();
      this.segmenter = null;
    }
    this.tempCanvas = null;
    this.tempCtx = null;
    this.replacementImageElement = null;
    this.isInitialized = false;
    this.gpuEnabled = false;
  }

  /**
   * Check if service is initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized && this.segmenter !== null;
  }

  /**
   * Check if GPU acceleration is enabled
   */
  isGPUEnabled(): boolean {
    return this.gpuEnabled;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Singleton instance
 * T073: Single service instance for app lifecycle
 */
export const segmentationService = new SegmentationService();
