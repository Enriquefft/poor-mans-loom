import { segmentationService } from '../ai/segmentation';
import type { BackgroundEffect } from '../ai/types';
import type {
  CameraSettings,
  CameraSize,
  CanvasDimension,
  RecordingMode,
} from '../types';

export interface CompositorConfig {
  mode: RecordingMode;
  screenStream?: MediaStream | null;
  cameraStream?: MediaStream | null;
  cameraOnlyDimensions?: CanvasDimension;
  cameraSettings?: CameraSettings;
  backgroundEffect?: BackgroundEffect; // T081: Background effect support
}

export interface CompositorResult {
  canvas: HTMLCanvasElement;
  canvasStream: MediaStream;
  updateCameraSettings: (settings: Partial<CameraSettings>) => void;
  cleanup: () => void;
  getCurrentFPS: () => number; // T101: FPS monitoring
}

function getCameraDrawPosition(
  settings: CameraSettings,
  canvasWidth: number,
  canvasHeight: number,
  cameraWidth: number,
  cameraHeight: number,
): { x: number; y: number } {
  const padding = 20;

  if (settings.customPosition) {
    return settings.customPosition;
  }

  switch (settings.position) {
    case 'top-left':
      return { x: padding, y: padding };
    case 'top-right':
      return { x: canvasWidth - cameraWidth - padding, y: padding };
    case 'bottom-left':
      return { x: padding, y: canvasHeight - cameraHeight - padding };
    case 'bottom-right':
      return {
        x: canvasWidth - cameraWidth - padding,
        y: canvasHeight - cameraHeight - padding,
      };
    case 'bottom-center':
      return {
        x: (canvasWidth - cameraWidth) / 2,
        y: canvasHeight - cameraHeight - padding,
      };
    default:
      return {
        x: canvasWidth - cameraWidth - padding,
        y: canvasHeight - cameraHeight - padding,
      };
  }
}

function getCameraDimensions(
  settings: CameraSettings,
  canvasWidth: number,
): { width: number; height: number } {
  if (settings.customSize) {
    return settings.customSize;
  }

  const sizeMultiplier: Record<CameraSize, number> = {
    large: 0.25,
    medium: 0.2,
    small: 0.15,
  };

  const multiplier = sizeMultiplier[settings.size];
  const width = canvasWidth * multiplier;
  const height = width * 0.75;

  return { height, width };
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Video loading timeout'));
    }, 10000);

    const onCanPlay = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error('Video loading failed'));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);
  });
}

function createVideoElement(stream: MediaStream): HTMLVideoElement {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;

  // Attach to DOM (hidden) to prevent browser suspension
  video.style.position = 'fixed';
  video.style.top = '-9999px';
  video.style.left = '-9999px';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  document.body.appendChild(video);

  return video;
}

function removeVideoElement(video: HTMLVideoElement | null): void {
  if (video) {
    video.pause();
    video.srcObject = null;
    if (video.parentNode) {
      video.parentNode.removeChild(video);
    }
  }
}

