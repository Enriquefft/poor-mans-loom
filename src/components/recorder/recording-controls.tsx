"use client";

import { Button } from "@/components/ui/button";
import { Circle, Square, Pause, Play, Video, VideoOff, RotateCcw } from "lucide-react";
import { RecordingState } from "@/lib/types";

interface RecordingControlsProps {
  recordingState: RecordingState;
  cameraEnabled: boolean;
  hasRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onToggleCamera: () => void;
  onNewRecording: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function RecordingControls({
  recordingState,
  cameraEnabled,
  hasRecording,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onToggleCamera,
  onNewRecording,
}: RecordingControlsProps) {
  const { isRecording, isPaused, duration } = recordingState;

  return (
    <div className="flex items-center justify-between w-full">
      {/* Left: Camera toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={cameraEnabled ? "default" : "outline"}
          size="icon"
          onClick={onToggleCamera}
          disabled={isRecording}
          title={cameraEnabled ? "Disable camera" : "Enable camera"}
        >
          {cameraEnabled ? (
            <Video className="h-4 w-4" />
          ) : (
            <VideoOff className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Center: Recording controls */}
      <div className="flex items-center gap-3">
        {isRecording ? (
          <>
            {/* Recording timer */}
            <div className="flex items-center gap-2 min-w-[80px]">
              <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
              <span className="font-mono text-sm text-neutral-300">
                {formatDuration(duration)}
              </span>
            </div>

            {/* Pause/Resume */}
            <Button
              variant="outline"
              size="icon"
              onClick={isPaused ? onResumeRecording : onPauseRecording}
              title={isPaused ? "Resume recording" : "Pause recording"}
            >
              {isPaused ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </Button>

            {/* Stop */}
            <Button
              variant="destructive"
              onClick={onStopRecording}
            >
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          </>
        ) : (
          <>
            {hasRecording && (
              <Button
                variant="outline"
                onClick={onNewRecording}
                title="Start new recording"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                New
              </Button>
            )}
            <Button
              variant="default"
              onClick={onStartRecording}
              className="bg-red-600 hover:bg-red-700"
            >
              <Circle className="h-4 w-4 mr-2 fill-current" />
              Record
            </Button>
          </>
        )}
      </div>

      {/* Right: Spacer for balance */}
      <div className="w-10" />
    </div>
  );
}

