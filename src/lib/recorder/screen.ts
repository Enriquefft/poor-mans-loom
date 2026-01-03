export interface ScreenCaptureResult {
  stream: MediaStream;
  hasSystemAudio: boolean;
}

export async function startScreenCapture(
  includeSystemAudio = true,
): Promise<ScreenCaptureResult | null> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: includeSystemAudio
        ? {
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
          }
        : false,
      video: {
        displaySurface: 'monitor',
        frameRate: { ideal: 30, max: 60 },
      },
    });

    const hasSystemAudio = stream.getAudioTracks().length > 0;

    return { hasSystemAudio, stream };
  } catch (err) {
    console.error('Error starting screen capture:', err);
    return null;
  }
}

export function getScreenDimensions(stream: MediaStream): {
  width: number;
  height: number;
} {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) return { height: 1080, width: 1920 };

  const settings = videoTrack.getSettings();
  return {
    height: settings.height || 1080,
    width: settings.width || 1920,
  };
}

export function stopScreenCapture(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }
}
