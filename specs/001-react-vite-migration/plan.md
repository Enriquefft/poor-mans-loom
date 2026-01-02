# Implementation Plan: React 19.2 + Vite Migration

**Branch**: `001-react-vite-migration` | **Date**: 2026-01-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-react-vite-migration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Migrate the Poor Man's Loom application from Next.js to Vite with React 19.2, maintaining all existing client-side functionality (screen recording, camera capture, audio mixing, video editing via FFmpeg.wasm) while improving development experience with faster HMR and build times. The migration is client-only, removes Vercel Analytics, and preserves COOP/COEP headers for SharedArrayBuffer support.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) with React 19.2
**Primary Dependencies**: Vite 6.x, React 19.2, FFmpeg.wasm 0.12.x, Tailwind CSS 4.x, Radix UI components
**Storage**: Client-side only (browser localStorage for preferences, in-memory for recordings)
**Testing**: Manual testing for WebRTC/MediaRecorder APIs (browser permissions), unit tests for timeline operations
**Target Platform**: Modern browsers with WebRTC, MediaRecorder, Web Audio API, SharedArrayBuffer support
**Project Type**: Single-page application (SPA) - client-side only, no backend
**Performance Goals**: Dev server <5s start, HMR <2s, build <30s, 30fps canvas composition
**Constraints**: COOP/COEP headers required for FFmpeg.wasm, HTTPS dev server for WebRTC testing, bundle size within 10% of current
**Scale/Scope**: Small codebase (~50 components), no server infrastructure, static hosting deployment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Client-Side First ✓

**Status**: COMPLIANT

The migration maintains pure client-side architecture. Vite is a client-side build tool that produces static assets. FFmpeg.wasm continues to run in-browser via WebAssembly. No backend dependencies introduced.

### Principle II: Type Safety First ✓

**Status**: COMPLIANT

TypeScript strict mode will be preserved. Vite has excellent TypeScript support with `vite-plugin-react-swc` for fast type checking. ESLint configuration will be maintained (FR-014).

### Principle III: Stream Lifecycle Management ✓

**Status**: COMPLIANT

Existing stream cleanup patterns are preserved. Migration does not affect media API usage - only changes build tooling. All MediaStream cleanup logic in `lib/recorder/` remains unchanged.

### Principle IV: Immutable State Operations ✓

**Status**: COMPLIANT

Timeline operations in `lib/editor/timeline.ts` remain unchanged. Vite migration does not affect state management patterns - only build and dev server infrastructure.

### Principle V: Performance-Conscious Design ✓

**Status**: COMPLIANT

Vite's performance characteristics align with principle:
- Faster dev server startup via native ESM (no bundling in dev)
- Rollup-based production builds with tree-shaking and code splitting
- Lazy loading support for FFmpeg.wasm maintained
- Canvas context optimizations unchanged

### Principle VI: Type-Safe Error Handling ✓

**Status**: COMPLIANT

Error handling patterns in `lib/recorder/camera.ts` and `lib/recorder/audio.ts` remain unchanged. Build tool migration does not affect runtime error handling strategies.

### Architecture Constraints ✓

**Cross-Origin Isolation**: NEEDS CONFIGURATION - COOP/COEP headers currently in `next.config.ts` must be moved to Vite dev server configuration and deployment platform configuration (e.g., `_headers` file for static hosting).

**State Management Boundaries**: COMPLIANT - No changes to state management structure.

**TypeScript Path Aliases**: NEEDS MIGRATION - `@/*` path alias from `tsconfig.json` must be configured in `vite.config.ts` using `resolve.alias`.

**Single Source of Truth**: COMPLIANT - Migration removes Next.js-specific configuration duplication.

### Summary

**Overall Status**: COMPLIANT with 2 configuration migrations required (COOP/COEP headers, path aliases).

No constitutional violations. The migration is purely a build tooling change that maintains all architectural principles. Configuration items will be addressed in Phase 0 research.

## Project Structure

### Documentation (this feature)

