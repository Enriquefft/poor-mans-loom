import { Heart, Scissors, Video } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { VideoEditor } from '@/components/editor/video-editor';
import { GithubBadge } from '@/components/github-badge';
import { Logo } from '@/components/logo';
import { ScreenRecorder } from '@/components/recorder/screen-recorder';
import { StorageUsageIndicator } from '@/components/storage-usage-indicator';
import { detectHardwareCapabilities, getCapabilitySummary } from '@/lib/ai/hardware-check';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { captionService } from '@/lib/ai/captions';
import { silenceDetectionService } from '@/lib/ai/silence-detection';
import { transcriptionService } from '@/lib/ai/transcription';
import type { Caption, SilenceSegment, Transcript } from '@/lib/ai/types';
import { isTranscriptionSuccess } from '@/lib/ai/types';
import { storageService } from '@/lib/storage/persistence';

type AppState = 'recording' | 'editing';

interface RecordingData {
  blob: Blob;
  duration: number;
  recordingId: string;
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('recording');
  const [recordingData, setRecordingData] = useState<RecordingData | null>(
    null,
  );
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [silenceSegments, setSilenceSegments] = useState<SilenceSegment[]>([]);
  const [isDetectingSilence, setIsDetectingSilence] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);

  /**
   * T137: Check hardware capabilities on mount and warn if insufficient
   */
  useEffect(() => {
    const capabilities = detectHardwareCapabilities();

    if (!capabilities.meetsMinimumRequirements) {
      const summary = getCapabilitySummary(capabilities);

      if (capabilities.hasSharedArrayBuffer) {
        // Performance warnings (non-critical)
        toast.warning('Hardware limitations detected', {
          description: summary,
          duration: 8000,
        });
      } else {
        // Critical - AI features won't work
        toast.error('AI features unavailable', {
          description: summary,
          duration: 10000,
        });
      }

      // Log detailed warnings
      if (capabilities.warnings.length > 0) {
        console.warn('Hardware capability warnings:', capabilities.warnings);
      }
    }
  }, []);

  /**
   * T132: Helper to handle storage errors with user notification
   */
  const handleStorageError = useCallback(
    (
      result: { success: boolean; type?: string; message?: string },
      operationName: string,
    ) => {
      if (result.success) return true;

      if (result.type === 'QUOTA_EXCEEDED') {
        toast.error('Storage quota exceeded', {
          description:
            'Your browser storage is full. Click the storage indicator in the header to free up space by deleting old recordings and AI data.',
          duration: 8000,
        });
      } else {
        toast.error(`Failed to save ${operationName}`, {
          description: result.message || 'Unknown storage error',
          duration: 5000,
        });
      }

      return false;
    },
    [],
  );

  /**
   * T037-T039: Auto-trigger transcription on recording completion
   */
  const handleRecordingComplete = useCallback(
    async (blob: Blob, duration: number) => {
      const recordingId = `rec_${Date.now()}`;
      setRecordingData({ blob, duration, recordingId });
      setAppState('editing');

      // Start transcription automatically
      try {
        setIsTranscribing(true);

        // Show loading toast
        const toastId = toast.loading('Initializing transcription...');

        // Initialize transcription service
        const initResult = await transcriptionService.initialize();
        if (!initResult.success) {
          toast.error('Failed to load transcription model', { id: toastId });
          setIsTranscribing(false);
          return;
        }

        toast.loading('Transcribing audio...', { id: toastId });

        // Extract audio from recording (simplified - using the blob directly)
        // In production, you'd extract audio track from the video blob
        const transcriptionResult = await transcriptionService.transcribe(
          blob,
          undefined,
          (progress, status) => {
            toast.loading(`${status} (${Math.round(progress * 100)}%)`, {
              id: toastId,
            });
          },
        );

        if (isTranscriptionSuccess(transcriptionResult)) {
          // Update transcript with correct recording ID
          const finalTranscript = {
            ...transcriptionResult.transcript,
            recordingId,
          };

          // T132: Save to storage with error handling
          const transcriptSaveResult =
            await storageService.saveTranscript(finalTranscript);
          if (!handleStorageError(transcriptSaveResult, 'transcript')) {
            toast.error('Transcription succeeded but could not be saved', {
              id: toastId,
            });
            return;
          }
          setTranscript(finalTranscript);

          // T125: Auto-generate captions from transcript
          const captionResult = captionService.generate(finalTranscript);
          if (captionResult.success) {
            // T132: Save captions to storage with error handling
            const captionsSaveResult = await storageService.saveCaptions(
              recordingId,
              captionResult.captions,
            );
            if (handleStorageError(captionsSaveResult, 'captions')) {
              setCaptions(captionResult.captions);
            }

            toast.success(
              `Transcription complete (${finalTranscript.segments.length} segments, ${captionResult.captions.length} captions)`,
              { id: toastId },
            );
          } else {
            toast.success(
              `Transcription complete (${finalTranscript.segments.length} segments)`,
              { id: toastId },
            );
          }
        } else {
          // T039: Handle NO_SPEECH and other errors
          if (transcriptionResult.type === 'NO_SPEECH') {
            toast.info('No speech detected in recording', {
              description:
                'The transcription service did not detect any speech in the audio.',
              id: toastId,
            });
          } else {
            toast.error(
              `Transcription failed: ${transcriptionResult.message}`,
              { id: toastId },
            );
          }
        }
      } catch (error) {
        toast.error('Unexpected error during transcription');
        console.error('Transcription error:', error);
      } finally {
        setIsTranscribing(false);
      }

      // T067: Auto-trigger silence detection after transcription
      try {
        setIsDetectingSilence(true);
        const silenceToastId = toast.loading('Detecting silence...');

        const silenceResult = await silenceDetectionService.analyzeRecording(
          blob,
          recordingId,
        );

        if (silenceResult.success) {
          // T132: Save to storage with error handling
          const silenceSaveResult = await storageService.saveSilenceSegments(
            recordingId,
            silenceResult.segments,
          );
          if (handleStorageError(silenceSaveResult, 'silence segments')) {
            setSilenceSegments(silenceResult.segments);
          }

          if (silenceResult.segments.length > 0) {
            toast.success(
              `Found ${silenceResult.segments.length} silence segments (${silenceResult.totalSilenceDuration.toFixed(1)}s total)`,
              { id: silenceToastId },
            );
          } else {
            toast.info('No significant silence detected', {
              id: silenceToastId,
            });
          }
        } else {
          toast.error(`Silence detection failed: ${silenceResult.message}`, {
            id: silenceToastId,
          });
        }
      } catch (error) {
        toast.error('Unexpected error during silence detection');
        console.error('Silence detection error:', error);
      } finally {
        setIsDetectingSilence(false);
      }
    },
    [],
  );

  const handleBackToRecording = useCallback(() => {
    if (recordingData?.blob) {
      URL.revokeObjectURL(URL.createObjectURL(recordingData.blob));
    }
    setRecordingData(null);
    setTranscript(null);
    setSilenceSegments([]);
    setCaptions([]);
    setAppState('recording');
  }, [recordingData]);

  /**
   * T126: Handle transcript updates from editor and auto-update captions
   */
  const handleTranscriptUpdate = useCallback(
    async (updated: Transcript) => {
      setTranscript(updated);

      // T132: Save transcript update with error handling
      const updateResult = await storageService.updateTranscript(updated);
      if (!handleStorageError(updateResult, 'transcript update')) {
        return;
      }

      // T126: Auto-update captions when transcript changes
      if (captions.length > 0) {
        const captionUpdateResult = captionService.updateFromTranscript(
          updated,
          captions,
        );
        if (captionUpdateResult.success && recordingData) {
          // T132: Save captions with error handling
          const captionsSaveResult = await storageService.saveCaptions(
            recordingData.recordingId,
            captionUpdateResult.captions,
          );
          if (handleStorageError(captionsSaveResult, 'captions')) {
            setCaptions(captionUpdateResult.captions);
          }
        }
      }
    },
    [captions, recordingData, handleStorageError],
  );

  return (
    <div
      className="min-h-screen flex flex-col relative bg-[#0a0a0a] text-neutral-100 antialiased"
      style={{
        fontFamily:
          'var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif)',
      }}
    >
      <div className="noise-overlay" aria-hidden="true" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-neutral-800/50 bg-[#0a0a0a]/80 backdrop-blur-sm noise-texture noise-texture-subtle">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="text-neutral-400" />
            <span className="text-xs font-mono tracking-wide text-neutral-400">
              Poor Man's Loom
            </span>
          </div>

          <div className="flex items-center gap-3">
            <StorageUsageIndicator />
            <GithubBadge />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-4xl mx-auto">
          <Card className="w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-mono text-sm tracking-wide uppercase flex items-center gap-2">
                    {appState === 'recording' ? (
                      <>
                        <Video className="w-4 h-4" />
                        Record
                      </>
                    ) : (
                      <>
                        <Scissors className="w-4 h-4" />
                        Edit
                      </>
                    )}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">
                    {appState === 'recording'
                      ? 'Capture screen, camera, and audio — all locally'
                      : 'Trim, split, and export your recording'}
                  </CardDescription>
                </div>

                {/* State indicator */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${appState === 'recording' ? 'bg-blue-500' : 'bg-neutral-600'}`}
                  />
                  <div
                    className={`w-2 h-2 rounded-full ${appState === 'editing' ? 'bg-blue-500' : 'bg-neutral-600'}`}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {appState === 'recording' ? (
                <ScreenRecorder onRecordingComplete={handleRecordingComplete} />
              ) : recordingData ? (
                <VideoEditor
                  videoBlob={recordingData.blob}
                  videoDuration={recordingData.duration}
                  onBack={handleBackToRecording}
                  transcript={transcript}
                  onTranscriptUpdate={handleTranscriptUpdate}
                  isTranscribing={isTranscribing}
                  silenceSegments={silenceSegments}
                  onSilenceSegmentsChange={setSilenceSegments}
                  isDetectingSilence={isDetectingSilence}
                  captions={captions}
                  onCaptionsChange={setCaptions}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-800/50 noise-texture noise-texture-subtle">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-[10px] font-mono text-neutral-600">
            Record · Edit · Export — All in your browser
          </span>
          <span className="text-[10px] font-mono text-neutral-600 flex items-center gap-1">
            made with{' '}
            <Heart className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" />{' '}
            by{' '}
            <a
              href="https://cris.fast"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              cris
            </a>
          </span>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}
