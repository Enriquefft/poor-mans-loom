import { CameraSettings, CameraSize } from '../types';

export interface CompositorConfig {
  screenStream: MediaStream;
  cameraStream?: MediaStream | null;
  cameraSettings?: CameraSettings;
}

export interface CompositorResult {
  canvas: HTMLCanvasElement;
  canvasStream: MediaStream;
  updateCameraSettings: (settings: Partial<CameraSettings>) => void;
  cleanup: () => void;
}

function getCameraDrawPosition(
  settings: CameraSettings,
  canvasWidth: number,
  canvasHeight: number,
  cameraWidth: number,
  cameraHeight: number
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
      return { x: canvasWidth - cameraWidth - padding, y: canvasHeight - cameraHeight - padding };
    case 'bottom-center':
      return { x: (canvasWidth - cameraWidth) / 2, y: canvasHeight - cameraHeight - padding };
    default:
      return { x: canvasWidth - cameraWidth - padding, y: canvasHeight - cameraHeight - padding };
  }
}

function getCameraDimensions(settings: CameraSettings, canvasWidth: number): { width: number; height: number } {
  if (settings.customSize) {
    return settings.customSize;
  }
  
  const sizeMultiplier: Record<CameraSize, number> = {
    small: 0.15,
    medium: 0.2,
    large: 0.25,
  };
  
  const multiplier = sizeMultiplier[settings.size];
  const width = canvasWidth * multiplier;
  const height = width * 0.75;
  
  return { width, height };
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

export async function createCompositor(config: CompositorConfig): Promise<CompositorResult> {
  const { screenStream, cameraStream } = config;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { 
    alpha: false,
    desynchronized: true 
  })!;
  
  // Get screen dimensions
  const videoTrack = screenStream.getVideoTracks()[0];
  const { width, height } = videoTrack.getSettings();
  canvas.width = width || 1920;
  canvas.height = height || 1080;
  
  // Create and attach video elements to DOM
  const screenVideo = createVideoElement(screenStream);
  let cameraVideo: HTMLVideoElement | null = null;
  
  if (cameraStream) {
    cameraVideo = createVideoElement(cameraStream);
  }
  
  // Wait for screen video to be ready
  try {
    await waitForVideoReady(screenVideo);
    await screenVideo.play();
  } catch (error) {
    console.error('Screen video failed to start:', error);
    removeVideoElement(screenVideo);
    removeVideoElement(cameraVideo);
    throw new Error('Failed to initialize screen video');
  }
  
  // Wait for camera video to be ready (if enabled)
  if (cameraVideo) {
    try {
      await waitForVideoReady(cameraVideo);
      await cameraVideo.play();
    } catch (error) {
      console.warn('Camera video failed to start:', error);
      // Camera is optional, continue without it
      removeVideoElement(cameraVideo);
      cameraVideo = null;
    }
  }
  
  let currentSettings: CameraSettings = config.cameraSettings || {
    position: 'bottom-right',
    size: 'medium',
    shape: 'rectangle',
  };
  
  let animationFrameId: number;
  let isRunning = true;
  
  const drawFrame = () => {
    if (!isRunning) return;
    
    // Check if screen video is still playing and has data
    if (screenVideo.readyState >= 2 && !screenVideo.paused) {
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
    }
    
    // Draw camera overlay if available and playing
    if (cameraVideo && cameraVideo.readyState >= 2 && !cameraVideo.paused) {
      const cameraDims = getCameraDimensions(currentSettings, canvas.width);
      const cameraPos = getCameraDrawPosition(
        currentSettings,
        canvas.width,
        canvas.height,
        cameraDims.width,
        cameraDims.height
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
        ctx.roundRect(cameraPos.x, cameraPos.y, cameraDims.width, cameraDims.height, borderRadius);
        ctx.closePath();
        ctx.clip();
        
        ctx.translate(cameraPos.x + cameraDims.width, cameraPos.y);
        ctx.scale(-1, 1);
        ctx.drawImage(cameraVideo, 0, 0, cameraDims.width, cameraDims.height);
        
        ctx.restore();
        ctx.save();
        
        ctx.beginPath();
        ctx.roundRect(cameraPos.x, cameraPos.y, cameraDims.width, cameraDims.height, borderRadius);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      ctx.restore();
    }
    
    // Recover paused videos (ignore AbortError which is expected during cleanup)
    if (screenVideo.paused && isRunning) {
      screenVideo.play().catch((e) => {
        if (e.name !== 'AbortError') console.warn('Screen video play failed:', e);
      });
    }
    if (cameraVideo?.paused && isRunning) {
      cameraVideo.play().catch((e) => {
        if (e.name !== 'AbortError') console.warn('Camera video play failed:', e);
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
  };
  
  return {
    canvas,
    canvasStream,
    updateCameraSettings,
    cleanup,
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
