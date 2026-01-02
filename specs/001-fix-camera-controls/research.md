# Research Findings: Fix Camera Controls Accessibility

**Date**: 2026-01-02
**Feature**: Camera controls hover visibility bug fix
**Branch**: 001-fix-camera-controls

## Problem Analysis

### Root Cause Identified

The camera overlay controls disappear before users can click them due to a **hover area boundary mismatch**:

1. **Camera overlay container** (lines 154-166 in camera-overlay.tsx):
   - Has `onMouseEnter` → shows controls
   - Has `onMouseLeave` → hides controls
   - Contains the camera video preview

2. **Controls panel** (lines 189-279 in camera-overlay.tsx):
   - Positioned **outside** the camera overlay: `className="absolute -bottom-12..."`
   - The `-bottom-12` class places it 48px below the camera container
   - **Not included in the hover-tracked element**

3. **User interaction flow**:
   - User hovers over camera → controls show
   - User moves mouse down to click a button
   - Mouse **leaves** camera container → `onMouseLeave` fires
   - Controls hide **instantly** before user reaches them
   - User cannot click the buttons

### Code Evidence

```typescript
// camera-overlay.tsx:164-165
onMouseEnter={() => setShowControls(true)}
onMouseLeave={() => !isDragging && setShowControls(false)}

// camera-overlay.tsx:190
<div className="absolute -bottom-12 left-1/2 -translate-x-1/2 ...">
  {/* Controls panel with 8 buttons */}
</div>
```

The gap between the camera bottom edge and controls top edge is **not part of the hover-tracked area**.

## Technology Research

### Decision 1: Hover Area Extension Strategy

**Question**: How should we extend the hover area to include both camera and controls?

**Options Evaluated**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Unified parent container | Clean, React-native, easy to debug | Requires restructuring JSX | ✅ **CHOSEN** |
| Manual pointer tracking | Fine-grained control | Complex state, error-prone, hard to maintain | ❌ Rejected |
| CSS-only (`:hover` delays) | No JavaScript needed | Not configurable, no touch support | ❌ Rejected |
| Separate hover listeners | Minimal changes | Race conditions between events | ❌ Rejected |

**Decision**: Unified hover area using parent container

**Rationale**:
- React synthetic events make parent-level tracking straightforward
- Controls can have their own `onMouseEnter`/`onMouseLeave` to extend the hover area
- Natural CSS positioning (controls are children of hovered element)
- Easy to test and reason about
- Single source of truth for hover state

**Implementation**:
```typescript
// Parent container tracks hover intent
<div onMouseEnter={handleHoverStart} onMouseLeave={handleHoverEnd}>
  {/* camera video */}

  {/* Controls also participate in hover area */}
  {controlsVisible && (
    <div onMouseEnter={handleHoverStart} onMouseLeave={handleHoverEnd}>
      {/* buttons */}
    </div>
  )}
</div>
```

### Decision 2: Hide Delay Implementation

**Question**: How should we implement the 300ms configurable delay before hiding controls?

**Options Evaluated**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| `useEffect` + `setTimeout` | Standard React pattern, auto cleanup | Requires effect dependency management | ✅ **CHOSEN** |
| CSS `transition-delay` | Pure CSS, no JS | Not cancellable, hard to configure | ❌ Rejected |
| `requestAnimationFrame` loop | High precision timing | Overkill, more complex | ❌ Rejected |
| Lodash/external debounce | Battle-tested library | Unnecessary dependency | ❌ Rejected |

**Decision**: React `useEffect` with `setTimeout` cleanup pattern

**Rationale**:
- Idiomatic React pattern for delayed state changes
- Automatic cleanup on component unmount (prevents memory leaks)
- Cancellable: if user re-hovers within 300ms, timeout is cleared
- Easy to make configurable via constant
- No external dependencies

**Implementation Pattern**:
```typescript
useEffect(() => {
  if (!isHovering) {
    // User left hover area - start hide timer
    const timeout = setTimeout(() => {
      setControlsVisible(false);
    }, CAMERA_CONTROLS_HIDE_DELAY_MS);

    // Cleanup: cancel timer if user re-hovers or component unmounts
    return () => clearTimeout(timeout);
  } else {
    // User entered hover area - show immediately
    setControlsVisible(true);
  }
}, [isHovering]);
```

