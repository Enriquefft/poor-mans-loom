'use client';

import { Download, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { VideoPlayer } from '@/components/player/video-player';
import { Button } from '@/components/ui/button';
import type { Caption, SilenceSegment, Transcript } from '@/lib/ai/types';
import {
  downloadBlob,
  downloadCaptionFile,
  exportVideo,
  getExportFilename,
} from '@/lib/editor/operations';
import {
  createInitialEditorState,
  deleteSegment,
  getActiveSegments,
  getNextSilenceSegment,
  getPreviousSilenceSegment,
  getTotalActiveDuration,
  restoreSegment,
  splitSegment,
  trimEnd,
  trimStart,
} from '@/lib/editor/timeline';
import type { EditorState, ExportOptions, ExportProgress } from '@/lib/types';
import { CaptionEditor } from './caption-editor';
import { ExportDialog } from './export-dialog';
import { SilenceMarkers } from './silence-markers';
import { Timeline } from './timeline';
import { TranscriptViewer } from './transcript-viewer';

interface VideoEditorProps {
  videoBlob: Blob;
  videoDuration: number;
  onBack: () => void;
  transcript?: Transcript | null;
  onTranscriptUpdate?: (transcript: Transcript) => void;
  isTranscribing?: boolean;
  silenceSegments?: SilenceSegment[];
  onSilenceSegmentsChange?: (segments: SilenceSegment[]) => void;
  isDetectingSilence?: boolean;
  captions?: Caption[];
  onCaptionsChange?: (captions: Caption[]) => void;
}

export function VideoEditor({
  videoBlob,
  videoDuration,
  onBack,
  transcript,
  onTranscriptUpdate,
  isTranscribing,
  silenceSegments = [],
  onSilenceSegmentsChange,
  isDetectingSilence = false,
  captions = [],
  onCaptionsChange,
}: VideoEditorProps) {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [editorState, setEditorState] = useState<EditorState>(() => ({
    ...createInitialEditorState(videoDuration),
    silenceSegments,
  }));
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(
    null,
  );
  const [showCaptionPreview, setShowCaptionPreview] = useState(false);

  // Calculate these early so they can be used in callbacks
  const activeDuration = getTotalActiveDuration(editorState);
  const hasEdits =
    activeDuration !== videoDuration ||
    editorState.segments.some((s) => s.deleted);

  useEffect(() => {
    const url = URL.createObjectURL(videoBlob);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoBlob]);

  const handleTrimStart = useCallback((time: number) => {
    setEditorState((prev) => trimStart(prev, time));
  }, []);

  const handleTrimEnd = useCallback((time: number) => {
    setEditorState((prev) => trimEnd(prev, time));
  }, []);

  const handleSplit = useCallback((segmentId: string, time: number) => {
    setEditorState((prev) => splitSegment(prev, segmentId, time));
    toast.success('Segment split');
  }, []);

  const handleDeleteSegment = useCallback(
    (segmentId: string) => {
      const activeSegments = getActiveSegments(editorState);
      if (activeSegments.length <= 1) {
        toast.error('Cannot delete the last segment');
        return;
      }
      setEditorState((prev) => deleteSegment(prev, segmentId));
      toast.success('Segment deleted');
    },
    [editorState],
  );

  const handleRestoreSegment = useCallback((segmentId: string) => {
    setEditorState((prev) => restoreSegment(prev, segmentId));
    toast.success('Segment restored');
  }, []);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handlePlayPause = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const handleReset = useCallback(() => {
    setEditorState(createInitialEditorState(videoDuration));
    setCurrentTime(0);
    setIsPlaying(false);
    toast.info('Timeline reset');
  }, [videoDuration]);

  const handleExport = useCallback(
    async (options: ExportOptions) => {
      setIsExporting(true);
      setExportProgress(null);

      // If no edits and WebM format, just download the original
      if (!hasEdits && options.format === 'webm') {
        const filename = getExportFilename('webm');
        downloadBlob(videoBlob, filename);
        setExportProgress({
          message: 'Download complete!',
          progress: 100,
          stage: 'complete',
        });
        toast.success(`Downloaded ${filename}`);
        setIsExporting(false);
        return;
      }

      try {
        // T120: Pass captions to export if burn-in enabled
        const captionsForExport =
          options.captions?.enabled && options.captions.burnIn
            ? captions
            : undefined;

        const outputBlob = await exportVideo(
          videoBlob,
          editorState,
          options,
          setExportProgress,
          captionsForExport,
        );

        const filename = getExportFilename(options.format);
        downloadBlob(outputBlob, filename);

        // T121: Export separate caption file if requested
        if (options.captions?.enabled && !options.captions.burnIn && captions.length > 0) {
          downloadCaptionFile(captions, 'srt');
          toast.success(`Video and captions exported`);
        } else {
          toast.success(`Video exported as ${filename}`);
        }
      } catch (error) {
        console.error('Export failed:', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Export failed. Please try again.';
        setExportProgress({
          message: errorMessage,
          progress: 0,
          stage: 'error',
        });
        toast.error('Export failed');
      } finally {
        setIsExporting(false);
      }
    },
    [videoBlob, editorState, hasEdits],
  );

  const handleQuickDownload = useCallback(() => {
    const filename = getExportFilename('webm');
    downloadBlob(videoBlob, filename);
    toast.success(`Downloaded ${filename}`);
  }, [videoBlob]);

  const handleEditorStateChange = useCallback((newState: EditorState) => {
    setEditorState(newState);
  }, []);

  // T068: Sync silenceSegments prop updates to editor state
  useEffect(() => {
    if (silenceSegments) {
      setEditorState((prev) => ({
        ...prev,
        silenceSegments,
      }));
    }
  }, [silenceSegments]);

  // T069: Keyboard shortcuts for silence navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+N: Next silence segment
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        const nextSilence = getNextSilenceSegment(editorState, currentTime);
        if (nextSilence) {
          setCurrentTime(nextSilence.startTime);
          toast.info(`Next silence at ${nextSilence.startTime.toFixed(1)}s`);
        } else {
          toast.info('No more silence segments ahead');
        }
      }
      // Alt+P: Previous silence segment
      if (e.altKey && e.key === 'p') {
        e.preventDefault();
        const prevSilence = getPreviousSilenceSegment(editorState, currentTime);
        if (prevSilence) {
          setCurrentTime(prevSilence.startTime);
          toast.info(
            `Previous silence at ${prevSilence.startTime.toFixed(1)}s`,
          );
        } else {
          toast.info('No more silence segments behind');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorState, currentTime]);

  return (
    <div className="w-full space-y-4">
      {/* Video player */}
      <div className="w-full rounded-lg overflow-hidden border border-neutral-800 noise-texture noise-texture-subtle">
        <VideoPlayer
          src={videoUrl}
          currentTime={currentTime}
          onTimeUpdate={handleTimeUpdate}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
        />
      </div>

      {/* Timeline */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 noise-texture noise-texture-subtle">
        <Timeline
          editorState={editorState}
          onTrimStart={handleTrimStart}
          onTrimEnd={handleTrimEnd}
          onSplit={handleSplit}
          onDeleteSegment={handleDeleteSegment}
          onRestoreSegment={handleRestoreSegment}
          onSeek={handleSeek}
          currentTime={currentTime}
        />
      </div>

      {/* T068: Silence Markers */}
      {(silenceSegments && silenceSegments.length > 0) || isDetectingSilence ? (
        <SilenceMarkers
          editorState={editorState}
          onEditorStateChange={handleEditorStateChange}
          onSeekTo={handleSeek}
          currentTime={currentTime}
          isDetecting={isDetectingSilence}
        />
      ) : null}

      {/* Transcript Viewer */}
      {transcript && onTranscriptUpdate && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg noise-texture noise-texture-subtle">
          <TranscriptViewer
            transcript={transcript}
            onTranscriptUpdate={onTranscriptUpdate}
            onSeekTo={handleSeek}
            currentTime={currentTime}
          />
        </div>
      )}

      {/* Transcription in progress indicator */}
      {isTranscribing && !transcript && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 noise-texture noise-texture-subtle">
          <div className="flex items-center justify-center gap-3 text-sm text-neutral-400">
            <div className="w-4 h-4 border-2 border-neutral-600 border-t-blue-500 rounded-full animate-spin" />
            <span className="font-mono">Transcribing audio...</span>
          </div>
        </div>
      )}

      {/* T120-T121: Caption Editor */}
      {captions.length > 0 && onCaptionsChange && (
        <CaptionEditor
          captions={captions}
          onCaptionsChange={onCaptionsChange}
          showPreview={showCaptionPreview}
          onShowPreviewChange={setShowCaptionPreview}
        />
      )}

      {/* Editor info */}
      <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
        <span>
          Original: {videoDuration.toFixed(1)}s → Edited:{' '}
          {activeDuration.toFixed(1)}s
        </span>
        {hasEdits && <span className="text-yellow-500">Unsaved changes</span>}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            ← Back
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={!hasEdits}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {!hasEdits && (
            <Button variant="outline" onClick={handleQuickDownload}>
              <Download className="w-4 h-4 mr-2" />
              Quick Download
            </Button>
          )}
          <Button onClick={() => setShowExportDialog(true)}>
            <Download className="w-4 h-4 mr-2" />
            Export{hasEdits ? ' Edited' : ''}
          </Button>
        </div>
      </div>

      {/* Export dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        onExport={handleExport}
        progress={exportProgress}
        isExporting={isExporting}
        hasCaptions={captions.length > 0}
      />
    </div>
  );
}
