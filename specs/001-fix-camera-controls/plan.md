# Implementation Plan: Fix Camera Controls Accessibility

**Branch**: `001-fix-camera-controls` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-fix-camera-controls/spec.md`

## Summary

Fix the camera overlay controls visibility issue where the 8 modifier buttons (1 circle toggle, 4 position buttons, 2 size buttons) disappear instantly when the mouse leaves the camera preview area, making them unclickable. The controls panel is positioned below the camera overlay (`-bottom-12`), so the `onMouseLeave` event fires before users can reach the buttons. Solution involves implementing a hover area that encompasses both the camera preview and controls panel, with a configurable 300ms delay, and adding touch device support with tap-to-toggle behavior.

## Technical Context

**Language/Version**: TypeScript (strict mode), React 18+, Next.js
**Primary Dependencies**: React hooks (useState, useEffect, useCallback, useRef), Lucide React icons, Shadcn UI
**Storage**: N/A (client-side UI state only)
**Testing**: Manual browser testing (Firefox, Chrome on Linux), touch device testing
**Target Platform**: Web browsers (Firefox, Chrome on Linux; touch devices for mobile)
**Project Type**: Web (Next.js application)
**Performance Goals**: <16ms hover state transitions (60fps), 300ms configurable hide delay
**Constraints**: Must work on touch devices without hover states, high z-index positioning (above most UI, below modals)
**Scale/Scope**: Single component modification (`components/recorder/camera-overlay.tsx`), affects camera customization UX

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Client-Side First ✅
- **Status**: PASS
- **Justification**: Pure client-side UI fix, no backend dependencies. Uses browser DOM events and React state.

### Principle II: Type Safety First ✅
- **Status**: PASS
- **Justification**: Existing component already uses TypeScript strict mode. Changes will maintain full type safety with proper event handlers and state typing.

### Principle III: Stream Lifecycle Management ✅
- **Status**: PASS (Not Applicable)
- **Justification**: No changes to media stream handling. Existing stream cleanup in component remains unchanged.

### Principle IV: Immutable State Operations ✅
- **Status**: PASS
- **Justification**: State updates use React's `setState` which follows immutability. New timer state will follow same pattern.

### Principle V: Performance-Conscious Design ✅
- **Status**: PASS
- **Justification**: 300ms delay timeout is performance-neutral. Debouncing prevents excessive state updates. No canvas or video processing changes.

### Principle VI: Type-Safe Error Handling ✅
- **Status**: PASS (Not Applicable)
- **Justification**: No error-prone operations introduced. DOM event handlers have built-in browser error handling.

### Architecture Constraints ✅
- **Single Source of Truth**: PASS - Hover delay timing will be configurable constant, referenced from single location
- **TypeScript Path Aliases**: PASS - Existing imports already use `@/*` pattern
- **State Management Boundaries**: PASS - Changes confined to camera overlay component state

### Code Review Gates
All applicable gates will be verified during implementation:
1. ✅ TypeScript strict mode compliance
2. ✅ No mutations (React setState pattern)
3. ✅ Type-safe event handlers
4. ✅ Single source of truth (configurable constant)

**GATE STATUS**: ✅ **PASS** - No constitution violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-camera-controls/
├── plan.md              # This file
├── spec.md              # Feature specification
├── checklists/
│   └── requirements.md  # Quality validation checklist
├── research.md          # Phase 0: Research findings (to be created)
├── data-model.md        # Phase 1: Not applicable (no data model)
└── tasks.md             # Phase 2: Task breakdown (created by /speckit.tasks)
```

### Source Code (repository root)

```text
components/
└── recorder/
    └── camera-overlay.tsx    # PRIMARY FILE TO MODIFY

lib/
└── types.ts                  # May need to add configuration types

# Test verification locations
# - Firefox browser (Linux)
# - Chrome browser (Linux)
# - Touch device emulation in DevTools
# - Physical touch device (if available)
```

**Structure Decision**: Single component modification in existing Next.js web application. The camera overlay component (`components/recorder/camera-overlay.tsx`) contains all hover state logic and controls rendering. Changes are isolated to this component's event handlers and state management.

## Complexity Tracking

> No constitution violations requiring justification.

## Phase 0: Research Findings

### Current Implementation Analysis

**Problem Root Cause**:
- Camera overlay div has `onMouseEnter` → `setShowControls(true)` (line 164)
- Camera overlay div has `onMouseLeave` → `setShowControls(false)` (line 165)
- Controls panel is positioned **outside** the overlay div boundary: `className="absolute -bottom-12..."` (line 190)
- When mouse moves from camera to controls, it **leaves** the overlay div, triggering `onMouseLeave` and hiding controls instantly
- The gap between camera bottom and controls top is not part of the hover-tracked element

**Current Code Structure** (`camera-overlay.tsx`):
```typescript
// Line 36: State for controls visibility
const [showControls, setShowControls] = useState(false);

// Lines 164-165: Hover handlers on overlay div
onMouseEnter={() => setShowControls(true)}
onMouseLeave={() => !isDragging && setShowControls(false)}

// Line 189: Controls conditionally rendered
{showControls && !isRecording && (
  <div className="absolute -bottom-12 ...">
    {/* 8 buttons here */}
  </div>
)}
```

### Research Decisions

#### Decision 1: Hover Area Strategy
**Chosen**: Unified hover area using parent container that encompasses both camera preview and controls panel

**Rationale**:
- React's synthetic event system makes it straightforward to track hover state on a parent element
- Avoids complex pointer coordinate tracking
- Works naturally with CSS positioning
- Easy to test and debug

**Alternatives Considered**:
- Manual pointer coordinate tracking: Rejected - complex, error-prone, requires more state
- CSS-only solution (`:hover` with delayed transitions): Rejected - difficult to make configurable, doesn't handle touch devices
- Separate hover listeners on both elements: Rejected - race conditions between mouseleave/mouseenter events

#### Decision 2: Hide Delay Implementation
**Chosen**: React `useEffect` with `setTimeout` cleanup pattern

**Rationale**:
- Standard React pattern for delayed actions
- Automatic cleanup on component unmount
- Easy to make delay configurable via prop or constant
- Cancellable if user re-hovers within delay window

**Implementation Pattern**:
```typescript
useEffect(() => {
  if (!showControls) {
    const timeout = setTimeout(() => {
      setControlsVisible(false);
    }, HIDE_DELAY_MS);
    return () => clearTimeout(timeout);
  } else {
    setControlsVisible(true);
  }
}, [showControls]);
```

**Alternatives Considered**:
- CSS `transition-delay`: Rejected - not cancellable, harder to configure
- `requestAnimationFrame` loop: Rejected - overkill for simple delay
- Third-party debounce library: Rejected - unnecessary dependency for simple timeout

#### Decision 3: Touch Device Detection & Behavior
**Chosen**: Pointer Events API with `window.matchMedia('(pointer: coarse)')` for detection

**Rationale**:
- Modern, standards-based approach
- Distinguishes touch (coarse pointer) from mouse (fine pointer)
- Works reliably across browsers
- Recommended by MDN for touch detection

**Implementation Pattern**:
```typescript
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