**Edge Cases Handled**:
- User re-hovers within 300ms: Timer cleared, controls stay visible
- Component unmounts: Cleanup function clears timer
- Rapid hover on/off: Only the latest timer runs

### Decision 3: Touch Device Detection & Behavior

**Question**: How should we detect touch devices and implement tap-to-toggle?

**Options Evaluated**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Pointer Events API (`pointer: coarse`) | Modern, standards-based, reliable | Requires media query check | ✅ **CHOSEN** |
| `ontouchstart` in window | Simple check | Unreliable, doesn't handle hybrid devices | ❌ Rejected |
| User agent sniffing | Works on old browsers | Brittle, unmaintainable, unreliable | ❌ Rejected |
| Separate mobile build | Complete control | Overkill for simple behavior change | ❌ Rejected |

**Decision**: Pointer Events API with `window.matchMedia('(pointer: coarse)')`

**Rationale**:
- Recommended by MDN for touch detection
- Distinguishes touch (coarse pointer) from mouse (fine pointer)
- Handles hybrid devices (laptop with touchscreen) correctly
- Widely supported: iOS 13+, Chrome Mobile, Firefox Mobile
- Standards-based approach

**Implementation Pattern**:
```typescript
const [isTouchDevice, setIsTouchDevice] = useState(false);

useEffect(() => {
  const mediaQuery = window.matchMedia('(pointer: coarse)');
  setIsTouchDevice(mediaQuery.matches);

  // Optional: listen for changes (user connects/disconnects mouse)
  const handler = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches);
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}, []);

// Touch behavior: tap camera to toggle
const handleTouchToggle = () => {
  setControlsVisible(prev => !prev);
};
```

**Browser Compatibility**:
- Firefox on Linux: Full support ✅
- Chrome on Linux: Full support ✅
- iOS Safari 13+: Full support ✅
- Chrome Mobile: Full support ✅
- Firefox Mobile: Full support ✅

### Decision 4: Z-Index Layering

**Question**: How should we ensure camera controls appear above other UI but below modals?

**Options Evaluated**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Tailwind z-index utilities | Maintainable, predictable scale | Limited to predefined values | ✅ **CHOSEN** |
| Custom CSS z-index | Full control over values | Harder to maintain, no system | ❌ Rejected |
| Portal-based rendering | Guarantees top-level stacking | Overkill, breaks DOM hierarchy | ❌ Rejected |

**Decision**: Tailwind CSS z-index utility classes with documented layering

**Rationale**:
- Project already uses Tailwind CSS consistently
- Tailwind provides predictable z-index scale
- Custom values available via bracket notation: `z-[60]`
- Easy to reason about and maintain

**Z-Index Hierarchy**:
```
z-[100] - Modal dialogs (Shadcn UI default)
z-[60]  - Camera controls panel (new)
z-50    - Camera overlay container (existing)
z-40    - Other floating UI elements
z-10    - Elevated content
z-0     - Base layer
```

**Implementation**:
```tsx
// Camera overlay (existing)
<div className="z-50 group ...">

// Controls panel (update from current implementation)
<div className="absolute -bottom-12 z-[60] ...">
  {/* buttons */}
</div>
```

### Decision 5: Configurability

**Question**: How should the 300ms delay be configurable?

**Options Evaluated**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Exported constant with JSDoc | Simple, type-safe, discoverable | Requires code change | ✅ **CHOSEN** |
| Environment variable | Runtime configurable | Overkill, requires rebuild | ❌ Rejected |
| User preference UI | Most flexible | Out of scope for bug fix | ❌ Deferred |
| Component prop | Flexible per-instance | No current use case | ❌ Rejected |

**Decision**: Constant exported from component file with JSDoc comment

**Rationale**:
- Requirement: "easily configurable" (FR-003)
- Developers can find and modify via code search
- Single source of truth (follows constitution)
- Type-safe (TypeScript const)
- No build/runtime complexity
- Future enhancement: could be promoted to user preference

**Implementation**:
```typescript
/**
 * Delay in milliseconds before hiding camera controls after mouse/touch leaves.
 * Adjust this value to accommodate different user speeds and accessibility needs.
 *
 * @default 300
 * @see FR-003 in spec.md
 */
export const CAMERA_CONTROLS_HIDE_DELAY_MS = 300;
```

