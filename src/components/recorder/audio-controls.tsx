'use client';

import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createAudioAnalyser, getAudioLevel } from '@/lib/recorder/audio';
import type { AudioSettings } from '@/lib/types';

interface AudioControlsProps {
  settings: AudioSettings;
  onSettingsChange: (settings: Partial<AudioSettings>) => void;
  micStream: MediaStream | null;
  systemStream: MediaStream | null;
  disabled?: boolean;
}

function AudioLevelMeter({ level }: { level: number }) {
  const bars = 5;
  const activeBarCount = Math.ceil(level * bars);
  const barHeights = Array.from(
    { length: bars },
    (_, i) => ((i + 1) / bars) * 100,
  );

  return (
    <div className="flex items-end gap-0.5 h-4">
      {barHeights.map((height, i) => (
        <div
          key={height}
          className={`w-1 rounded-full transition-all duration-75 ${
            i < activeBarCount
              ? i < 2
                ? 'bg-green-500'
                : i < 4
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              : 'bg-neutral-700'
          }`}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

export function AudioControls({
  settings,
  onSettingsChange,
  micStream,
  systemStream,
  disabled = false,
}: AudioControlsProps) {
  const [micLevel, setMicLevel] = useState(0);
  const [systemLevel, setSystemLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const systemAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!micStream && !systemStream) {
      setMicLevel(0);
      setSystemLevel(0);
      return;
    }

    audioContextRef.current = new AudioContext();

    if (micStream) {
      micAnalyserRef.current = createAudioAnalyser(
        audioContextRef.current,
        micStream,
      );
    }

    if (systemStream) {
      systemAnalyserRef.current = createAudioAnalyser(
        audioContextRef.current,
        systemStream,
      );
    }

    const updateLevels = () => {
      if (micAnalyserRef.current) {
        setMicLevel(getAudioLevel(micAnalyserRef.current));
      }
      if (systemAnalyserRef.current) {
        setSystemLevel(getAudioLevel(systemAnalyserRef.current));
      }
      animationFrameRef.current = requestAnimationFrame(updateLevels);
    };

    updateLevels();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        audioContextRef.current.close();
      }
    };
  }, [micStream, systemStream]);

  return (
    <div className="flex items-center gap-3">
      {/* Microphone control */}
      <div className="flex items-center gap-2">
        <Button
          variant={settings.microphoneEnabled ? 'default' : 'outline'}
          size="icon"
          onClick={() =>
            onSettingsChange({ microphoneEnabled: !settings.microphoneEnabled })
          }
          disabled={disabled}
          title={
            settings.microphoneEnabled
              ? 'Disable microphone'
              : 'Enable microphone'
          }
          className="relative"
        >
          {settings.microphoneEnabled ? (
            <Mic className="h-4 w-4" />
          ) : (
            <MicOff className="h-4 w-4" />
          )}
        </Button>
        {settings.microphoneEnabled && micStream && (
          <AudioLevelMeter level={micLevel} />
        )}
      </div>

      {/* System audio control */}
      <div className="flex items-center gap-2">
        <Button
          variant={settings.systemAudioEnabled ? 'default' : 'outline'}
          size="icon"
          onClick={() =>
            onSettingsChange({
              systemAudioEnabled: !settings.systemAudioEnabled,
            })
          }
          disabled={disabled}
          title={
            settings.systemAudioEnabled
              ? 'Disable system audio'
              : 'Enable system audio'
          }
          className="relative"
        >
          {settings.systemAudioEnabled ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </Button>
        {settings.systemAudioEnabled && systemStream && (
          <AudioLevelMeter level={systemLevel} />
        )}
      </div>
    </div>
  );
}
