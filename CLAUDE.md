# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Poor Man's Loom is a browser-based screen recording application that provides recording, editing, and exporting capabilities entirely client-side. The application uses modern web APIs (MediaRecorder, Web Audio, Canvas) and FFmpeg.wasm to avoid backend dependencies and subscription fees.

## Development Commands

```bash
# Install dependencies
bun install

# Run development server with Vite (HTTPS enabled for WebRTC)
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Run linter
bun run lint
```

## Architecture

### Application Flow

The app operates in two distinct modes managed by `src/App.tsx`:

1. **Recording Mode** (`appState: 'recording'`)
   - User configures camera, audio, and recording settings
   - Records screen + optional camera overlay + optional audio
   - Outputs a WebM Blob with recording metadata

2. **Editing Mode** (`appState: 'editing'`)
   - User trims, splits, and deletes segments from timeline
   - Exports to WebM or MP4 with quality presets
   - Uses FFmpeg.wasm for video processing

### Key Technical Components

#### Recording Pipeline (`src/lib/recorder/`)

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

#### Editing Pipeline (`src/lib/editor/`)

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

#### AI Features Pipeline (`src/lib/ai/`)

The application includes client-side AI capabilities for enhanced recording quality and accessibility:

1. **Automatic Transcription** (`transcription.ts`, `transcription-worker.ts`)
   - Uses Whisper Tiny model (40MB) via @xenova/transformers
   - Runs in Web Worker to avoid blocking UI
   - Provides word-level timestamps for precise seeking
   - Auto-triggers after recording completion
   - Exports to SRT/VTT formats
   - **Performance**: ~2x realtime (10min recording = 5min processing)
   - **Storage**: Uses browser localStorage (~10MB limit)

2. **Silence Detection** (`silence-detection.ts`)
   - Analyzes audio via Web Audio API
   - Detects silence >2 seconds @ -40dB threshold
   - Auto-triggers after transcription
   - Allows batch removal of silent segments
   - **Performance**: <10 seconds analysis for 20-minute recording

3. **Background Effects** (`segmentation.ts`)
   - Uses MediaPipe Selfie Segmentation model
   - Real-time background blur/removal during recording
   - GPU acceleration with CPU fallback
   - Integrates with compositor for 30fps performance
   - **Performance**: 30fps with GPU, 10-15fps with CPU

4. **Caption Generation** (`captions.ts`)
   - Auto-generates captions from transcript
   - Supports SRT and VTT formats
   - Burn-in to video via FFmpeg
   - Customizable styling (font, color, position)
   - Auto-syncs when transcript edited

**AI Models**:
- Whisper Tiny EN: ~40MB (English-only, faster)
- Whisper Tiny: ~75MB (multilingual, slower) - available via config
- MediaPipe Segmentation: ~4MB

**Error Handling**:
- Graceful degradation when models fail to load
- Retry logic with exponential backoff (3 attempts)
- Hardware capability detection with warnings
- Storage quota monitoring and cleanup suggestions

**Privacy**:
- All processing happens client-side (no server uploads)
- Models loaded from CDN (HuggingFace, Google)
- Data stored in browser localStorage only
- No analytics or tracking

### Important Patterns

#### Cross-Origin Isolation (vite.config.ts)

FFmpeg.wasm requires SharedArrayBuffer, which needs COOP/COEP headers:

**Development (vite.config.ts)**:
```typescript
{
  name: 'configure-response-headers',
  configureServer: (server) => {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      next()
    })
  },
}
```

**Production**: Headers configured in `public/_headers` (Netlify) and `vercel.json` (Vercel).

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

#### Editor State (`src/lib/types.ts`)
```typescript
EditorState {
  segments: TimelineSegment[]    // Timeline segments
  currentTime: number            // Playback position
  duration: number               // Total video duration
  isPlaying: boolean             // Playback state
}
```

#### App State (`src/App.tsx`)
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

The project uses `@/*` to reference the `src/` directory:

```typescript
import { Button } from "@/components/ui/button"
import { EditorState } from "@/lib/types"
```

Configuration in both `tsconfig.json` (TypeScript) and `vite.config.ts` (build):
- `tsconfig.json`: `"@/*": ["./src/*"]`
- `vite.config.ts`: `alias: { '@': path.resolve(__dirname, './src') }`

### UI Components

The project uses Shadcn UI (Radix primitives + Tailwind):
- Components are in `src/components/ui/`
- Can be customized by editing the component files
- Use `components.json` for Shadcn CLI configuration

### Testing Considerations

When testing recording features:
- Browser permissions must be granted interactively (cannot be automated in headless tests)
- Use manual testing for MediaRecorder, getDisplayMedia, getUserMedia
- FFmpeg operations can be tested with mock blobs
- Timeline operations are pure functions and unit-testable
- AI feature testing: See `INTEGRATION_TEST_PLAN.md` for manual test procedures

## Troubleshooting AI Features

### Common Issues and Solutions (T151)

#### "AI features unavailable" Error

**Symptoms**: Toast notification on app load, transcription/background effects disabled