export async function createCompositor(
  config: CompositorConfig,
): Promise<CompositorResult> {
  const { screenStream, cameraStream } = config;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {
    alpha: false,
    desynchronized: true,
  })!;

  // Determine canvas dimensions based on mode
  let canvasWidth: number;
  let canvasHeight: number;

  if (config.mode === 'camera-only') {
    // Camera-only: use user-selected dimensions
    if (!config.cameraOnlyDimensions) {
      throw new Error('cameraOnlyDimensions required for camera-only mode');
    }
    canvasWidth = config.cameraOnlyDimensions.width;
    canvasHeight = config.cameraOnlyDimensions.height;
  } else {
    // Screen-only or screen+camera: use screen dimensions
    if (!config.screenStream) {
      throw new Error(
        'Screen stream required for screen-only and screen+camera modes',
      );
    }
    const videoTrack = config.screenStream.getVideoTracks()[0];
    const { width, height } = videoTrack.getSettings();
    canvasWidth = width || 1920;
    canvasHeight = height || 1080;
  }

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Create screen video only if needed
  let screenVideo: HTMLVideoElement | null = null;
  if (config.mode !== 'camera-only' && config.screenStream) {
    screenVideo = createVideoElement(config.screenStream);
    try {
      await waitForVideoReady(screenVideo);
      await screenVideo.play();
    } catch (error) {
      console.error('Screen video failed to start:', error);
      removeVideoElement(screenVideo);
      throw new Error('Failed to initialize screen video');
    }
  }

  // Create camera video if needed
  let cameraVideo: HTMLVideoElement | null = null;
  if (
    (config.mode === 'camera-only' || config.mode === 'screen+camera') &&
    config.cameraStream
  ) {
    cameraVideo = createVideoElement(config.cameraStream);
    try {
      await waitForVideoReady(cameraVideo);
      await cameraVideo.play();
    } catch (error) {
      if (config.mode === 'camera-only') {
        // Camera is required for camera-only mode - fail hard
        removeVideoElement(screenVideo);
        removeVideoElement(cameraVideo);
        throw new Error('Failed to initialize camera video');
      }
      // Camera is optional for screen+camera mode - continue without
      console.warn('Camera video failed to start:', error);
      removeVideoElement(cameraVideo);
      cameraVideo = null;
    }
  }

  let currentSettings: CameraSettings = config.cameraSettings || {
    position: 'bottom-right',
    shape: 'rectangle',
    size: 'medium',
  };

  // T082: Initialize segmentation if background effect enabled
  let segmentationEnabled = false;
  let segmentationCanvas: HTMLCanvasElement | null = null;
  let frameTimestamp = 0;

  if (config.backgroundEffect?.enabled && cameraVideo) {
    const initResult = await segmentationService.initialize();
    if (initResult.success) {
      segmentationEnabled = true;
      segmentationCanvas = document.createElement('canvas');
      console.log(
        `Background segmentation initialized (GPU: ${initResult.gpuEnabled})`,
      );
    } else {
      console.warn('Segmentation init failed, continuing without effects');
    }
  }

  let animationFrameId: number;
  let isRunning = true;

  // T101: FPS monitoring
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let fps = 30;
  let fpsUpdateTime = performance.now();

  const drawFrame = () => {
    if (!isRunning) return;

    // T101: Calculate FPS
    const now = performance.now();
    frameCount++;

    // Update FPS every second
    if (now - fpsUpdateTime >= 1000) {
      fps = Math.round((frameCount * 1000) / (now - fpsUpdateTime));
      frameCount = 0;
      fpsUpdateTime = now;

      // T102: Warn if FPS drops below 25
      if (segmentationEnabled && fps < 25) {
        console.warn(`Low FPS detected: ${fps} fps (background effects active)`);
      }
    }

    lastFrameTime = now;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (config.mode === 'camera-only') {
      // ===== CAMERA-ONLY MODE =====
      // T083: Apply segmentation if enabled, otherwise draw camera directly
      if (cameraVideo && cameraVideo.readyState >= 2 && !cameraVideo.paused) {
        if (
          segmentationEnabled &&
          config.backgroundEffect &&
          segmentationCanvas
        ) {
          // Draw camera to temp canvas first
          if (!segmentationCanvas.width) {
            segmentationCanvas.width = canvas.width;
            segmentationCanvas.height = canvas.height;
          }

          const tempCtx = segmentationCanvas.getContext('2d', {
            alpha: false,
            desynchronized: true,
          });

          if (tempCtx) {
            // Draw camera with flip to temp canvas
            tempCtx.save();
            tempCtx.translate(segmentationCanvas.width, 0);
            tempCtx.scale(-1, 1);
            tempCtx.drawImage(
              cameraVideo,
              0,
              0,
              segmentationCanvas.width,
              segmentationCanvas.height,
            );
            tempCtx.restore();

            // Process frame with segmentation
            frameTimestamp += 33; // ~30fps
            const result = segmentationService.processFrame(
              segmentationCanvas,
              config.backgroundEffect,
              frameTimestamp,
            );

            // T086: Fallback to no-effect mode if segmentation fails
            if (result.success && result.outputCanvas) {
              ctx.drawImage(result.outputCanvas, 0, 0);
            } else {
              // Fallback: draw original without effect
              ctx.drawImage(segmentationCanvas, 0, 0);
            }
          }
        } else {
          // No segmentation: draw camera directly with flip
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1); // Horizontal flip
          ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
          ctx.restore();
        }
      }
    } else if (config.mode === 'screen-only') {
      // ===== SCREEN-ONLY MODE =====
      // Draw screen full-screen
      if (screenVideo && screenVideo.readyState >= 2 && !screenVideo.paused) {
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
      }
    } else {
      // ===== SCREEN+CAMERA MODE =====
      // Draw screen as background
      if (screenVideo && screenVideo.readyState >= 2 && !screenVideo.paused) {
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
      }

      // Draw camera overlay with positioning/sizing
      if (cameraVideo && cameraVideo.readyState >= 2 && !cameraVideo.paused) {
        const cameraDims = getCameraDimensions(currentSettings, canvas.width);
        const cameraPos = getCameraDrawPosition(
          currentSettings,
          canvas.width,
          canvas.height,
          cameraDims.width,
          cameraDims.height,
        );

        ctx.save();

        if (currentSettings.shape === 'circle') {
          const radius = Math.min(cameraDims.width, cameraDims.height) / 2;
          const centerX = cameraPos.x + cameraDims.width / 2;
          const centerY = cameraPos.y + cameraDims.height / 2;

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          ctx.translate(cameraPos.x + cameraDims.width, cameraPos.y);
          ctx.scale(-1, 1);
          ctx.drawImage(cameraVideo, 0, 0, cameraDims.width, cameraDims.height);

          ctx.restore();
          ctx.save();

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          const borderRadius = 8;

          ctx.beginPath();
          ctx.roundRect(
            cameraPos.x,
            cameraPos.y,
            cameraDims.width,
            cameraDims.height,
            borderRadius,
          );
          ctx.closePath();
          ctx.clip();

          ctx.translate(cameraPos.x + cameraDims.width, cameraPos.y);
          ctx.scale(-1, 1);
          ctx.drawImage(cameraVideo, 0, 0, cameraDims.width, cameraDims.height);

          ctx.restore();
          ctx.save();

          ctx.beginPath();
          ctx.roundRect(
            cameraPos.x,
            cameraPos.y,
            cameraDims.width,
            cameraDims.height,
            borderRadius,
          );
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.restore();
      }
    }

    // Auto-recover paused videos
    if (screenVideo?.paused && isRunning) {
      screenVideo.play().catch((e) => {
        if (e.name !== 'AbortError')
          console.warn('Screen video play failed:', e);
      });
    }
    if (cameraVideo?.paused && isRunning) {
      cameraVideo.play().catch((e) => {
        if (e.name !== 'AbortError')
          console.warn('Camera video play failed:', e);
      });
    }

    animationFrameId = requestAnimationFrame(drawFrame);
  };

  // Start the draw loop
  drawFrame();

  // Create canvas stream with explicit frame rate
  const canvasStream = canvas.captureStream(30);

  const updateCameraSettings = (settings: Partial<CameraSettings>) => {
    currentSettings = { ...currentSettings, ...settings };
  };

  const cleanup = () => {
    isRunning = false;
    cancelAnimationFrame(animationFrameId);
    removeVideoElement(screenVideo);
    removeVideoElement(cameraVideo);

    // T085: Cleanup segmentation resources
    if (segmentationEnabled) {
      segmentationService.dispose();
      segmentationCanvas = null;
    }
  };

  // T101: Expose FPS getter
  const getCurrentFPS = () => fps;

  return {
    canvas,
    canvasStream,
    cleanup,
    getCurrentFPS,
    updateCameraSettings,
  };
}

export function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return 'video/webm';
}

export function createMediaRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = getSupportedMimeType();
  return new MediaRecorder(stream, { mimeType });
}

export function createVideoBlob(chunks: BlobPart[]): Blob {
  return new Blob(chunks, { type: getSupportedMimeType() });
}