// Touch behavior: tap camera to toggle controls
const handleTouchTap = () => {
  setShowControls(prev => !prev);
};
```

**Alternatives Considered**:
- `ontouchstart` detection: Rejected - unreliable, doesn't distinguish hybrid devices
- User agent sniffing: Rejected - brittle, unmaintainable
- Separate mobile build: Rejected - overkill for simple behavior change

#### Decision 4: Z-Index Layering Strategy
**Chosen**: Tailwind CSS z-index utility classes with documented layering

**Rationale**:
- Project already uses Tailwind CSS
- Predictable, maintainable layering
- Follows Tailwind's built-in z-index scale

**Z-Index Values**:
- Camera overlay: `z-50` (existing, already above most UI)
- Controls panel: `z-[60]` (above camera overlay but below modals)
- Modal dialogs: `z-[100]` (Shadcn UI default for dialogs)

**Alternatives Considered**:
- Custom CSS z-index values: Rejected - Tailwind utilities more maintainable
- Portal-based rendering: Rejected - unnecessary complexity for this use case

#### Decision 5: Configurability Approach
**Chosen**: Constant exported from component file with JSDoc comment

**Rationale**:
- Simple to modify for developers
- Single source of truth
- Type-safe (TypeScript const)
- Discoverable via code search

**Implementation**:
```typescript
/**
 * Delay in milliseconds before hiding camera controls after mouse/touch leaves.
 * Adjust this value to accommodate different user speeds and accessibility needs.
 */