## Performance Analysis

### Hover State Transitions

**Current Implementation**:
- Show: Instant (0ms) via `onMouseEnter`
- Hide: Instant (0ms) via `onMouseLeave`
- Performance: Excellent, no overhead

**Proposed Implementation**:
- Show: Instant (0ms) via `onMouseEnter`
- Hide: Delayed (300ms) via `setTimeout`
- Performance: Negligible overhead (single timer per hover exit)

**Analysis**:
- `setTimeout` is highly optimized in modern browsers
- Timer overhead: < 1ms to schedule
- No continuous polling or animation loops
- Timer automatically cleared on cleanup
- **Verdict**: No measurable performance impact

### Event Handler Overhead

**Mouse Events**:
- `onMouseEnter` / `onMouseLeave`: Fire once per boundary crossing
- Not fired per pixel movement (unlike `onMouseMove`)
- Minimal CPU impact

**Touch Events**:
- `onClick` on touch devices: Fire once per tap
- No continuous tracking
- Minimal CPU impact

**Verdict**: No performance concerns

### React Re-render Analysis

**State Changes**:
1. `isHovering` toggle: 1 re-render on hover enter/exit
2. `controlsVisible` toggle: 1 re-render after delay or immediate show
3. `isTouchDevice`: Set once on mount, never changes

**Optimization Opportunities**:
- `useCallback` for event handlers (prevent inline function recreation)
- `useMemo` for derived styles (already implemented in component)
- No optimization needed for this bug fix (already optimal)

## Browser Compatibility

### Target Browsers (User Reported)

**Firefox on Linux**: ✅ Full support
- Pointer Events API: Yes
- `setTimeout` cleanup: Standard
- `matchMedia`: Full support
- Z-index behavior: Standard

**Chrome on Linux**: ✅ Full support
- Same as Firefox (Chromium engine)

### Extended Browser Support

**Touch Devices**:
- iOS Safari 13+: ✅ Pointer Events API supported
- Chrome Mobile: ✅ Full support
- Firefox Mobile: ✅ Full support
- Samsung Internet: ✅ Full support (Chromium-based)

**Desktop Browsers**:
- Safari: ✅ Full support
- Edge: ✅ Full support (Chromium-based)
- Older browsers: Graceful degradation (no touch detection, hover works)

## Testing Strategy

### Manual Testing Requirements

**Primary Platforms** (User's Environment):
1. Firefox on Linux
2. Chrome on Linux

**Test Scenarios**:
1. ✅ Hover camera → move to buttons → click (controls stay visible)
2. ✅ Fast mouse movement (controls show instantly, hide after 300ms)
3. ✅ Diagonal mouse movement to buttons (works correctly)
4. ✅ Sideways exit from camera (controls hide after 300ms)
5. ✅ Drag camera while controls visible (drag works, controls persist)
6. ✅ Controls during recording (should not show - existing behavior)

**Touch Device Testing**:
1. ✅ Tap camera once → controls appear
2. ✅ Tap button → action executes, controls stay visible
3. ✅ Tap camera again → controls hide
4. ✅ Tap outside camera with controls visible → controls stay (expected)

**Z-Index Testing**:
1. ✅ Controls appear above camera overlay
2. ✅ Controls appear above other UI elements
3. ✅ Modal dialog appears above controls (if present in app)

### Automated Testing

**Not Applicable** - Per project constitution (CLAUDE.md):
> Manual Testing Required: MediaRecorder, getDisplayMedia, getUserMedia (browser permissions cannot be automated)

Camera overlay is part of the recording UI, so manual testing is the approved approach.

## Summary

All research questions resolved. Implementation ready to proceed with:

1. **Hover Area**: Unified parent container with nested hover handlers
2. **Delay**: React `useEffect` + `setTimeout` pattern (300ms configurable)
3. **Touch**: Pointer Events API for detection, tap-to-toggle behavior
4. **Z-Index**: Tailwind utilities with documented hierarchy
5. **Config**: Exported constant with JSDoc

Next step: `/speckit.tasks` to generate implementation tasks.
