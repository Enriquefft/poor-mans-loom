import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { captionService } from '../ai/captions';
import type { Caption } from '../ai/types';
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

// ============================================================================
// T110-T113: Caption Support
// ============================================================================

/**
 * T112: Generate FFmpeg force_style parameters for caption customization
 * Applies custom fonts, colors, positioning from CaptionStyle
 */
function getCaptionForceStyle(caption: Caption): string {
  const style = caption.style;
  const styles: string[] = [];

  // Font styling
  styles.push(`FontName=${style.fontFamily}`);
  styles.push(`FontSize=${style.fontSize}`);

  // Colors (convert hex to &H00BBGGRR format for ASS)
  const textColor = hexToASSColor(style.fontColor);
  const bgColor = hexToASSColor(style.backgroundColor);
  styles.push(`PrimaryColour=${textColor}`);
  styles.push(`BackColour=${bgColor}`);

  // Font weight and style
  if (style.bold) styles.push('Bold=1');
  if (style.italic) styles.push('Italic=1');

  // Outline
  if (style.outline && style.outlineColor) {
    const outlineColor = hexToASSColor(style.outlineColor);
    styles.push(`OutlineColour=${outlineColor}`);
    styles.push('Outline=2');
  }

  // Alignment (1-9 grid: 1=bottom-left, 2=bottom-center, 5=center, etc.)
  let alignment = 2; // default bottom-center
  if (caption.position.vertical === 'bottom') {
    alignment =
      caption.position.horizontal === 'left'
        ? 1
        : caption.position.horizontal === 'right'
          ? 3
          : 2;
  } else if (caption.position.vertical === 'middle') {
    alignment =
      caption.position.horizontal === 'left'
        ? 4
        : caption.position.horizontal === 'right'
          ? 6
          : 5;
  } else {
    // top
    alignment =
      caption.position.horizontal === 'left'
        ? 7
        : caption.position.horizontal === 'right'
          ? 9
          : 8;
  }
  styles.push(`Alignment=${alignment}`);

  return styles.join(',');
}

/**
 * Convert hex color (#RRGGBB or #RRGGBBAA) to ASS color format (&H00BBGGRR)
 */
function hexToASSColor(hex: string): string {
  // Remove # and parse
  const clean = hex.replace('#', '');

  let r: string,
    g: string,
    b: string,
    a = 'FF';

  if (clean.length === 8) {
    // RRGGBBAA format
    r = clean.substring(0, 2);
    g = clean.substring(2, 4);
    b = clean.substring(4, 6);
    a = clean.substring(6, 8);
  } else {
    // RRGGBB format
    r = clean.substring(0, 2);
    g = clean.substring(2, 4);
    b = clean.substring(4, 6);
  }

  // ASS format is &HAABBGGRR (note: alpha is inverted)
  const alpha = (255 - Number.parseInt(a, 16)).toString(16).padStart(2, '0');
  return `&H${alpha.toUpperCase()}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}`;
}

/**
 * T111: Prepare caption file for FFmpeg
 * Write SRT file to FFmpeg virtual filesystem
 */
async function prepareCaptionFile(
  ffmpeg: FFmpeg,
  captions: Caption[],
): Promise<string> {
  const srtContent = captionService.toSRT(captions);
  const encoder = new TextEncoder();
  const srtData = encoder.encode(srtContent);

  await writeFileToFFmpeg(ffmpeg, 'captions.srt', new Blob([srtData]));

  return 'captions.srt';
}

export async function exportVideo(
  videoBlob: Blob,
  editorState: EditorState,
  options: ExportOptions,
  onProgress: (progress: ExportProgress) => void,
  captions?: Caption[], // T110: Optional captions for burning
): Promise<Blob> {
  const ffmpeg = await getFFmpeg(onProgress);

  onProgress({
    message: 'Preparing video...',
    progress: 10,
    stage: 'preparing',
  });

  await writeFileToFFmpeg(ffmpeg, 'input.webm', videoBlob);

  // T111: Prepare caption file if captions enabled
  let captionFilename: string | null = null;
  if (
    options.captions?.enabled &&
    options.captions.burnIn &&
    captions &&
    captions.length > 0
  ) {
    captionFilename = await prepareCaptionFile(ffmpeg, captions);
  }

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
      captionFilename,
      captions?.[0], // Use first caption for style reference
    );
  } else {
    outputFilename = await processMultipleSegments(
      ffmpeg,
      exportSegments,
      options,
      onProgress,
      captionFilename,
      captions?.[0],
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
  if (captionFilename) {
    await deleteFileFromFFmpeg(ffmpeg, captionFilename);
  }

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
  captionFilename: string | null = null,
  captionStyleRef?: Caption,
): Promise<string> {
  const outputFilename =
    options.format === 'mp4' ? 'output.mp4' : 'output.webm';

  const args = ['-i', 'input.webm'];

  args.push('-ss', segment.startTime.toFixed(3));
  args.push('-to', segment.endTime.toFixed(3));

  // T110: Apply subtitles filter if captions enabled
  let videoFilter = '';
  if (captionFilename && captionStyleRef) {
    const forceStyle = getCaptionForceStyle(captionStyleRef);
    videoFilter = `subtitles=${captionFilename}:force_style='${forceStyle}'`;
  }

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

  // T110: Add video filter if captions present
  if (videoFilter) {
    args.push('-vf', videoFilter);
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
  captionFilename: string | null = null,
  captionStyleRef?: Caption,
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

  // T110: Apply subtitles filter if captions enabled
  let videoFilter = '';
  if (captionFilename && captionStyleRef) {
    const forceStyle = getCaptionForceStyle(captionStyleRef);
    videoFilter = `subtitles=${captionFilename}:force_style='${forceStyle}'`;
  }

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

  // T110: Add video filter if captions present
  if (videoFilter) {
    args.push('-vf', videoFilter);
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

/**
 * T113: Export captions as separate subtitle file
 * Downloads captions as SRT or VTT format without burning into video
 */
export function downloadCaptionFile(
  captions: Caption[],
  format: 'srt' | 'vtt' | 'txt',
): void {
  let content: string;
  let extension: string;

  switch (format) {
    case 'srt':
      content = captionService.toSRT(captions);
      extension = 'srt';
      break;
    case 'vtt':
      content = captionService.toVTT(captions);
      extension = 'vtt';
      break;
    case 'txt':
      content = captionService.toTXT(captions);
      extension = 'txt';
      break;
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `poor-mans-loom-${timestamp}.${extension}`;

  downloadBlob(blob, filename);
}
