# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Poor Man's Loom is a browser-based screen recording application that provides recording, editing, and exporting capabilities entirely client-side. The application uses modern web APIs (MediaRecorder, Web Audio, Canvas) and FFmpeg.wasm to avoid backend dependencies and subscription fees.

## Development Commands

```bash
# Install dependencies
bun install

# Run development server with Turbopack
bun run dev

# Build for production
bun run build

# Start production server
bun start

# Run linter
bun run lint
```

## Architecture

### Application Flow

The app operates in two distinct modes managed by `app/page.tsx`:

1. **Recording Mode** (`appState: 'recording'`)
   - User configures camera, audio, and recording settings
   - Records screen + optional camera overlay + optional audio
   - Outputs a WebM Blob with recording metadata

2. **Editing Mode** (`appState: 'editing'`)
   - User trims, splits, and deletes segments from timeline
   - Exports to WebM or MP4 with quality presets
   - Uses FFmpeg.wasm for video processing

### Key Technical Components

#### Recording Pipeline (`lib/recorder/`)

The recording system composes multiple media streams into a single recording:

1. **Screen Capture** (`screen.ts`)
   - Uses `navigator.mediaDevices.getDisplayMedia()`
   - Extracts display frame rate and dimensions
   - Optional system audio capture

2. **Camera Capture** (`camera.ts`)
   - Uses `navigator.mediaDevices.getUserMedia()`
   - Configured for 640x480 @ 30fps
   - Comprehensive error handling (permissions, device not found, in-use)

3. **Audio Mixing** (`audio.ts`)
   - Uses Web Audio API to mix multiple sources
   - Creates `AudioContext` with `MediaStreamDestination`
   - Combines microphone + system audio via GainNodes

4. **Video Composition** (`compositor.ts`)
   - **Critical**: Uses Canvas API to overlay camera on screen
   - Creates off-DOM `<video>` elements to prevent browser suspension
   - Waits for videos to be ready with `canplay` event + timeout
   - Uses `requestAnimationFrame` for 30fps drawing loop
   - Supports configurable camera position, size, shape, and horizontal flip
   - Returns `canvas.captureStream(30)` for recording

5. **MediaRecorder** (`screen-recorder.tsx`)
   - Combines canvas video stream + mixed audio stream
   - Records to Blob chunks with auto-detected MIME type
   - Handles cleanup and error recovery

#### Editing Pipeline (`lib/editor/`)

The editor uses a segment-based approach for efficient video manipulation:

1. **Timeline Operations** (`timeline.ts`)
   - **Immutable state**: All operations return new state objects
   - Segment model: `{id, startTime, endTime, deleted}`
   - Operations: trimStart, trimEnd, splitSegment, deleteSegment, restoreSegment
   - Pure functions enable time-travel debugging

2. **FFmpeg Integration** (`ffmpeg.ts`)
   - Singleton FFmpeg.wasm instance with lazy loading
   - Loads from CDN: `https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd`
   - Virtual File System (VFS) for in-memory file operations
   - Progress callback for UI updates

3. **Export Engine** (`operations.ts`)
   - **Single segment optimization**: Direct trim + encode in one pass
   - **Multiple segments**: Extract with stream copy (`-c copy`) + concat demuxer + final encode
   - Quality presets via CRF (Constant Rate Factor):
     - Low: veryfast preset, CRF 28
     - Medium: fast preset, CRF 23
     - High: medium preset, CRF 18
   - Format support: WebM (VP9/Opus) or MP4 (H.264/AAC)

### Important Patterns

#### Cross-Origin Isolation (next.config.ts)

FFmpeg.wasm requires SharedArrayBuffer, which needs COOP/COEP headers:

```typescript
headers: [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }
]
```

**When adding external resources**: Ensure they are CORS-enabled or use `crossorigin` attribute.

#### Stream Cleanup

Always clean up media streams to prevent resource leaks:

```typescript
stream.getTracks().forEach(track => track.stop());
```

**Critical locations**:
- When stopping recording
- When switching camera devices
- When component unmounts
- When errors occur

#### Off-DOM Video Elements

Videos used for canvas composition must be off-DOM to prevent browser auto-suspension during tab backgrounding. Do not attach these elements to the DOM tree.

#### Error Handling Pattern

Use type-safe error results instead of exceptions:

```typescript
type ErrorResult = { error: string; type: ErrorType };
function someOperation(): MediaStream | ErrorResult { ... }
if (isSomeError(result)) { /* handle error */ }
```

This pattern is used in `camera.ts` and `audio.ts`.

### State Management

#### Recording State (`screen-recorder.tsx`)
- `isRecording`: boolean - Recording in progress
- `isPaused`: boolean - Recording paused
- `stream`: MediaStream | null - Active recording stream

#### Editor State (`lib/types.ts`)
```typescript
EditorState {
  segments: TimelineSegment[]    // Timeline segments
  currentTime: number            // Playback position
  duration: number               // Total video duration
  isPlaying: boolean             // Playback state
}
```

#### App State (`app/page.tsx`)
- `appState`: 'recording' | 'editing' - UI mode switcher
- `recordingData`: {blob, duration} | null - Persistent recording data

### Performance Considerations

1. **Canvas Context Optimization**
   - Use `{alpha: false, desynchronized: true}` for better performance
   - Location: `compositor.ts:28`

2. **30fps Canvas Capture**
   - Balances quality and performance
   - Efficient for most video codecs

3. **Stream Copy for Segment Extraction**
   - Use `-c copy` to avoid re-encoding when extracting segments
   - Only encode once during final merge

4. **FFmpeg.wasm Lazy Loading**
   - Load FFmpeg only when needed (export button click)
   - CDN-hosted to avoid bundling large WASM files

### TypeScript Path Aliases

The project uses `@/*` to reference the root directory:

```typescript
import { Button } from "@/components/ui/button"
import { EditorState } from "@/lib/types"
```

### UI Components

The project uses Shadcn UI (Radix primitives + Tailwind):
- Components are in `components/ui/`
- Can be customized by editing the component files
- Use `components.json` for Shadcn CLI configuration

### Testing Considerations

When testing recording features:
- Browser permissions must be granted interactively (cannot be automated in headless tests)
- Use manual testing for MediaRecorder, getDisplayMedia, getUserMedia
- FFmpeg operations can be tested with mock blobs
- Timeline operations are pure functions and unit-testable

## Active Technologies
- TypeScript (strict mode), React 18+, Next.js + React hooks (useState, useEffect, useCallback, useRef), Lucide React icons, Shadcn UI (001-fix-camera-controls)
- N/A (client-side UI state only) (001-fix-camera-controls)

## Recent Changes
- 001-fix-camera-controls: Added TypeScript (strict mode), React 18+, Next.js + React hooks (useState, useEffect, useCallback, useRef), Lucide React icons, Shadcn UI
