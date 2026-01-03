# Data Model: AI-Powered Recording Enhancements

**Feature**: 001-ai-transformer-features
**Date**: 2026-01-02
**Status**: Phase 1 Design

## Overview

This document defines the data structures for AI-generated content (transcripts, silence markers, captions) and their relationships to existing recording entities. All models follow immutable state principles and type-safe error handling patterns from the project constitution.

---

## Core Entities

### 1. Transcript

Represents the complete speech-to-text output for a recording, including word-level timestamps and confidence scores.

```typescript
interface Transcript {
  id: string;                    // Unique identifier (UUIDv4)
  recordingId: string;           // Foreign key to recording
  language: string;              // ISO 639-1 code (e.g., 'en', 'es')
  createdAt: number;             // Unix timestamp (milliseconds)
  updatedAt: number;             // Unix timestamp (last edit)
  segments: TranscriptSegment[]; // Ordered array of speech segments
  metadata: TranscriptMetadata;  // Processing metadata
}

interface TranscriptSegment {
  id: string;                    // Unique segment identifier
  text: string;                  // Transcribed text content
  startTime: number;             // Start timestamp (seconds)
  endTime: number;               // End timestamp (seconds)
  confidence: number;            // 0.0-1.0 (model confidence score)
  speaker?: string;              // Optional speaker label ('Speaker 1', 'Speaker 2')
  words: TranscriptWord[];       // Word-level breakdown
  flagged: boolean;              // True if confidence < 0.70 (FR-024)
  edited: boolean;               // True if manually corrected by user
}

interface TranscriptWord {
  text: string;                  // Individual word
  startTime: number;             // Word start (seconds)
  endTime: number;               // Word end (seconds)
  confidence: number;            // Word-level confidence
}

interface TranscriptMetadata {
  modelVersion: string;          // e.g., 'Xenova/whisper-tiny.en'
  processingDuration: number;    // Time taken to generate (seconds)
  totalDuration: number;         // Audio duration (seconds)
  wordCount: number;             // Total words in transcript
  averageConfidence: number;     // Mean confidence across all segments
  lowConfidenceSegments: number; // Count of flagged segments
}
```

**Validation Rules**:
- `confidence` must be between 0.0 and 1.0
- `startTime < endTime` for all segments and words
- Segments must not overlap
- Segments must be ordered by `startTime`
- `speaker` labels must be consistent across transcript

**State Transitions**:
1. **Created** → Generated from audio after recording completion (auto-triggered)
2. **Flagged** → Segments with `confidence < 0.70` marked for review
3. **Edited** → User manually corrects segment text
4. **Exported** → Converted to SRT/VTT/TXT format

**Relationships**:
- One-to-one with Recording (optional: only if audio present)
- One-to-many with Caption (captions generated from transcript)

---

### 2. SilenceSegment

Represents detected periods of silence in a recording, marked for potential removal.

```typescript
interface SilenceSegment {
  id: string;                    // Unique identifier (UUIDv4)
  recordingId: string;           // Foreign key to recording
  startTime: number;             // Silence start (seconds)
  endTime: number;               // Silence end (seconds)
  duration: number;              // Computed: endTime - startTime
  averageDecibels: number;       // Average audio level during segment (dB)
  deleted: boolean;              // User decision: remove this segment
  reviewed: boolean;             // User has seen and decided on segment
}
```

**Validation Rules**:
- `startTime < endTime`
- `duration === endTime - startTime` (enforced by getter)
- `averageDecibels < -40` (default threshold, user-configurable)
- `duration >= 2.0` seconds (minimum silence duration)
- Segments must not overlap

**State Transitions**:
1. **Detected** → Auto-detected during or after recording
2. **Reviewed** → User previews segment
3. **Kept** → User decides to preserve silence (`deleted: false`)
4. **Deleted** → Marked for removal (`deleted: true`)
5. **Removed** → Physically removed from timeline during export

**Relationships**:
- One-to-many with Recording (multiple silence segments per recording)
- Integrates with existing `TimelineSegment` model for removal operations

---

### 3. Caption

Represents timed text overlays synchronized with video playback, derived from transcript.

```typescript
interface Caption {
  id: string;                    // Unique identifier (UUIDv4)
  recordingId: string;           // Foreign key to recording
  transcriptId: string;          // Foreign key to transcript (source of truth)
  text: string;                  // Caption text content
  startTime: number;             // Display start (seconds)
  endTime: number;               // Display end (seconds)
  position: CaptionPosition;     // Screen position
  style: CaptionStyle;           // Visual appearance
}

interface CaptionPosition {
  horizontal: 'left' | 'center' | 'right'; // Horizontal alignment
  vertical: 'top' | 'middle' | 'bottom';   // Vertical alignment
  offsetX?: number;              // Optional pixel offset from alignment
  offsetY?: number;              // Optional pixel offset from alignment
}

interface CaptionStyle {
  fontFamily: string;            // Font name (e.g., 'Arial', 'Helvetica')
  fontSize: number;              // Font size in pixels
  fontColor: string;             // Hex color (e.g., '#FFFFFF')
  backgroundColor: string;       // Hex color with alpha (e.g., '#000000AA')
  bold: boolean;                 // Bold text
  italic: boolean;               // Italic text
  outline: boolean;              // Text outline/stroke
  outlineColor?: string;         // Outline color if enabled
}
```

