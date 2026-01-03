'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { BackgroundEffect } from '@/lib/ai/types';
import {
  createAudioMixer,
  getMicrophoneStream,
  isMicError,
  stopAudioStream,
} from '@/lib/recorder/audio';
import { getCameraStream, isCameraError } from '@/lib/recorder/camera';
import {
  createCompositor,
  createMediaRecorder,
  createVideoBlob,
} from '@/lib/recorder/compositor';
import { startScreenCapture, stopScreenCapture } from '@/lib/recorder/screen';
import type {
  AudioSettings,
  CameraSettings,
  CanvasDimension,
  RecordingMode,
  RecordingState,
} from '@/lib/types';
import { CANVAS_PRESETS } from '@/lib/types';
import { AudioControls } from './audio-controls';
import { BackgroundControls } from './background-controls';
import { CameraOverlay } from './camera-overlay';
import { DimensionSelector } from './dimension-selector';
import { ModeSelector } from './mode-selector';
import { RecordingControls } from './recording-controls';

interface ScreenRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
}

const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  position: 'bottom-right',
  shape: 'rectangle',
  size: 'medium',
};

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  microphoneEnabled: true,
  systemAudioEnabled: true,
};

const DEFAULT_BACKGROUND_EFFECT: BackgroundEffect = {
  enabled: false,
  type: 'blur',
  blurIntensity: 50,
};

