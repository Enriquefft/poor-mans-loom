export interface ScreenCaptureResult {
  stream: MediaStream;
  hasSystemAudio: boolean;
}

export async function startScreenCapture(includeSystemAudio: boolean = true): Promise<ScreenCaptureResult | null> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'monitor',
        frameRate: { ideal: 30, max: 60 },
      },
      audio: includeSystemAudio ? {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      } : false,
    });

    const hasSystemAudio = stream.getAudioTracks().length > 0;
    
    return { stream, hasSystemAudio };
  } catch (err) {
    console.error('Error starting screen capture:', err);
    return null;
  }
}

export function getScreenDimensions(stream: MediaStream): { width: number; height: number } {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) return { width: 1920, height: 1080 };
  
  const settings = videoTrack.getSettings();
  return {
    width: settings.width || 1920,
    height: settings.height || 1080,
  };
}

export function stopScreenCapture(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
}