export const CAMERA_CONTROLS_HIDE_DELAY_MS = 300;
```

**Alternatives Considered**:
- Environment variable: Rejected - overkill, requires rebuild for changes
- User preference setting: Rejected - out of scope for bug fix (could be future enhancement)
- Component prop: Rejected - no current need for per-instance configuration

### Browser Compatibility Notes

**Firefox & Chrome on Linux**:
- Both support Pointer Events API
- Both handle `setTimeout` cleanup identically
- CSS `z-index` behavior is consistent

**Touch Devices**:
- iOS Safari: Pointer Events supported since iOS 13
- Chrome Mobile: Full Pointer Events support
- Firefox Mobile: Full Pointer Events support

### Performance Considerations

**Hover State Transitions**:
- Current implementation: Instant show/hide (acceptable)
- New implementation: Instant show, 300ms delayed hide
- Performance impact: Negligible (single setTimeout per hover exit)

**Event Handler Overhead**:
- MouseEnter/MouseLeave: Fires once per transition (not per pixel)
- Touch handlers: Fire once per tap
- No performance concerns

## Phase 1: Design & Contracts

### Data Model

**Not Applicable** - This is a UI behavior fix with no data persistence or API contracts.

### Component State Model

**Current State** (camera-overlay.tsx):
```typescript
const [showControls, setShowControls] = useState(false);
const [isDragging, setIsDragging] = useState(false);
```

**Updated State** (proposed):
```typescript
const [isHovering, setIsHovering] = useState(false);        // Track hover intent
const [controlsVisible, setControlsVisible] = useState(false); // Actual visibility (delayed)
const [isDragging, setIsDragging] = useState(false);        // Existing
const [isTouchDevice, setIsTouchDevice] = useState(false);  // Device type detection
```

**State Transitions**:
1. Mouse enters hover area → `setIsHovering(true)` → `setControlsVisible(true)` (instant)
2. Mouse leaves hover area → `setIsHovering(false)` → 300ms delay → `setControlsVisible(false)`
3. Mouse re-enters during delay → `setIsHovering(true)` → clear timeout, `setControlsVisible(true)`
4. Touch device tap #1 → `setControlsVisible(true)`
5. Touch device tap #2 → `setControlsVisible(false)`

### Component Structure Changes

**Before** (simplified):
```tsx
<div onMouseEnter={show} onMouseLeave={hide}>
  {/* camera video */}
  {showControls && <div>{/* buttons */}</div>}
</div>
```

**After** (simplified):
```tsx
<div
  onMouseEnter={handleHoverStart}
  onMouseLeave={handleHoverEnd}
  onClick={isTouchDevice ? handleTouchToggle : undefined}
>
  {/* camera video */}
  {controlsVisible && (
    <div onMouseEnter={handleHoverStart} onMouseLeave={handleHoverEnd}>
      {/* buttons */}
    </div>
  )}
</div>
```

**Key Changes**:
1. Hover handlers track "intent to show" vs "actually visible"
2. Controls panel also has hover handlers to extend hover area
3. Touch device gets click handler for toggle
4. Delay timer manages transition from hover→hidden

### Testing Strategy

**Manual Testing Checklist**:
1. ✅ Firefox on Linux: Hover camera → move to buttons → click button (should not hide)
2. ✅ Chrome on Linux: Same as Firefox
3. ✅ Fast mouse movement: Quickly move from camera to buttons (300ms grace period)
4. ✅ Diagonal movement: Move diagonally from camera to buttons (should work)
5. ✅ Sideways exit: Move mouse sideways off camera (should hide after 300ms)
6. ✅ Touch device: Tap camera once (show), tap button (works), tap camera again (hide)
7. ✅ Z-index layering: Controls appear above other UI, below modal dialogs
8. ✅ Drag interaction: Controls should not interfere with camera dragging
9. ✅ Recording state: Controls should not show during recording (existing behavior)

**Test Platforms**:
- Primary: Firefox + Chrome on Linux (user's reported environment)
- Secondary: Touch device emulation in Chrome DevTools
- Tertiary: Physical touch device (mobile phone/tablet) if available

### Edge Case Handling

| Edge Case | Solution |
|-----------|----------|
| User hovers, then drags camera | Existing `isDragging` state prevents hide during drag |
| Controls overlap with other UI | High z-index (`z-[60]`) ensures controls visible |
| Modal opens while controls visible | Modal z-index (`z-[100]`) correctly overlays controls |
| Touch device with stylus/mouse | Pointer Events API handles hybrid devices correctly |
| Very fast mouse movement (< 16ms) | Controls show instantly, 300ms delay is forgiving |
| Component unmounts while timer active | `useEffect` cleanup clears timeout automatically |

## Phase 2: Task Breakdown

Task breakdown will be generated by `/speckit.tasks` command. This planning phase provides all necessary context for task generation.

**Estimated Task Categories**:
1. **Setup**: Add configuration constant for hide delay
2. **Core Logic**: Implement hover area tracking with delay timer
3. **Touch Support**: Add touch device detection and toggle behavior
4. **Z-Index**: Verify and document z-index layering
5. **Testing**: Manual testing on Firefox, Chrome, touch devices
6. **Documentation**: Update component JSDoc comments

## Next Steps

1. ✅ Planning complete
2. ⏭️ Run `/speckit.tasks` to generate detailed task breakdown
3. ⏭️ Implement tasks in priority order
4. ⏭️ Manual testing on target browsers
5. ⏭️ Verify constitution compliance post-implementation
