<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0
Modified principles: None (existing principles unchanged)
Added sections:
  - Principle VII: Root Cause Resolution (new principle for bug fix methodology)
Removed sections: None
Templates requiring updates:
  ✅ .specify/templates/plan-template.md - Reviewed, constitution check section compatible
  ✅ .specify/templates/spec-template.md - Reviewed, requirements align with all principles including new VII
  ✅ .specify/templates/tasks-template.md - Reviewed, task categorization supports principle-driven work including robust bug fixes
Follow-up TODOs: None
-->

# Poor Man's Loom Constitution

## Core Principles

### I. Client-Side First

All features MUST execute entirely in the browser without backend dependencies. This principle is NON-NEGOTIABLE.

- Use native Web APIs (MediaRecorder, Web Audio API, Canvas API) for media operations
- Use WebAssembly (FFmpeg.wasm) for client-side video processing
- Avoid server-side processing, storage, or computation
- External resources MUST be CORS-enabled or use appropriate `crossorigin` attributes

**Rationale**: Eliminates subscription costs, protects user privacy, and ensures the application works offline after initial load.

### II. Type Safety First

TypeScript strict mode MUST be enforced without exceptions. All code MUST be fully typed with no escape hatches. This principle is NON-NEGOTIABLE.

**Rules**:
- No implicit `any` - all types MUST be explicitly declared or safely inferred
- No `@ts-ignore` or `@ts-nocheck` - fix the type error, never suppress it
- No `as` type casting - use type guards, runtime validation, or refactor the code
- Prefer inferred return types over explicit annotations

**Rationale**: Type errors in production cause data corruption, AI pipeline failures, and WhatsApp message delivery issues. The compiler catches these errors before deployment. Suppression mechanisms hide real problems.

### III. Stream Lifecycle Management

Media streams MUST be explicitly cleaned up to prevent resource leaks. This principle is NON-NEGOTIABLE.

- Call `stream.getTracks().forEach(track => track.stop())` when:
  - Stopping recording
  - Switching camera/audio devices
  - Component unmounts
  - Errors occur during stream operations
- Off-DOM video elements MUST be used for canvas composition to prevent browser auto-suspension
- Never attach composition video elements to the DOM tree

**Rationale**: Browser media streams consume system resources (camera, microphone, screen capture). Failure to clean up causes resource exhaustion and prevents other applications from accessing devices.

### IV. Immutable State Operations

State transformations MUST be pure functions returning new state objects.

- Timeline operations (trim, split, delete) return new segment arrays
- No mutation of existing state objects
- Enable time-travel debugging and predictable state changes
- Segment model: `{id, startTime, endTime, deleted}` with immutable operations

**Rationale**: Immutable state prevents subtle bugs from shared references, enables undo/redo functionality, and makes state changes auditable and testable.

### V. Performance-Conscious Design

Optimize for browser performance constraints without premature optimization.

- Canvas context MUST use `{alpha: false, desynchronized: true}` for composition
- Target 30fps for canvas capture (balances quality and performance)
- Use stream copy (`-c copy`) for FFmpeg segment extraction to avoid double-encoding
- Lazy load FFmpeg.wasm only when export functionality is needed
- CDN-host large dependencies (WASM files) to avoid bundle bloat

**Rationale**: Browser-based video processing is resource-intensive. These patterns ensure smooth recording and editing on typical consumer hardware.

### VI. Type-Safe Error Handling

Use type-safe error results instead of throwing exceptions for expected failures.

- Pattern: `function operation(): SuccessType | ErrorResult`
- ErrorResult shape: `{ error: string; type: ErrorType }`
- Check with type guards: `if (isErrorType(result)) { /* handle */ }`
- Applied to: Camera capture, audio mixing, device enumeration

**Rationale**: Browser media APIs have many expected failure modes (permissions denied, device in use, not found). Type-safe errors make these failures explicit and force callers to handle them.

### VII. Root Cause Resolution

