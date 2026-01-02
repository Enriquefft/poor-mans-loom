---
description: "Task breakdown for camera controls accessibility fix"
---

# Tasks: Fix Camera Controls Accessibility

**Input**: Design documents from `/specs/001-fix-camera-controls/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md

**Tests**: Manual testing only (per project constitution - browser media APIs cannot be automated)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (Next.js)**: `components/`, `lib/` at repository root
- Primary file: `components/recorder/camera-overlay.tsx`

## Phase 1: Setup (Configuration)

**Purpose**: Add configurable constant for hide delay timing

- [x] T001 Add CAMERA_CONTROLS_HIDE_DELAY_MS constant (300ms) with JSDoc to components/recorder/camera-overlay.tsx

---

## Phase 2: Foundational (Touch Device Detection)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Add isTouchDevice state detection using window.matchMedia('(pointer: coarse)') in components/recorder/camera-overlay.tsx
- [x] T003 [P] Add useEffect hook for touch device detection with cleanup in components/recorder/camera-overlay.tsx

**Checkpoint**: Touch device detection ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Modify Camera Position (Priority: P1) 🎯 MVP

**Goal**: Users can reposition camera overlay using 4 position buttons without controls disappearing when moving mouse from camera to buttons

**Independent Test**: Hover over camera preview, move mouse down to any position button (top-left/top-right/bottom-left/bottom-right), successfully click button to reposition camera. Controls remain visible during entire mouse movement.

### Implementation for User Story 1

- [x] T004 [US1] Replace showControls state with isHovering and controlsVisible states in components/recorder/camera-overlay.tsx
- [x] T005 [US1] Add useEffect hook to implement 300ms delay on controlsVisible (hide only) in components/recorder/camera-overlay.tsx
- [x] T006 [US1] Update onMouseEnter handler to set isHovering(true) on camera overlay div in components/recorder/camera-overlay.tsx
- [x] T007 [US1] Update onMouseLeave handler to set isHovering(false) on camera overlay div in components/recorder/camera-overlay.tsx
- [x] T008 [US1] Add onMouseEnter handler to controls panel div to extend hover area in components/recorder/camera-overlay.tsx
- [x] T009 [US1] Add onMouseLeave handler to controls panel div to track hover exit in components/recorder/camera-overlay.tsx
- [x] T010 [US1] Update controls panel visibility condition to use controlsVisible instead of showControls in components/recorder/camera-overlay.tsx
- [x] T011 [US1] Verify z-index layering: camera overlay (z-50), controls panel (z-[60]) in components/recorder/camera-overlay.tsx

**Manual Testing Checklist for US1**:
1. Firefox on Linux: Hover camera → move to position buttons → click (should not hide)
2. Chrome on Linux: Same test as Firefox
3. Fast mouse movement: Quickly move from camera to position buttons (300ms grace period should work)
4. Diagonal movement: Move diagonally from camera to position buttons (should work)
5. Sideways exit: Move mouse sideways off camera without going to buttons (should hide after 300ms)
6. Drag interaction: Verify controls don't interfere with camera dragging

**Checkpoint**: At this point, camera position controls should work reliably on Firefox and Chrome (Linux)

---

## Phase 4: User Story 2 - Adjust Camera Size (Priority: P1)

**Goal**: Users can adjust camera overlay size using 2 size buttons without controls disappearing when moving mouse from camera to buttons

**Independent Test**: Hover over camera preview, move mouse down to either size button (small/large), successfully click button to resize camera. Controls remain visible during entire mouse movement.

### Implementation for User Story 2

> **Note**: User Story 2 shares the same hover mechanism as User Story 1 (T004-T010 already implemented). Only verification needed.

- [x] T012 [US2] Verify size button click handlers work with new hover state in components/recorder/camera-overlay.tsx
- [x] T013 [US2] Test size change interactions don't interfere with hover delay timer in components/recorder/camera-overlay.tsx

**Manual Testing Checklist for US2**:
1. Firefox on Linux: Hover camera → move to size buttons → click (should not hide)
2. Chrome on Linux: Same test as Firefox
3. Verify size changes are immediate while controls stay visible
4. Test rapid size button clicks don't break hover state

**Checkpoint**: At this point, both position AND size controls should work reliably

---

## Phase 5: User Story 3 - Toggle Camera Shape (Priority: P2)

**Goal**: Users can toggle camera shape to circular using the circle button without controls disappearing when moving mouse from camera to buttons

**Independent Test**: Hover over camera preview, move mouse down to the circle shape button, successfully click to toggle between rectangular and circular. Controls remain visible during entire mouse movement. Test toggle back to rectangle.

### Implementation for User Story 3

> **Note**: User Story 3 shares the same hover mechanism as User Stories 1-2 (T004-T010 already implemented). Only verification needed.

- [x] T014 [US3] Verify shape button click handlers work with new hover state in components/recorder/camera-overlay.tsx
- [x] T015 [US3] Test shape toggle interactions don't interfere with hover delay timer in components/recorder/camera-overlay.tsx

**Manual Testing Checklist for US3**:
1. Firefox on Linux: Hover camera → move to shape buttons → click (should not hide)
2. Chrome on Linux: Same test as Firefox
3. Verify shape changes (rectangle ↔ circle) are immediate while controls stay visible
4. Test rapid shape button clicks don't break hover state

**Checkpoint**: All user stories (position, size, shape) should now be independently functional

---

## Phase 6: Touch Device Support (Cross-Story Enhancement)

**Goal**: Camera controls work on touch devices using tap-to-toggle behavior

**Independent Test**: On touch device, tap camera preview once (controls appear), tap any button (works, controls stay visible), tap camera preview again (controls hide)

### Implementation for Touch Support

- [x] T016 [P] Add onClick handler for touch toggle on camera overlay div in components/recorder/camera-overlay.tsx
- [x] T017 [P] Implement handleTouchToggle function to toggle controlsVisible state in components/recorder/camera-overlay.tsx
- [x] T018 Add conditional onClick attachment (only for touch devices) in camera overlay div in components/recorder/camera-overlay.tsx
- [x] T019 Ensure touch tap on buttons doesn't trigger camera preview onClick in components/recorder/camera-overlay.tsx

**Manual Testing Checklist for Touch**:
1. Touch device emulation in Chrome DevTools: Test tap-to-show, tap-to-hide
2. Tap position button: Should work, controls stay visible
3. Tap size button: Should work, controls stay visible
4. Tap shape button: Should work, controls stay visible
5. Tap camera again after button press: Controls should hide
6. Physical touch device (if available): Verify all behaviors work

**Checkpoint**: Touch device support complete - all input methods now work

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories, documentation, and final validation

- [x] T020 [P] Add JSDoc comments to new event handlers in components/recorder/camera-overlay.tsx
- [x] T021 [P] Add JSDoc comment to CAMERA_CONTROLS_HIDE_DELAY_MS explaining configurability in components/recorder/camera-overlay.tsx
- [ ] T022 Verify timer cleanup on component unmount (useEffect return function) in components/recorder/camera-overlay.tsx
- [ ] T023 Verify controls don't show during recording (existing isRecording check still works) in components/recorder/camera-overlay.tsx
- [ ] T024 Code review: Verify TypeScript strict mode compliance (no any, no suppressions) in components/recorder/camera-overlay.tsx
- [ ] T025 Final manual testing: Run complete test matrix on Firefox + Chrome (Linux) + touch device

**Final Manual Testing Matrix**:

| Test Scenario | Firefox (Linux) | Chrome (Linux) | Touch Device |
|--------------|----------------|----------------|--------------|
| Position buttons accessible | ☐ | ☐ | ☐ |
| Size buttons accessible | ☐ | ☐ | ☐ |
| Shape buttons accessible | ☐ | ☐ | ☐ |
| 300ms delay works correctly | ☐ | ☐ | N/A |
| Fast mouse movement (grace period) | ☐ | ☐ | N/A |
| Diagonal mouse movement | ☐ | ☐ | N/A |
| Sideways exit (hide after 300ms) | ☐ | ☐ | N/A |
| Touch tap-to-show | N/A | N/A | ☐ |
| Touch tap-to-hide | N/A | N/A | ☐ |
| Controls don't show during recording | ☐ | ☐ | ☐ |
| Drag camera still works | ☐ | ☐ | ☐ |
| Z-index layering correct | ☐ | ☐ | ☐ |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (P1): Independent - can start after Foundational
  - User Story 2 (P1): Shares hover mechanism from US1 - verification only
  - User Story 3 (P2): Shares hover mechanism from US1 - verification only
- **Touch Support (Phase 6)**: Depends on US1 hover implementation being complete
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 hover mechanism (T004-T010) - Verification only, no new implementation
- **User Story 3 (P2)**: Depends on US1 hover mechanism (T004-T010) - Verification only, no new implementation
- **Touch Support**: Depends on US1 hover state implementation (T004-T005)

### Within Each User Story

- Setup (T001) before Foundational (T002-T003)
- Foundational (T002-T003) before User Story 1 implementation (T004-T011)
- User Story 1 core tasks (T004-T007) before controls panel tasks (T008-T009)
- All hover state changes (T004-T010) before z-index verification (T011)
- User Story 1 complete before User Story 2 verification (T012-T013)
- User Stories 1-2 complete before User Story 3 verification (T014-T015)
- User Story 1 hover state (T004-T005) before Touch Support (T016-T019)

### Parallel Opportunities

**Limited parallelization** - This is a single-file bug fix with sequential dependencies:

- Phase 1 (T001): Single task, no parallelization
- Phase 2 (T002, T003): T003 can run in parallel with T002 (marked [P])
- Phase 3 (US1): Sequential implementation in single file
- Phase 4 (US2): T012 and T013 can be done together (verification tasks)
- Phase 5 (US3): T014 and T015 can be done together (verification tasks)
- Phase 6 (Touch): T016, T017 can run in parallel with T018 (marked [P])
- Phase 7 (Polish): T020, T021 can run in parallel (marked [P])

**Note**: Most tasks modify the same file (camera-overlay.tsx) sequentially. Parallel opportunities are limited to verification tasks and documentation.

---

## Parallel Example: Touch Device Support (Phase 6)

```bash
# These tasks can be done in parallel (different logical sections):
Task: "Add onClick handler for touch toggle on camera overlay div"
Task: "Implement handleTouchToggle function to toggle controlsVisible state"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T003) - CRITICAL
3. Complete Phase 3: User Story 1 (T004-T011)
4. **STOP and VALIDATE**: Manual testing on Firefox + Chrome (Linux)
5. If passing, camera position controls are now working - MVP complete!

