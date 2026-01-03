# Implementation Plan: AI-Powered Recording Enhancements

**Branch**: `001-ai-transformer-features` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ai-transformer-features/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement client-side AI features for screen recordings using transformer.js and MediaPipe: automatic transcription with Whisper model for accessibility, real-time background blur/removal for privacy, intelligent silence detection for video quality, and auto-generated captions. All processing occurs entirely in the browser without external API calls, preserving user privacy while delivering professional recording capabilities.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) with React 19.2
**Primary Dependencies**: transformer.js (Whisper model), MediaPipe (segmentation), @xenova/transformers, Web Audio API, Canvas API
**Storage**: Browser localStorage for transcripts/captions/silence markers (~10MB limit)
**Testing**: Manual testing for AI model integration, unit tests for pure functions (transcript search, silence detection logic)
**Target Platform**: Modern browsers (Chrome 120+, Firefox 120+, Safari 17+) with Web Audio API and SharedArrayBuffer support
**Project Type**: Web application (client-side only, Vite-based)
**Performance Goals**:
- Transcription: 10-minute recording processed in <3 minutes on standard hardware
- Background effects: Real-time 30fps processing during recording
- Silence detection: Analysis completes in <10 seconds for 20-minute recording
- Caption synchronization: ±200ms audio/video sync accuracy
**Constraints**:
- Client-side processing only (no server uploads)
- Models loaded from CDN (50-200MB initial download)
- localStorage limits (~10MB per domain)
- Real-time performance for background effects (30fps minimum)
**Scale/Scope**:
- Support recordings up to 2 hours duration
- Handle transcript files up to 50,000 words
- Process multiple simultaneous AI operations (transcription + silence detection)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Client-Side First ✅

**Compliance**: PASS

- All AI models run via transformer.js (client-side WASM/WebGL)
- MediaPipe segmentation executes in browser
- No backend API calls for processing
- Models loaded from CDN (crossorigin-enabled)

**Alignment**: Perfect alignment. Feature explicitly requires client-side processing (FR-020).

### Principle II: Type Safety First ✅

**Compliance**: PASS (pending implementation)

- All AI service functions will return typed results
- Model outputs typed with confidence scores
- State management uses typed interfaces
- No `any`, `@ts-ignore`, or unsafe casts

**Alignment**: Standard TypeScript patterns apply. AI model outputs require strict typing.

### Principle III: Stream Lifecycle Management ⚠️

**Compliance**: PARTIAL - Requires attention during implementation

- Background blur/removal uses camera streams (existing cleanup patterns apply)
- No new media streams introduced by transcription/captions
- Audio analysis for silence detection uses existing recording streams

**Action Required**: Ensure background effect streams are cleaned up when:
- User disables background effects during recording
- Recording stops
- Errors occur in segmentation pipeline

### Principle IV: Immutable State Operations ✅

**Compliance**: PASS (pending implementation)

- Transcripts stored as immutable objects with edit history
- Silence segments follow existing timeline segment pattern
- Caption updates create new caption objects
- AI processing state managed immutably

**Alignment**: Extends existing immutable timeline patterns to AI-generated data.

### Principle V: Performance-Conscious Design ✅

**Compliance**: PASS with specific optimizations

- Lazy load AI models (transformer.js) only when features used
- CDN-host model files (50-200MB) to avoid bundle bloat
- Use Web Workers for transcription to avoid UI blocking
- Background segmentation integrated with existing 30fps canvas pipeline

**Optimizations**:
- Model caching in browser after first download
- Incremental transcription (process audio chunks progressively)
- GPU acceleration via WebGL for model inference where available

### Principle VI: Type-Safe Error Handling ✅

**Compliance**: PASS (pending implementation)

- AI model failures return `ModelLoadError | InferenceError`
- Transcription errors: `{ error: string; type: 'NO_SPEECH' | 'MODEL_LOAD_FAILED' | 'INFERENCE_ERROR' }`
- Segmentation errors: `{ error: string; type: 'MEDIAPIPE_INIT_FAILED' | 'SEGMENTATION_ERROR' }`
- Low confidence handled as data (flagged segments), not errors

**Alignment**: Extends existing type-safe error pattern to AI operations.

### Architecture Constraints

**Cross-Origin Isolation**: ✅ COMPATIBLE

- transformer.js requires SharedArrayBuffer (already configured for FFmpeg.wasm)
- Existing COOP/COEP headers in vite.config.ts apply
- MediaPipe compatible with current isolation policy

**State Management Boundaries**: ✅ EXTENDS CLEANLY

- **AI Processing State**: New boundary in `lib/ai/` (model loading, inference progress)
- **Transcript State**: Managed alongside recording in editor state
- **Background Effect State**: Integrated with recording state (real-time application)

No conflicts with existing boundaries (Recording/Editor/App State).

**TypeScript Path Aliases**: ✅ COMPLIANT

- Use `@/lib/ai/*` for AI services
- Use `@/lib/editor/transcript.ts` for transcript operations
- Consistent with existing pattern

**Single Source of Truth**: ✅ MAINTAINED

- Model configurations centralized in `@/lib/ai/config.ts`
- Confidence thresholds in single config location (70% for transcription)
- Silence detection thresholds in config (2 seconds @ -40dB)

### Summary

**Status**: ✅ PASSES all gates with monitoring required for Stream Lifecycle Management

**No violations requiring justification in Complexity Tracking table.**

**Post-Phase 1 Re-Check Required**: Verify stream cleanup implementation for background effects.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-transformer-features/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── ai-services.ts   # Type definitions for AI service contracts
│   └── transcript-api.ts # Transcript manipulation API contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── ai/                         # NEW: AI service layer
│   │   ├── config.ts              # Model configs, thresholds, CDN URLs
│   │   ├── transcription.ts       # Whisper model integration
│   │   ├── segmentation.ts        # MediaPipe background effects
│   │   ├── silence-detection.ts   # Audio analysis for silence
│   │   ├── captions.ts            # Caption generation from transcripts
│   │   └── types.ts               # AI-specific type definitions
│   ├── editor/
│   │   ├── transcript.ts          # NEW: Transcript operations (search, edit)
│   │   ├── timeline.ts            # EXTEND: Add silence segment operations
│   │   └── operations.ts          # EXTEND: Caption overlay in exports
│   ├── recorder/
│   │   ├── compositor.ts          # EXTEND: MediaPipe segmentation integration
│   │   └── audio.ts               # EXTEND: Audio capture for transcription
│   └── storage/
│       └── persistence.ts          # NEW: localStorage for transcripts/captions
├── components/
│   ├── editor/
│   │   ├── transcript-viewer.tsx  # NEW: Transcript display with search
│   │   ├── silence-markers.tsx    # NEW: Timeline silence indicators
│   │   └── caption-editor.tsx     # NEW: Caption customization UI
│   └── recorder/
│       └── background-controls.tsx # NEW: Blur/removal toggle controls
└── hooks/
    └── use-ai-processing.ts        # NEW: AI operation state management

tests/
├── unit/
│   ├── ai-transcription.test.ts   # Mock model tests
│   ├── silence-detection.test.ts  # Audio analysis logic
│   └── transcript-search.test.ts  # Search algorithm tests
└── integration/
    └── ai-pipeline.test.ts         # End-to-end AI workflow tests
```

**Structure Decision**: Extends existing Vite web application structure with new `lib/ai/` module for AI services and `lib/storage/` for persistence. Integrates with existing recorder and editor modules through clean interfaces. No architectural changes needed.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations requiring justification. All constitution principles are satisfied by the current design.