**Cause**: SharedArrayBuffer not available (missing HTTPS or cross-origin isolation headers)

**Solution**:
1. Ensure running on HTTPS (or `localhost`)
2. Verify headers in browser DevTools → Network tab:
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Embedder-Policy: require-corp`
3. If developing locally, check `vite.config.ts` middleware is active
4. If deployed, check `public/_headers` (Netlify) or `vercel.json` (Vercel)

#### "Failed to download AI model" Error

**Symptoms**: Transcription stuck on "Loading Whisper model..." or fails after retries

**Cause**: Network issue, firewall blocking CDN, or CDN temporarily unavailable

**Solution**:
1. Check internet connection
2. Try different network (CDN might be blocked on corporate networks)
3. Wait a few minutes and retry (CDN might be temporarily down)
4. Check browser console for specific error (e.g., CORS, 404)
5. If HuggingFace CDN blocked, model ID can be changed in `src/lib/ai/config.ts`

#### Slow Transcription Performance

**Symptoms**: 10-minute recording takes >10 minutes to transcribe

**Possible Causes**:
- Low-end hardware (2 cores, <4GB RAM)
- Browser tabs consuming CPU
- Running on battery power (CPU throttling)

**Solutions**:
1. Close other browser tabs/applications
2. Plug in laptop (disable battery saver mode)
3. Wait for Web Worker to warm up (first run is slower)
4. Consider upgrading hardware for faster processing

#### Background Effect Lag/Stuttering

**Symptoms**: Camera preview shows <15fps during recording, choppy video

**Cause**: GPU unavailable or disabled, CPU fallback too slow

**Solutions**:
1. Check browser console for "GPU delegation unavailable" warning
2. Enable hardware acceleration in browser settings:
   - Chrome: `chrome://settings/system` → "Use graphics acceleration"
3. Update GPU drivers
4. Reduce recording resolution (720p instead of 1080p)
5. Disable background effects if GPU unavailable

#### Storage Quota Exceeded

**Symptoms**: "Storage quota exceeded" toast, transcription/captions fail to save

**Cause**: localStorage limit (~10MB) reached after multiple recordings

**Solution**: See "localStorage Cleanup Procedure" below

#### Low Confidence Transcript Segments

**Symptoms**: Some transcript segments flagged with low confidence

**Cause**: Poor audio quality, background noise, accents, technical jargon

**Solutions**:
1. Use better microphone for future recordings
2. Record in quiet environment
3. Manually edit flagged segments in transcript viewer
4. Adjust confidence threshold in `src/lib/ai/config.ts` (default: 0.7)

## localStorage Cleanup Procedure (T152)

### For Users

1. **Via Storage Usage Indicator** (Recommended):
   - Click the storage indicator in the top-right header
   - Review storage breakdown (transcripts, captions, silence data)
   - Click "Clear All AI Data" button
   - Confirm deletion

2. **Via Browser DevTools**:
   - Open DevTools (F12)
   - Go to "Application" tab → "Local Storage"
   - Expand domain → Delete keys starting with `pml_ai_`
   - Refresh page

### For Developers

```typescript
import { storageService } from '@/lib/storage/persistence';

// Clear all AI data for a specific recording
await storageService.clearRecordingData('rec_1234567890');

// Clear all stored data (factory reset)
await storageService.clearAll();

// Check storage usage programmatically
const stats = storageService.getStorageStats();
console.log(`Using ${stats.totalBytes} bytes (${stats.usagePercentage}%)`);
```

### What Gets Deleted

- **Transcripts**: All word-level transcriptions with timestamps
- **Captions**: Generated captions with styling information
- **Silence Segments**: Detected silence markers for timeline
- **AI Job Metadata**: Processing status and history
- **Background Effect Settings**: Per-recording effect preferences

### What Does NOT Get Deleted

- **Recording Blobs**: Stored in memory only (never persisted)
- **User Preferences**: App settings, UI state (uses different localStorage keys)
- **FFmpeg Cache**: WASM files cached separately by browser

### Storage Limits by Browser

| Browser | localStorage Limit | IndexedDB Limit (Model Cache) |
|---------|-------------------|------------------------------|
| Chrome | ~10MB | ~60% of free disk space |
| Firefox | ~10MB | ~50% of free disk space |
| Safari | ~5MB | ~1GB per origin |
| Edge | ~10MB | ~60% of free disk space |

**Note**: Model cache (Whisper, MediaPipe) uses IndexedDB, not localStorage. It's managed automatically by browser and can be cleared via DevTools → Application → IndexedDB.

## Performance Tuning Guide (T153)

### Hardware Requirements

#### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **GPU**: Not required (CPU fallback available)
- **Storage**: 100MB free (for model cache)
- **Browser**: Chrome 120+, Firefox 120+, Edge 120+, Safari 17+

#### Recommended for Optimal Performance
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **GPU**: Dedicated GPU with WebGL 2.0 support
- **Storage**: 200MB+ free
- **Network**: 10+ Mbps for initial model download

### Performance Tuning by Hardware Class

#### High-End Desktop/Laptop (8+ cores, GPU, 16GB+ RAM)