export function ScreenRecorder({ onRecordingComplete }: ScreenRecorderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Recording mode state (no persistence, always defaults to screen+camera)
  const [recordingMode, setRecordingMode] =
    useState<RecordingMode>('screen+camera');

  // Camera-only dimension settings
  const [cameraOnlyDimensions, setCameraOnlyDimensions] =
    useState<CanvasDimension>(CANVAS_PRESETS['720p']); // Default to 720p

  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>({
    duration: 0,
    isPaused: false,
    isRecording: false,
    mode: 'screen+camera',
    startTime: null,
  });

  // Settings
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>(
    DEFAULT_CAMERA_SETTINGS,
  );
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(
    DEFAULT_AUDIO_SETTINGS,
  );
  const [backgroundEffect, setBackgroundEffect] = useState<BackgroundEffect>(
    DEFAULT_BACKGROUND_EFFECT,
  );
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // Streams
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [systemAudioStream, setSystemAudioStream] =
    useState<MediaStream | null>(null);

  // Refs for cleanup
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const compositorRef = useRef<Awaited<
    ReturnType<typeof createCompositor>
  > | null>(null);
  const audioMixerRef = useRef<ReturnType<typeof createAudioMixer> | null>(
    null,
  );
  const chunksRef = useRef<BlobPart[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize camera stream (mode-aware)
  useEffect(() => {
    if (recordingMode === 'screen+camera') {
      // screen+camera: optional camera, initialize when enabled
      if (cameraEnabled && !cameraStream) {
        getCameraStream().then((result) => {
          if (isCameraError(result)) {
            toast.error(result.message);
            setCameraEnabled(false);
          } else {
            setCameraStream(result.stream);
          }
        });
      } else if (!cameraEnabled && cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
    } else if (recordingMode === 'screen-only') {
      // screen-only: clean up camera if present
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
    } else if (recordingMode === 'camera-only') {
      // camera-only: camera initialized on-demand in startRecording
      // No pre-initialization needed
    }
  }, [recordingMode, cameraEnabled, cameraStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }

    compositorRef.current?.cleanup();
    compositorRef.current = null;

    audioMixerRef.current?.cleanup();
    audioMixerRef.current = null;

    stopScreenCapture(screenStreamRef.current);
    screenStreamRef.current = null;

    stopAudioStream(micStream);
    setMicStream(null);

    setSystemAudioStream(null);
  }, [micStream]);

  const startRecording = useCallback(async () => {
    try {
      chunksRef.current = [];

      // ===== SCREEN CAPTURE (screen-only and screen+camera modes) =====
      let screenResult: Awaited<ReturnType<typeof startScreenCapture>> | null =
        null;
      let systemAudio: MediaStream | null = null;

      if (
        recordingMode === 'screen-only' ||
        recordingMode === 'screen+camera'
      ) {
        screenResult = await startScreenCapture(
          audioSettings.systemAudioEnabled,
        );
        if (!screenResult) {
          toast.error('Screen capture was cancelled or denied');
          return;
        }

        screenStreamRef.current = screenResult.stream;

        if (screenResult.hasSystemAudio && audioSettings.systemAudioEnabled) {
          systemAudio = new MediaStream(screenResult.stream.getAudioTracks());
          setSystemAudioStream(systemAudio);
        }
      }

      // ===== CAMERA STREAM =====
      let cameraForRecording: MediaStream | null = null;

      if (recordingMode === 'camera-only') {
        // Camera-only: camera is REQUIRED
        if (!cameraStream) {
          const result = await getCameraStream();
          if (isCameraError(result)) {
            toast.error(result.message);
            return;
          }
          setCameraStream(result.stream);
          cameraForRecording = result.stream;
        } else {
          cameraForRecording = cameraStream;
        }
      } else if (recordingMode === 'screen+camera') {
        // screen+camera: camera is optional
        cameraForRecording = cameraEnabled ? cameraStream : null;
      }

      // ===== MICROPHONE =====
      let mic: MediaStream | null = null;
      if (audioSettings.microphoneEnabled) {
        const micResult = await getMicrophoneStream(
          audioSettings.microphoneDeviceId,
        );
        if (isMicError(micResult)) {
          toast.warning(`${micResult.message} Recording without microphone.`);
        } else {
          mic = micResult;
          setMicStream(mic);
        }
      }

      // ===== AUDIO MIXER =====
      const audioMixer = createAudioMixer(mic, systemAudio);
      audioMixerRef.current = audioMixer;

      // ===== COMPOSITOR =====
      let compositor;
      try {
        compositor = await createCompositor({
          backgroundEffect, // T097: Pass background effect to compositor
          cameraOnlyDimensions:
            recordingMode === 'camera-only' ? cameraOnlyDimensions : undefined,
          cameraSettings,
          cameraStream: cameraForRecording,
          mode: recordingMode,
          screenStream: screenResult?.stream || null,
        });
        compositorRef.current = compositor;
      } catch (compositorError) {
        console.error('Compositor initialization failed:', compositorError);
        toast.error('Failed to initialize video compositor');
        cleanup();
        return;
      }

      // Combine video and audio streams
      const combinedStream = new MediaStream([
        ...compositor.canvasStream.getVideoTracks(),
        ...audioMixer.mixedStream.getAudioTracks(),
      ]);

      // Create and start media recorder
      const recorder = createMediaRecorder(combinedStream);
      mediaRecorderRef.current = recorder;

      // Store start time in a ref to access in onstop
      const startTime = Date.now();
      const startTimeRef = { current: startTime };

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const blob = createVideoBlob(chunksRef.current);
        cleanup();
        setRecordingState({
          duration: 0,
          isPaused: false,
          isRecording: false,
          mode: recordingMode,
          startTime: null,
        });
        onRecordingComplete(blob, duration);
        toast.success('Recording completed!');
      };

      // Handle screen share stop (only for screen modes)
      if (screenResult) {
        screenResult.stream.getVideoTracks()[0].onended = () => {
          if (mediaRecorderRef.current?.state !== 'inactive') {
            stopRecording();
          }
        };
      }

      recorder.start(100);

      setRecordingState({
        duration: 0,
        isPaused: false,
        isRecording: true,
        mode: recordingMode,
        startTime,
      });

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setRecordingState((prev) => ({
          ...prev,
          duration: prev.isPaused
            ? prev.duration
            : Math.floor((Date.now() - startTime) / 1000),
        }));
      }, 1000);

      toast.success('Recording started!');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording');
      cleanup();
    }
  }, [
    recordingMode,
    cameraOnlyDimensions,
    audioSettings,
    cameraEnabled,
    cameraStream,
    cameraSettings,
    cleanup,
    onRecordingComplete,
    stopRecording,
  ]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.pause();
      setRecordingState((prev) => ({ ...prev, isPaused: true }));
      toast.info('Recording paused');
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'paused'
    ) {
      mediaRecorderRef.current.resume();
      setRecordingState((prev) => ({ ...prev, isPaused: false }));
      toast.info('Recording resumed');
    }
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraEnabled((prev) => !prev);
  }, []);

  const handleCameraSettingsChange = useCallback(
    (settings: Partial<CameraSettings>) => {
      setCameraSettings((prev) => ({ ...prev, ...settings }));
      compositorRef.current?.updateCameraSettings(settings);
    },
    [],
  );

  const handleAudioSettingsChange = useCallback(
    (settings: Partial<AudioSettings>) => {
      setAudioSettings((prev) => ({ ...prev, ...settings }));
    },
    [],
  );

  return (
    <div className="w-full space-y-4">
      {/* Preview area */}
      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-neutral-950 border border-neutral-800 overflow-hidden flex items-center justify-center noise-texture noise-texture-subtle"
      >
        {recordingState.isRecording ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${recordingState.isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}
              />
              <span className="text-neutral-300 font-mono text-lg">
                Recording{recordingState.isPaused ? ' — Paused' : ''}
              </span>
            </div>
            <p className="text-neutral-500 font-mono text-xs">
              Your screen is being captured
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-neutral-500 font-mono text-sm">
              Click Record to start capturing
            </p>
            <p className="text-neutral-600 font-mono text-xs mt-1">
              Screen + {audioSettings.microphoneEnabled ? 'Mic' : ''}{' '}
              {audioSettings.systemAudioEnabled ? '+ System Audio' : ''}
            </p>
          </div>
        )}

        {/* Camera overlay */}
        {cameraEnabled && cameraStream && (
          <CameraOverlay
            stream={cameraStream}
            settings={cameraSettings}
            onSettingsChange={handleCameraSettingsChange}
            containerRef={containerRef}
            isRecording={recordingState.isRecording}
            mode={recordingMode}
          />
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4">
        {/* Mode and dimension selection */}
        <div className="flex items-center justify-between">
          <ModeSelector
            selected={recordingMode}
            onSelect={setRecordingMode}
            disabled={recordingState.isRecording}
          />
          {recordingMode === 'camera-only' && (
            <DimensionSelector
              selected={cameraOnlyDimensions}
              onSelect={setCameraOnlyDimensions}
              disabled={recordingState.isRecording}
            />
          )}
        </div>

        {/* Audio controls */}
        <div className="flex items-center justify-between">
          <AudioControls
            settings={audioSettings}
            onSettingsChange={handleAudioSettingsChange}
            micStream={micStream}
            systemStream={systemAudioStream}
            disabled={recordingState.isRecording}
          />
        </div>

        {/* T097: Background controls (camera-only or screen+camera with camera) */}
        {(recordingMode === 'camera-only' ||
          (recordingMode === 'screen+camera' && cameraEnabled)) && (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 noise-texture noise-texture-subtle">
            <BackgroundControls
              effect={backgroundEffect}
              onEffectChange={setBackgroundEffect}
              disabled={recordingState.isRecording}
            />
          </div>
        )}

        {/* Recording controls */}
        <RecordingControls
          recordingState={recordingState}
          cameraEnabled={cameraEnabled}
          hasRecording={false}
          mode={recordingMode}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onPauseRecording={pauseRecording}
          onResumeRecording={resumeRecording}
          onToggleCamera={toggleCamera}
          onNewRecording={() => {}}
        />
      </div>
    </div>
  );
}
