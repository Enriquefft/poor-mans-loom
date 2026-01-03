/**
 * Silence Markers Component
 *
 * Visualizes silence segments on timeline with controls for detection and removal.
 * Implements UI for User Story 2 (Automatic Silence Removal).
 */

import {
  ChevronDown,
  ChevronUp,
  Clock,
  Play,
  RotateCcw,
  Settings,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { SilenceSegment } from '@/lib/ai/types';
import {
  batchDeleteSilence,
  getTimeSavedBySilenceRemoval,
  getTotalSilenceDuration,
  markSilenceForDeletion,
} from '@/lib/editor/timeline';
import type { EditorState } from '@/lib/types';

interface SilenceMarkersProps {
  editorState: EditorState;
  onEditorStateChange: (state: EditorState) => void;
  onSeekTo: (time: number) => void;
  currentTime: number;
  onDetectSilence?: () => void;
  isDetecting?: boolean;
}

export function SilenceMarkers({
  editorState,
  onEditorStateChange,
  onSeekTo,
  currentTime,
  onDetectSilence,
  isDetecting = false,
}: SilenceMarkersProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [thresholdDb, setThresholdDb] = useState(-40);
  const [minDuration, setMinDuration] = useState(2.0);

  const silenceSegments = editorState.silenceSegments || [];
  const hasSilence = silenceSegments.length > 0;
  const totalSilence = getTotalSilenceDuration(editorState);
  const timeSaved = getTimeSavedBySilenceRemoval(editorState);
  const deletedCount = silenceSegments.filter((s) => s.deleted).length;

  // T062: Toggle individual silence segment
  const handleToggleSilence = useCallback(
    (segmentId: string, deleted: boolean) => {
      const updated = markSilenceForDeletion(editorState, segmentId, deleted);
      onEditorStateChange(updated);

      const action = deleted ? 'marked for removal' : 'restored';
      toast.success(`Silence segment ${action}`);
    },
    [editorState, onEditorStateChange],
  );

  // T061: Remove all silence with confirmation
  const handleRemoveAll = useCallback(() => {
    if (deletedCount === silenceSegments.length) {
      // All already deleted, restore all
      const updated = batchDeleteSilence(editorState, false);
      onEditorStateChange(updated);
      toast.info('All silence segments restored');
    } else {
      // Confirm before deleting all
      if (
        window.confirm(
          `Remove all ${silenceSegments.length} silence segments?\n\nThis will save ${totalSilence.toFixed(1)} seconds in your final export.`,
        )
      ) {
        const updated = batchDeleteSilence(editorState, true);
        onEditorStateChange(updated);
        toast.success(
          `Marked ${silenceSegments.length} silence segments for removal`,
        );
      }
    }
  }, [
    editorState,
    onEditorStateChange,
    silenceSegments.length,
    deletedCount,
    totalSilence,
  ]);

  // T062: Preview silence segment (seek to start)
  const handlePreviewSegment = useCallback(
    (segment: SilenceSegment) => {
      onSeekTo(segment.startTime);
      toast.info(`Playing silence at ${segment.startTime.toFixed(1)}s`);
    },
    [onSeekTo],
  );

  // Calculate timeline position percentage
  const getTimelinePosition = (time: number) => {
    return (time / editorState.duration) * 100;
  };

  if (!hasSilence && !isDetecting) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 noise-texture noise-texture-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <VolumeX className="w-5 h-5 text-neutral-500" />
            <div>
              <p className="text-sm font-medium text-neutral-300">
                No silence detected
              </p>
              <p className="text-xs text-neutral-500">
                Detect silence to automatically remove long pauses
              </p>
            </div>
          </div>
          {onDetectSilence && (
            <Button onClick={onDetectSilence} variant="outline" size="sm">
              <Volume2 className="w-4 h-4 mr-2" />
              Detect Silence
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isDetecting) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 noise-texture noise-texture-subtle">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-neutral-600 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm text-neutral-400 font-mono">
            Detecting silence...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg noise-texture noise-texture-subtle">
      {/* T063: Statistics Header */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <VolumeX className="w-5 h-5 text-orange-500" />
            <h3 className="text-sm font-medium text-neutral-200">
              Silence Detection
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {/* T060: Settings Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4 mr-1" />
              Settings
              {showSettings ? (
                <ChevronUp className="w-3 h-3 ml-1" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-1" />
              )}
            </Button>

            {/* T061: Remove/Restore All Button */}
            <Button
              variant={deletedCount > 0 ? 'outline' : 'default'}
              size="sm"
              onClick={handleRemoveAll}
              disabled={!hasSilence}
            >
              {deletedCount === silenceSegments.length ? (
                <>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Restore All
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remove All
                </>
              )}
            </Button>
          </div>
        </div>

        {/* T063: Statistics Display */}
        <div className="grid grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <span className="text-neutral-500">Segments:</span>
            <span className="ml-2 text-neutral-200">
              {silenceSegments.length}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Total Silence:</span>
            <span className="ml-2 text-neutral-200">
              {totalSilence.toFixed(1)}s
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Time Saved:</span>
            <span className="ml-2 text-orange-400 font-medium">
              {timeSaved.toFixed(1)}s
            </span>
            {deletedCount > 0 && (
              <span className="ml-1 text-neutral-600">
                ({deletedCount} marked)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* T060: Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-neutral-800 bg-neutral-900/30">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium text-neutral-400 mb-2 block">
                Threshold (dB): {thresholdDb}
              </div>
              <Slider
                value={[thresholdDb]}
                onValueChange={(values) => setThresholdDb(values[0])}
                min={-60}
                max={-20}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-neutral-600 mt-1">
                Lower values detect quieter sounds as silence
              </p>
            </div>
            <div>
              <div className="text-xs font-medium text-neutral-400 mb-2 block">
                Minimum Duration (seconds): {minDuration.toFixed(1)}
              </div>
              <Slider
                value={[minDuration]}
                onValueChange={(values) => setMinDuration(values[0])}
                min={0.5}
                max={5.0}
                step={0.5}
                className="w-full"
              />
              <p className="text-xs text-neutral-600 mt-1">
                Ignore silence shorter than this duration
              </p>
            </div>
            {onDetectSilence && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDetectSilence}
                className="w-full"
              >
                <Volume2 className="w-4 h-4 mr-2" />
                Re-detect with New Settings
              </Button>
            )}
          </div>
        </div>
      )}

      {/* T057-T059: Silence Segment List */}
      <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
        {silenceSegments.map((segment, index) => {
          const isActive =
            currentTime >= segment.startTime && currentTime <= segment.endTime;
          const leftPercent = getTimelinePosition(segment.startTime);
          const widthPercent =
            getTimelinePosition(segment.endTime) -
            getTimelinePosition(segment.startTime);

          return (
            <div
              key={segment.id}
              className={`
                group relative border rounded-md p-3 transition-all
                ${
                  segment.deleted
                    ? 'border-red-800/50 bg-red-900/10'
                    : isActive
                      ? 'border-orange-500 bg-orange-900/20'
                      : 'border-neutral-800 bg-neutral-900/30 hover:border-neutral-700'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {/* T059: Duration Badge */}
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                    #{index + 1}
                  </span>
                  <Clock className="w-3 h-3 text-neutral-500" />
                  <span className="text-xs font-mono text-neutral-400">
                    {segment.startTime.toFixed(1)}s -{' '}
                    {segment.endTime.toFixed(1)}s
                  </span>
                  {/* T059: Duration Badge */}
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-orange-900/30 text-orange-400">
                    {segment.duration.toFixed(1)}s
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* T062: Preview Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreviewSegment(segment)}
                    className="h-7 px-2"
                  >
                    <Play className="w-3 h-3" />
                  </Button>

                  {/* T062: Keep/Remove Toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleToggleSilence(segment.id, !segment.deleted)
                    }
                    className={`h-7 px-2 ${
                      segment.deleted
                        ? 'text-green-500 hover:text-green-400'
                        : 'text-red-500 hover:text-red-400'
                    }`}
                  >
                    {segment.deleted ? (
                      <RotateCcw className="w-3 h-3" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* T058: Timeline Visualization */}
              <div className="relative h-1 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`absolute h-full rounded-full ${
                    segment.deleted
                      ? 'bg-red-500/50'
                      : isActive
                        ? 'bg-orange-500'
                        : 'bg-orange-500/70'
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                  }}
                />
                {isActive && (
                  <div
                    className="absolute h-full w-0.5 bg-blue-500"
                    style={{
                      left: `${getTimelinePosition(currentTime)}%`,
                    }}
                  />
                )}
              </div>

              {segment.deleted && (
                <p className="text-xs text-red-400 mt-2 font-mono">
                  ✓ Marked for removal
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