When fixing bugs, MUST identify and fix the root cause. Bandaid fixes and temporary workarounds are PROHIBITED.

**Rules**:
- Trace the bug to its origin - do not fix symptoms
- If the root cause cannot be fixed immediately, document why and create a tracking issue
- Temporary fixes MUST include:
  - Inline comment explaining the root cause
  - Link to tracking issue for proper fix
  - Clear TODO with context
- Prefer refactoring over workarounds
- Do not patch over type errors, race conditions, or undefined behavior

**Rationale**: Bandaid fixes accumulate technical debt, create fragile code with hidden dependencies, and make future changes risky. Symptoms reappear in different forms when root causes remain unaddressed. Robust fixes prevent entire classes of related bugs.

## Architecture Constraints

### Cross-Origin Isolation Requirements

Features requiring SharedArrayBuffer (e.g., FFmpeg.wasm) MUST have COOP/COEP headers configured:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Configured in: `next.config.ts`

### State Management Boundaries

- **Recording State**: Managed in `screen-recorder.tsx` (recording progress, streams)
- **Editor State**: Managed via pure functions in `lib/editor/timeline.ts` (segments, playback)
- **App State**: Managed in `app/page.tsx` (mode switching, recording data persistence)

Do not mix concerns across these boundaries.

### TypeScript Path Aliases

Use `@/*` to reference the root directory. Never use relative paths that traverse more than one parent directory.

Good: `import { Button } from "@/components/ui/button"`
Bad: `import { Button } from "../../components/ui/button"`

### Single Source of Truth

Avoid duplicating configuration, state, or logic across multiple locations.

- Configuration: Centralize in config files, not scattered across components
- State: One authoritative source per data domain
- Constants: Define once, import everywhere
- Utility functions: Shared library, not copy-pasted

**Rationale**: Duplication causes inconsistencies when one copy is updated but others are forgotten. Changes require finding all copies. Bugs fixed in one location remain in others.

## Development Workflow

### Testing Requirements

- **Manual Testing Required**: MediaRecorder, getDisplayMedia, getUserMedia (browser permissions cannot be automated)
- **Unit Testing**: Timeline operations (pure functions), utility functions
- **Integration Testing**: FFmpeg operations with mock blobs
- **Performance Testing**: Verify 30fps canvas composition under typical hardware constraints

### Code Review Gates

All changes MUST verify:

1. TypeScript strict mode compliance (no `any`, no suppressions, no unsafe casts)
2. Stream cleanup in all error and success paths
3. No DOM-attached video elements for composition
4. Immutable state operations (no mutations)
5. Type-safe error handling for media APIs
6. Cross-origin isolation compatibility for new dependencies
7. Single source of truth maintained (no duplication)
8. Bug fixes address root causes, not symptoms (Principle VII)

### Documentation Requirements

Update CLAUDE.md when:

- Adding new media pipeline components
- Changing state management patterns
- Introducing new performance-critical code paths
- Modifying error handling patterns

## Governance

This constitution supersedes all other development practices.

**Amendment Process**:

1. Proposed changes MUST be documented with rationale
2. Changes affecting core principles (I-VII) require justification of why existing approach insufficient
3. Version bump according to semantic versioning (see below)
4. Update dependent templates (plan, spec, tasks) for consistency
5. Migration plan required for breaking changes

**Versioning Policy**:

- **MAJOR**: Backward incompatible principle removals or redefinitions
- **MINOR**: New principles added or materially expanded guidance
- **PATCH**: Clarifications, wording fixes, non-semantic refinements

**Compliance Review**:

- Constitution compliance checked during feature planning (plan.md constitution check section)
- Violations MUST be justified with simpler alternatives considered
- Use CLAUDE.md for runtime development guidance (implementation details)
- Use Constitution for governance and non-negotiable principles

**Version**: 1.1.0 | **Ratified**: 2026-01-02 | **Last Amended**: 2026-01-02
