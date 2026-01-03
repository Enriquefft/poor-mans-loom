export interface CameraStreamResult {
  stream: MediaStream;
  cleanup: () => void;
}

export type CameraError =
  | 'permission_denied'
  | 'not_found'
  | 'in_use'
  | 'unknown';

export interface CameraErrorResult {
  error: CameraError;
  message: string;
}

export async function getCameraStream(
  deviceId?: string,
): Promise<CameraStreamResult | CameraErrorResult> {
  try {
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: 'user',
        frameRate: { ideal: 30 },
        height: { ideal: 480 },
        width: { ideal: 640 },
        ...(deviceId && { deviceId: { exact: deviceId } }),
      },
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    const cleanup = () => {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    };

    return { cleanup, stream };
  } catch (err) {
    const error = err as DOMException;

    if (
      error.name === 'NotAllowedError' ||
      error.name === 'PermissionDeniedError'
    ) {
      return {
        error: 'permission_denied',
        message: 'Camera permission denied. Please allow camera access.',
      };
    }
    if (
      error.name === 'NotFoundError' ||
      error.name === 'DevicesNotFoundError'
    ) {
      return {
        error: 'not_found',
        message: 'No camera found. Please connect a camera.',
      };
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return {
        error: 'in_use',
        message: 'Camera is in use by another application.',
      };
    }

    console.error('Error accessing camera:', err);
    return { error: 'unknown', message: 'Failed to access camera.' };
  }
}

export function isCameraError(
  result: CameraStreamResult | CameraErrorResult,
): result is CameraErrorResult {
  return 'error' in result;
}

export async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput');
  } catch (err) {
    console.error('Error enumerating camera devices:', err);
    return [];
  }
}

export function createCameraVideoElement(
  stream: MediaStream,
): HTMLVideoElement {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.play().catch((e) => {
    if (e.name !== 'AbortError') console.error('Camera video play failed:', e);
  });
  return video;
}