**Expected Performance**:
- Transcription: 1-2 minutes for 10-minute recording
- Background effects: 30fps @ 1080p with GPU
- Silence detection: <5 seconds for 20-minute recording

**Tuning**:
- No tuning needed
- Consider multilingual model for non-English content (update `config.ts`)
- Enable highest export quality ("High" preset)

#### Mid-Range Laptop (4 cores, Integrated GPU, 8GB RAM)

**Expected Performance**:
- Transcription: 2-3 minutes for 10-minute recording
- Background effects: 30fps @ 720p with GPU, 10-15fps @ 1080p
- Silence detection: <10 seconds for 20-minute recording

**Tuning**:
- Keep default settings (English-only model)
- Reduce recording resolution to 720p for background effects
- Use "Medium" export quality preset

#### Low-End Laptop (2 cores, No GPU, 4GB RAM)

**Expected Performance**:
- Transcription: 5-10 minutes for 10-minute recording
- Background effects: <10fps (not recommended)
- Silence detection: 10-20 seconds for 20-minute recording

**Tuning**:
- Avoid background effects or use blur (faster than removal)
- Close other browser tabs during processing
- Use "Low" export quality preset
- Consider recording shorter segments (<5 minutes)
- Ensure laptop plugged in (no battery throttling)

### Browser-Specific Optimizations

#### Chrome/Edge (Recommended)
- Best performance for AI features
- Full WebGL 2.0 support
- Hardware acceleration enabled by default
- `navigator.deviceMemory` API available for hardware detection

#### Firefox
- Good performance, slightly slower than Chrome for AI
- WebGL 2.0 support
- May require manual hardware acceleration enable in `about:config`

#### Safari
- Limited SharedArrayBuffer support (requires HTTPS + specific headers)
- Slower AI inference (no WASM SIMD)
- Background effects may have reduced performance
- Recommended for recording only, use Chrome/Edge for AI features

### Configuration Tweaks

#### For Faster Transcription (Lower Accuracy)

Edit `src/lib/ai/config.ts`:

```typescript
export const TRANSCRIPTION_CONFIG = {
  CHUNK_LENGTH_SEC: 60, // Increase from 30 (less context, faster)
  STRIDE_LENGTH_SEC: 2, // Decrease from 5 (less overlap, faster)
  // ... other settings
};
```

#### For Higher Accuracy (Slower Transcription)

```typescript
export const TRANSCRIPTION_CONFIG = {
  CHUNK_LENGTH_SEC: 20, // Decrease from 30 (more context, slower)
  STRIDE_LENGTH_SEC: 8, // Increase from 5 (more overlap, slower)
  // ... other settings
};
```

#### For More Aggressive Silence Detection

```typescript
export const SILENCE_DETECTION_CONFIG = {
  THRESHOLD_DB: -35, // Increase from -40 (detect more silence)
  MIN_DURATION_SEC: 1.0, // Decrease from 2.0 (detect shorter silences)
  // ... other settings
};
```

### Monitoring Performance

#### Browser DevTools

1. **Performance Tab**:
   - Record while transcribing
   - Look for long tasks (>50ms) - should be in Web Worker
   - Check for memory leaks (heap size should stabilize)

2. **Memory Tab**:
   - Heap snapshot before/after transcription
   - Typical usage: ~200MB (model) + ~50MB (transcript data)

3. **Network Tab**:
   - First-time model download: ~44MB (Whisper + MediaPipe)
   - Subsequent loads: 0 bytes (cached in IndexedDB)

#### Console Logging

Enable verbose logging:

```typescript
// In src/lib/ai/transcription-worker.ts
console.log('Model loading progress:', progress);
console.log('GPU enabled:', gpuEnabled);
```

### Reducing Storage Usage

If nearing 10MB localStorage limit:

1. **Delete Old Transcripts**:
   - Use Storage Usage Indicator → Clear All AI Data
   - Or selectively delete via browser DevTools

2. **Disable Auto-Caption Generation**:
   - Edit `src/App.tsx` - comment out `captionService.generate()`
   - Saves ~1-2MB per recording

3. **Reduce Transcript Storage**:
   - Edit transcripts to remove filler words (um, uh, etc.)
   - Storage proportional to word count

## Active Technologies
- TypeScript 5.x (strict mode) with React 19.2
- Vite 6.x build tool with @vitejs/plugin-react-swc
- FFmpeg.wasm 0.12.x for client-side video processing
- Tailwind CSS 4.x with @tailwindcss/postcss
- Radix UI components via Shadcn UI
- Client-side only (browser localStorage for preferences, in-memory for recordings)
- TypeScript 5.x (strict mode) with React 19.2 + transformer.js (Whisper model), MediaPipe (segmentation), @xenova/transformers, Web Audio API, Canvas API (001-ai-transformer-features)
- Browser localStorage for transcripts/captions/silence markers (~10MB limit) (001-ai-transformer-features)

## Recent Changes
- 001-react-vite-migration: Migrated from Next.js 16 to Vite 6, upgraded React to 19.2, removed Vercel Analytics, configured COOP/COEP headers for FFmpeg.wasm
