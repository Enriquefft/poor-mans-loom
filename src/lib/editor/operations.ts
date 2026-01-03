import type { FFmpeg } from '@ffmpeg/ffmpeg';
import type { EditorState, ExportOptions, ExportProgress } from '../types';
import {
  deleteFileFromFFmpeg,
  getFFmpeg,
  readFileFromFFmpeg,
  writeFileToFFmpeg,
} from './ffmpeg';
import { getActiveSegments } from './timeline';

// ============================================================================
// T054-T056: Silence Removal Support
// ============================================================================

/**
 * Get export segments with silence removed
 * Merges timeline segments and silence segments to create final export list
 */
function getExportSegments(
  editorState: EditorState,
): Array<{ startTime: number; endTime: number }> {
  const activeSegments = getActiveSegments(editorState);

  // If no silence segments, return active timeline segments as-is
  if (
    !editorState.silenceSegments ||
    editorState.silenceSegments.length === 0
  ) {
    return activeSegments.map((seg) => ({
      endTime: seg.endTime,
      startTime: seg.startTime,
    }));
  }

  // Get silence segments that are marked for deletion
  const deletedSilence = editorState.silenceSegments.filter(
    (seg) => seg.deleted,
  );

  if (deletedSilence.length === 0) {
    return activeSegments.map((seg) => ({
      endTime: seg.endTime,
      startTime: seg.startTime,
    }));
  }

  // Split each active segment by removing silence periods
  const finalSegments: Array<{ startTime: number; endTime: number }> = [];

  for (const segment of activeSegments) {
    let currentStart = segment.startTime;
    const segmentEnd = segment.endTime;

    // Sort silence segments that overlap with this timeline segment
    const overlappingSilence = deletedSilence
      .filter((silence) => {
        // Check if silence overlaps with current segment
        return !(
          silence.endTime <= currentStart || silence.startTime >= segmentEnd
        );
      })
      .sort((a, b) => a.startTime - b.startTime);

    if (overlappingSilence.length === 0) {
      // No silence in this segment, keep it whole
      finalSegments.push({ endTime: segmentEnd, startTime: currentStart });
      continue;
    }

    // Process each silence segment
    for (const silence of overlappingSilence) {
      // Add segment before silence (if exists)
      if (currentStart < Math.max(silence.startTime, segment.startTime)) {
        finalSegments.push({
          endTime: Math.min(silence.startTime, segmentEnd),
          startTime: currentStart,
        });
      }

      // Move current start to after silence
      currentStart = Math.max(silence.endTime, currentStart);
    }

    // Add remaining segment after last silence (if exists)
    if (currentStart < segmentEnd) {
      finalSegments.push({
        endTime: segmentEnd,
        startTime: currentStart,
      });
    }
  }

  // Filter out any segments that are too short (< 0.1 seconds)
  return finalSegments.filter((seg) => seg.endTime - seg.startTime >= 0.1);
}

export async function exportVideo(
  videoBlob: Blob,
  editorState: EditorState,
  options: ExportOptions,
  onProgress: (progress: ExportProgress) => void,
): Promise<Blob> {
  const ffmpeg = await getFFmpeg(onProgress);

  onProgress({
    message: 'Preparing video...',
    progress: 10,
    stage: 'preparing',
  });

  await writeFileToFFmpeg(ffmpeg, 'input.webm', videoBlob);

  // T054: Use getExportSegments to handle both timeline edits and silence removal
  const exportSegments = getExportSegments(editorState);

  if (exportSegments.length === 0) {
    throw new Error('No segments to export');
  }

  onProgress({
    message: 'Processing segments...',
    progress: 20,
    stage: 'processing',
  });

  let outputFilename: string;

  // T055-T056: Process segments with silence removed
  if (exportSegments.length === 1) {
    outputFilename = await processSingleSegment(
      ffmpeg,
      exportSegments[0],
      options,
      onProgress,
    );
  } else {
    outputFilename = await processMultipleSegments(
      ffmpeg,
      exportSegments,
      options,
      onProgress,
    );
  }

  onProgress({
    message: 'Finalizing video...',
    progress: 90,
    stage: 'encoding',
  });

  const outputData = await readFileFromFFmpeg(ffmpeg, outputFilename);

  // Cleanup
  await deleteFileFromFFmpeg(ffmpeg, 'input.webm');
  await deleteFileFromFFmpeg(ffmpeg, outputFilename);

  const mimeType = options.format === 'mp4' ? 'video/mp4' : 'video/webm';
  const outputBlob = new Blob(
    [new Uint8Array(outputData).buffer as ArrayBuffer],
    { type: mimeType },
  );

  onProgress({
    message: 'Export complete!',
    progress: 100,
    stage: 'complete',
  });

  return outputBlob;
}