**Defaults** (from spec assumption #10):
```typescript
const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: 'Arial',
  fontSize: 24,
  fontColor: '#FFFFFF',
  backgroundColor: '#000000AA', // Black with 67% opacity
  bold: false,
  italic: false,
  outline: true,
  outlineColor: '#000000'
};

const DEFAULT_CAPTION_POSITION: CaptionPosition = {
  horizontal: 'center',
  vertical: 'bottom'
};
```

**Validation Rules**:
- `startTime < endTime`
- Caption duration <= 3 seconds (SC-005: comfortable reading pace)
- `fontSize` between 12-72 pixels
- Colors must be valid hex format
- Text must not be empty

**State Transitions**:
1. **Generated** → Auto-created from transcript segments
2. **Customized** → User modifies style/position
3. **Exported** → Burned into video or saved as SRT/VTT

**Relationships**:
- Many-to-one with Transcript (multiple captions from one transcript)
- One-to-one with Recording (optional)

**Auto-Update Behavior** (FR-018):
- When `Transcript.segments[i].text` changes → regenerate corresponding `Caption.text`
- When `Transcript.segments[i].startTime/endTime` changes → update `Caption.startTime/endTime`
- Preserve `CaptionStyle` and `CaptionPosition` during updates

---

### 4. BackgroundEffect

Represents real-time background blur/removal settings applied during recording.

```typescript
interface BackgroundEffect {
  type: 'blur' | 'removal';      // Effect mode
  enabled: boolean;              // Toggle on/off during recording
  blurIntensity?: number;        // 0-100 (only for blur mode)
  replacementColor?: string;     // Hex color (only for removal mode)
  replacementImage?: string;     // Base64 image data (only for removal mode)
}
```

**Validation Rules**:
- If `type === 'blur'`, `blurIntensity` must be 0-100
- If `type === 'removal'`, either `replacementColor` OR `replacementImage` required
- Effect only applicable during active recording (not post-processing)

**State Transitions**:
1. **Configured** → User selects effect type and settings
2. **Active** → Applied in real-time during recording (30fps)
3. **Rendered** → Permanently baked into exported video

**Relationships**:
- One-to-one with Recording (optional: only if camera enabled)
- Integrated with existing `Compositor` (src/lib/recorder/compositor.ts)

---

### 5. AIProcessingJob

Represents long-running AI operations (transcription, silence detection) with progress tracking.

```typescript
interface AIProcessingJob {
  id: string;                    // Unique identifier (UUIDv4)
  recordingId: string;           // Foreign key to recording
  type: 'transcription' | 'silence_detection' | 'caption_generation';
  status: JobStatus;             // Current state
  progress: number;              // 0.0-1.0 (percentage complete)
  startedAt: number;             // Unix timestamp (start)
  completedAt?: number;          // Unix timestamp (completion)
  error?: AIProcessingError;     // Error details if failed
  result?: any;                  // Typed result (Transcript | SilenceSegment[] | Caption[])
}

type JobStatus =
  | 'queued'                     // Waiting to start
  | 'loading_model'              // Downloading AI model
  | 'processing'                 // Active inference
  | 'completed'                  // Successfully finished
  | 'failed'                     // Error occurred
  | 'cancelled';                 // User cancelled

interface AIProcessingError {
  type: 'MODEL_LOAD_FAILED' | 'INFERENCE_ERROR' | 'NO_SPEECH' | 'QUOTA_EXCEEDED';
  message: string;               // Human-readable error
  details?: any;                 // Additional context (stack trace, etc.)
}
```

**Validation Rules**:
- `progress` must be between 0.0 and 1.0
- `completedAt` must be >= `startedAt`
- `error` only present if `status === 'failed'`
- `result` only present if `status === 'completed'`

**State Transitions**:
```
queued → loading_model → processing → completed
                        ↓
                      failed
                        ↓
                    cancelled
```

**Relationships**:
- Many-to-one with Recording (multiple jobs per recording)
- Used by UI to show progress indicators (FR-021)

---

## Derived/Computed Properties

### Transcript Statistics

```typescript
interface TranscriptStats {
  wordCount: number;             // Total words
  characterCount: number;        // Total characters
  speakingDuration: number;      // Non-silence time (seconds)
  averageConfidence: number;     // Mean confidence
  lowConfidenceCount: number;    // Flagged segments count
  speakerCount: number;          // Distinct speakers detected
}

function computeTranscriptStats(transcript: Transcript): TranscriptStats {
  // Implementation derives from transcript.segments
}
```

### Silence Statistics

```typescript
interface SilenceStats {
  totalSilenceTime: number;      // Sum of all silence durations (seconds)
  silencePercentage: number;     // Silence / total duration
  longestSilence: number;        // Max silence duration (seconds)
  segmentCount: number;          // Total silence segments
  deletedCount: number;          // Marked for removal
  timeSaved: number;             // Total time to be removed (seconds)
}

function computeSilenceStats(segments: SilenceSegment[]): SilenceStats {
  // Implementation derives from silence segments array
}
```

---

## Storage Schema (localStorage)

### Storage Keys

```typescript
const STORAGE_KEYS = {
  RECORDINGS: 'pmr:recordings',           // Main recording metadata
  TRANSCRIPTS: 'pmr:transcripts',         // Transcripts by recording ID
  SILENCE: 'pmr:silence',                 // Silence segments by recording ID
  CAPTIONS: 'pmr:captions',               // Captions by recording ID
  BG_EFFECTS: 'pmr:background_effects',   // Background effect settings
  AI_JOBS: 'pmr:ai_jobs'                  // Active/completed AI jobs
} as const;
```

### Storage Format

```typescript
interface StoredRecording {
  id: string;
  blobUrl: string;               // Object URL for video Blob
  duration: number;
  createdAt: number;
  hasTranscript: boolean;        // Quick lookup flag
  hasSilenceMarkers: boolean;
  hasCaptions: boolean;
}

interface StorageIndex {
  version: number;               // Schema version (for migrations)
  recordings: Map<string, StoredRecording>;
  transcripts: Map<string, Transcript>;
  silenceSegments: Map<string, SilenceSegment[]>;
  captions: Map<string, Caption[]>;
  backgroundEffects: Map<string, BackgroundEffect>;
  aiJobs: Map<string, AIProcessingJob[]>;
}
```

### Size Estimates

| Entity | Typical Size | Max Size (estimate) |
|--------|-------------|---------------------|
| Transcript (10min) | ~50KB | ~500KB (60min, dense speech) |
| SilenceSegment[] | ~1KB | ~10KB (100 segments) |
| Caption[] | ~20KB | ~200KB (1000 captions) |
| BackgroundEffect | ~1KB | ~2KB |
| AIProcessingJob | ~2KB | ~5KB |
| **Total per recording** | **~75KB** | **~720KB** |

**10MB localStorage limit** → ~13 recordings with full AI data before cleanup needed

---

## Immutability Patterns

All AI-generated data follows immutable state operations (Constitution Principle IV).

### Transcript Updates (Edits)

```typescript
function updateTranscriptSegment(
  transcript: Transcript,
  segmentId: string,
  newText: string
): Transcript {
  return {
    ...transcript,
    updatedAt: Date.now(),
    segments: transcript.segments.map(seg =>
      seg.id === segmentId
        ? { ...seg, text: newText, edited: true }
        : seg
    )
  };
}
```

### Silence Segment Deletion

```typescript
function markSilenceForDeletion(
  segments: SilenceSegment[],
  segmentId: string
): SilenceSegment[] {
  return segments.map(seg =>
    seg.id === segmentId
      ? { ...seg, deleted: true, reviewed: true }
      : seg
  );
}
```

### Caption Style Updates

```typescript
function updateCaptionStyle(
  captions: Caption[],
  newStyle: Partial<CaptionStyle>
): Caption[] {
  return captions.map(caption => ({
    ...caption,
    style: { ...caption.style, ...newStyle }
  }));
}
```

---

## Relationships Diagram

```
Recording (existing)
    ├── 1:1 → Transcript (optional)
    │         └── 1:n → Caption[]
    ├── 1:n → SilenceSegment[]
    ├── 1:1 → BackgroundEffect (optional)
    └── 1:n → AIProcessingJob[]

TimelineSegment (existing)
    └── extended by → SilenceSegment (deleted flag)

EditorState (existing)
    └── extended with → TranscriptState, CaptionState
```

---

## Type Guards (Type-Safe Error Handling)

```typescript
// Transcript confidence check
function isLowConfidenceSegment(segment: TranscriptSegment): boolean {
  return segment.confidence < 0.70;
}

// AI job status checks
function isJobComplete(job: AIProcessingJob): job is AIProcessingJob & { result: any } {
  return job.status === 'completed' && job.result !== undefined;
}

function isJobFailed(job: AIProcessingJob): job is AIProcessingJob & { error: AIProcessingError } {
  return job.status === 'failed' && job.error !== undefined;
}

// Silence segment checks
function shouldDeleteSegment(segment: SilenceSegment): boolean {
  return segment.deleted && segment.reviewed;
}
```

---

## Next Steps (Phase 1 Continuation)

1. ✅ Data models defined
2. ⏭️ Generate TypeScript contract files in `/contracts/`
3. ⏭️ Create quickstart.md developer guide
4. ⏭️ Update agent context with new models

**Status**: Data model design complete, proceeding to contracts generation
