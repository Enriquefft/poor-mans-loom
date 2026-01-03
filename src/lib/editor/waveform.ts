/**
 * Waveform Generation Service
 *
 * Generates visual waveform data from audio for timeline display.
 * Enhancement: High-priority UX improvement from Phase 7 audit.
 *
 * Uses Web Audio API to analyze audio amplitude over time.
 */

export interface WaveformData {
  /** Array of normalized amplitude values (0-1) */
  amplitudes: number[];
  /** Duration of audio in seconds */
  duration: number;
  /** Sample rate (samples per second of waveform data) */
  sampleRate: number;
}

export interface WaveformError {
  success: false;
  type: 'AUDIO_EXTRACTION_FAILED' | 'WAVEFORM_GENERATION_FAILED';
  message: string;
}

export type WaveformResult =
  | { success: true; data: WaveformData }
  | WaveformError;

/**
 * Generate waveform data from video blob
 *
 * @param videoBlob - Video blob containing audio track
 * @param samplesPerSecond - Waveform resolution (default: 20 samples/sec for smooth visualization)
 * @returns Promise with waveform data or error
 */
export async function generateWaveform(
  videoBlob: Blob,
  samplesPerSecond = 20,
): Promise<WaveformResult> {
  try {
    // Create audio context
    const audioContext = new AudioContext();

    // Read video blob as array buffer
    const arrayBuffer = await videoBlob.arrayBuffer();

    // Decode audio data
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      return {
        message:
          'Failed to decode audio from video. Video may not contain audio track.',
        success: false,
        type: 'AUDIO_EXTRACTION_FAILED',
      };
    }

    const duration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0); // Use first channel (mono)

    // Calculate how many audio samples per waveform sample
    const samplesPerWaveformPoint = Math.floor(
      sampleRate / samplesPerSecond,
    );
    const numWaveformSamples = Math.ceil(duration * samplesPerSecond);

    const amplitudes: number[] = [];

    // Process audio in chunks to generate waveform
    for (let i = 0; i < numWaveformSamples; i++) {
      const startSample = i * samplesPerWaveformPoint;
      const endSample = Math.min(
        startSample + samplesPerWaveformPoint,
        channelData.length,
      );

      // Calculate RMS (Root Mean Square) amplitude for this chunk
      let sum = 0;
      for (let j = startSample; j < endSample; j++) {
        sum += channelData[j] * channelData[j];
      }
      const rms = Math.sqrt(sum / (endSample - startSample));

      // Normalize to 0-1 range
      amplitudes.push(rms);
    }

    // Normalize all amplitudes to 0-1 range based on max value
    const maxAmplitude = Math.max(...amplitudes);
    if (maxAmplitude > 0) {
      for (let i = 0; i < amplitudes.length; i++) {
        amplitudes[i] = amplitudes[i] / maxAmplitude;
      }
    }

    // Clean up
    await audioContext.close();

    return {
      data: {
        amplitudes,
        duration,
        sampleRate: samplesPerSecond,
      },
      success: true,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : 'Unknown error during waveform generation',
      success: false,
      type: 'WAVEFORM_GENERATION_FAILED',
    };
  }
}

/**
 * Downsample waveform data for performance
 *
 * Useful when displaying very long recordings where high resolution isn't needed
 */
export function downsampleWaveform(
  waveformData: WaveformData,
  targetSamples: number,
): WaveformData {
  const currentSamples = waveformData.amplitudes.length;

  if (currentSamples <= targetSamples) {
    return waveformData; // Already small enough
  }

  const downsampled: number[] = [];
  const ratio = currentSamples / targetSamples;

  for (let i = 0; i < targetSamples; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);

    // Take max amplitude in this range (preserves peaks)
    let maxAmp = 0;
    for (let j = start; j < end; j++) {
      maxAmp = Math.max(maxAmp, waveformData.amplitudes[j]);
    }

    downsampled.push(maxAmp);
  }

  return {
    amplitudes: downsampled,
    duration: waveformData.duration,
    sampleRate: targetSamples / waveformData.duration,
  };
}