async function processSingleSegment(
  ffmpeg: FFmpeg,
  segment: { startTime: number; endTime: number },
  options: ExportOptions,
  onProgress: (progress: ExportProgress) => void,
): Promise<string> {
  const outputFilename =
    options.format === 'mp4' ? 'output.mp4' : 'output.webm';

  const args = ['-i', 'input.webm'];

  args.push('-ss', segment.startTime.toFixed(3));
  args.push('-to', segment.endTime.toFixed(3));

  if (options.format === 'mp4') {
    args.push('-c:v', 'libx264');
    args.push('-preset', getPresetForQuality(options.quality));
    args.push('-crf', getCRFForQuality(options.quality));
    args.push('-c:a', 'aac');
    args.push('-b:a', '128k');
    args.push('-movflags', '+faststart');
  } else {
    args.push('-c:v', 'libvpx-vp9');
    args.push('-crf', getCRFForQuality(options.quality));
    args.push('-b:v', '0');
    args.push('-c:a', 'libopus');
  }

  args.push('-y', outputFilename);

  onProgress({
    message: 'Encoding video...',
    progress: 50,
    stage: 'encoding',
  });

  await ffmpeg.exec(args);

  return outputFilename;
}

async function processMultipleSegments(
  ffmpeg: FFmpeg,
  segments: Array<{ startTime: number; endTime: number }>,
  options: ExportOptions,
  onProgress: (progress: ExportProgress) => void,
): Promise<string> {
  // Extract each segment
  const segmentFiles: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentFile = `segment_${i}.webm`;

    onProgress({
      message: `Processing segment ${i + 1} of ${segments.length}...`,
      progress: 20 + (i / segments.length) * 40,
      stage: 'processing',
    });

    await ffmpeg.exec([
      '-i',
      'input.webm',
      '-ss',
      segment.startTime.toFixed(3),
      '-to',
      segment.endTime.toFixed(3),
      '-c',
      'copy',
      '-y',
      segmentFile,
    ]);

    segmentFiles.push(segmentFile);
  }

  // Create concat file
  const concatContent = segmentFiles.map((f) => `file '${f}'`).join('\n');
  const encoder = new TextEncoder();
  await ffmpeg.writeFile('concat.txt', encoder.encode(concatContent));

  onProgress({
    message: 'Merging segments...',
    progress: 70,
    stage: 'encoding',
  });

  const outputFilename =
    options.format === 'mp4' ? 'output.mp4' : 'output.webm';

  const args = ['-f', 'concat', '-safe', '0', '-i', 'concat.txt'];

  if (options.format === 'mp4') {
    args.push('-c:v', 'libx264');
    args.push('-preset', getPresetForQuality(options.quality));
    args.push('-crf', getCRFForQuality(options.quality));
    args.push('-c:a', 'aac');
    args.push('-b:a', '128k');
    args.push('-movflags', '+faststart');
  } else {
    args.push('-c:v', 'libvpx-vp9');
    args.push('-crf', getCRFForQuality(options.quality));
    args.push('-b:v', '0');
    args.push('-c:a', 'libopus');
  }

  args.push('-y', outputFilename);

  await ffmpeg.exec(args);

  // Cleanup segment files
  for (const file of segmentFiles) {
    await deleteFileFromFFmpeg(ffmpeg, file);
  }
  await deleteFileFromFFmpeg(ffmpeg, 'concat.txt');

  return outputFilename;
}

function getPresetForQuality(quality: ExportOptions['quality']): string {
  switch (quality) {
    case 'low':
      return 'veryfast';
    case 'medium':
      return 'fast';
    case 'high':
      return 'medium';
    default:
      return 'fast';
  }
}

function getCRFForQuality(quality: ExportOptions['quality']): string {
  switch (quality) {
    case 'low':
      return '28';
    case 'medium':
      return '23';
    case 'high':
      return '18';
    default:
      return '23';
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function getExportFilename(format: ExportOptions['format']): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `poor-mans-loom-${timestamp}.${format}`;
}
