export interface AudioMixerResult {
  mixedStream: MediaStream;
  micStream: MediaStream | null;
  systemStream: MediaStream | null;
  audioContext: AudioContext;
  cleanup: () => void;
}

export type MicError = 'permission_denied' | 'not_found' | 'in_use' | 'unknown';

export interface MicErrorResult {
  error: MicError;
  message: string;
}

export async function getMicrophoneStream(deviceId?: string): Promise<MediaStream | MicErrorResult> {
  try {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(deviceId && { deviceId: { exact: deviceId } }),
      },
      video: false,
    };
    
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    const error = err as DOMException;
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return { error: 'permission_denied', message: 'Microphone permission denied. Please allow microphone access.' };
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return { error: 'not_found', message: 'No microphone found. Please connect a microphone.' };
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return { error: 'in_use', message: 'Microphone is in use by another application.' };
    }
    
    console.error('Error accessing microphone:', err);
    return { error: 'unknown', message: 'Failed to access microphone.' };
  }
}

export function isMicError(result: MediaStream | MicErrorResult): result is MicErrorResult {
  return result !== null && typeof result === 'object' && 'error' in result;
}

export async function getAudioDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput');
  } catch (err) {
    console.error('Error enumerating audio devices:', err);
    return [];
  }
}

export function createAudioMixer(
  micStream: MediaStream | null,
  systemAudioStream: MediaStream | null
): AudioMixerResult {
  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  
  const sources: AudioNode[] = [];
  
  if (micStream && micStream.getAudioTracks().length > 0) {
    const micSource = audioContext.createMediaStreamSource(micStream);
    const micGain = audioContext.createGain();
    micGain.gain.value = 1.0;
    micSource.connect(micGain);
    micGain.connect(destination);
    sources.push(micSource, micGain);
  }
  
  if (systemAudioStream && systemAudioStream.getAudioTracks().length > 0) {
    const systemSource = audioContext.createMediaStreamSource(systemAudioStream);
    const systemGain = audioContext.createGain();
    systemGain.gain.value = 1.0;
    systemSource.connect(systemGain);
    systemGain.connect(destination);
    sources.push(systemSource, systemGain);
  }
  
  const cleanup = () => {
    sources.forEach(source => {
      try {
        source.disconnect();
      } catch {
        // Already disconnected
      }
    });
    
    if (audioContext.state !== 'closed') {
      audioContext.close();
    }
  };
  
  return {
    mixedStream: destination.stream,
    micStream,
    systemStream: systemAudioStream,
    audioContext,
    cleanup,
  };
}

export function stopAudioStream(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
}

export function getAudioLevel(analyser: AnalyserNode): number {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  
  return sum / dataArray.length / 255;
}

export function createAudioAnalyser(
  audioContext: AudioContext,
  stream: MediaStream
): AnalyserNode | null {
  if (stream.getAudioTracks().length === 0) return null;
  
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  
  return analyser;
}