### Incremental Delivery

1. Setup + Foundational (T001-T003) → Foundation ready
2. Add User Story 1 (T004-T011) → Test position buttons independently → MVP!
3. Add User Story 2 (T012-T013) → Test size buttons independently → Size feature working
4. Add User Story 3 (T014-T015) → Test shape buttons independently → All desktop features working
5. Add Touch Support (T016-T019) → Test on touch devices → Full mobile support
6. Polish (T020-T025) → Final validation → Production ready

### Single Developer Strategy

This is a single-component bug fix - one developer workflow:

1. Complete tasks in order: T001 → T002 → T003 → ...
2. Stop at each checkpoint to validate independently
3. Manual test after each user story phase
4. Final comprehensive testing in Phase 7

---

## Notes

- **Single file modification**: All implementation tasks modify `components/recorder/camera-overlay.tsx`
- **Constitution compliance**: All tasks follow TypeScript strict mode, immutable state (React setState), client-side only
- **No automated tests**: Per project constitution, browser media APIs require manual testing
- **Hover state changes**: Core fix is in T004-T010 (User Story 1)
- **User Stories 2-3**: Primarily verification since hover mechanism is shared
- **Touch support**: Separate phase (T016-T019) to enable touch devices
- **Configurability**: T001 exports constant for easy adjustment
- **Performance**: 300ms timeout is negligible overhead, no performance concerns
- Commit after completing each phase for easier rollback
- Stop at any checkpoint to validate story independently