```text
specs/001-react-vite-migration/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Client-side SPA structure (existing - will be preserved)
app/
├── favicon.ico
├── globals.css          # Will migrate to src/styles/ or src/
├── layout.tsx           # Will migrate to src/App.tsx or index.html template
├── opengraph-image.tsx  # Static asset - will move to public/
└── page.tsx             # Will migrate to src/App.tsx or src/main.tsx

components/
├── editor/              # Preserved
├── player/              # Preserved
├── recorder/            # Preserved
└── ui/                  # Preserved (Shadcn/Radix components)

lib/
├── editor/              # Preserved
├── recorder/            # Preserved
├── types.ts             # Preserved
└── utils.ts             # Preserved

public/                  # Preserved (static assets)
├── file.svg
├── globe.svg
├── logo.svg
└── [other assets]

# New Vite structure (will be created)
src/                     # New - consolidates app/ content
├── main.tsx             # Vite entry point (replaces app/page.tsx)
├── App.tsx              # Root component (consolidates app/layout.tsx)
├── styles/              # New - for global styles
│   └── globals.css      # Moved from app/
├── components/          # Symlink or move from root
├── lib/                 # Symlink or move from root
└── vite-env.d.ts        # Vite type definitions

# Configuration files
index.html               # New - Vite HTML entry point
vite.config.ts           # New - Vite configuration (replaces next.config.ts)
tsconfig.json            # Updated - Vite-specific paths
package.json             # Updated - replace Next.js with Vite dependencies

# Files to remove
next.config.ts           # Remove - replaced by vite.config.ts
next-env.d.ts            # Remove - replaced by vite-env.d.ts
```

**Structure Decision**: Preserve existing component and lib structure. Create new `src/` directory as Vite entry point. Move Next.js-specific app routing files (`app/layout.tsx`, `app/page.tsx`) into standard React SPA pattern (`src/main.tsx`, `src/App.tsx`). Keep components and lib at root level or symlink into src/ to minimize file moves.

## Complexity Tracking

No constitutional violations requiring justification.

---

## Post-Design Constitution Re-check

*Re-evaluated after Phase 0 (Research) and Phase 1 (Design) completion.*

### Principle I: Client-Side First ✓

**Status**: COMPLIANT (Verified)

Research confirms Vite produces static assets only. All configuration (vite.config.ts, index.html) maintains client-side-only architecture. No server runtime required.

### Principle II: Type Safety First ✓

**Status**: COMPLIANT (Verified)

ESLint configuration preserves TypeScript strict mode rules. SWC plugin provides type checking. All contracts enforce type safety requirements.

### Principle III: Stream Lifecycle Management ✓

**Status**: COMPLIANT (Verified)

No changes to `lib/recorder/` media stream handling. Migration is build-tooling only.

### Principle IV: Immutable State Operations ✓

**Status**: COMPLIANT (Verified)

State management patterns untouched. Timeline operations remain pure functions.

### Principle V: Performance-Conscious Design ✓

**Status**: COMPLIANT (Verified)

Research confirms Vite meets performance targets:
- Dev server <5s: Native ESM, no dev bundling
- HMR <2s: SWC fast refresh
- Build <30s: Rollup with tree-shaking

### Principle VI: Type-Safe Error Handling ✓

**Status**: COMPLIANT (Verified)

Error handling patterns in camera.ts and audio.ts unchanged.

### Architecture Constraints ✓

**Status**: COMPLIANT (Resolved)

- **Cross-Origin Isolation**: ✅ Resolved in R1 (headers middleware + platform config)
- **Path Aliases**: ✅ Resolved in R2 (dual tsconfig/vite config)
- **State Management Boundaries**: ✅ Unchanged
- **Single Source of Truth**: ✅ Improved (removes Next.js config duplication)

### Final Status

**ALL PRINCIPLES COMPLIANT** after design phase. All research decisions (R1-R8) align with constitutional requirements. No violations, no exceptions needed.

Ready to proceed to `/speckit.tasks` for implementation task generation.
