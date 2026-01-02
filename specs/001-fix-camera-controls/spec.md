# Feature Specification: Fix Camera Controls Accessibility

**Feature Branch**: `001-fix-camera-controls`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "the camera modifier buttons, circle camera, the 4 position buttons & the 2 size buttons cant be clicked, when the mouse leaves the camera screen, since the 8 buttons are below it, they disapear instantly, this happens on firefox & chrome, on linux, havent tested on other devices"

## Clarifications

### Session 2026-01-02

- Q: What is the acceptable delay before controls hide after mouse leaves both the camera preview and controls area? → A: 300ms, easily configurable
- Q: How should camera controls behave on touch devices that don't support hover states? → A: Show on first tap, hide on second tap (toggle)
- Q: What should happen when other UI elements overlap with the camera controls area? → A: Controls have high z-index (above most UI, below modals/dialogs)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Modify Camera Position (Priority: P1)

Users need to reposition their camera overlay (top-left, top-right, bottom-left, bottom-right) during recording setup without the controls disappearing when moving the mouse cursor.

**Why this priority**: Camera positioning is a core feature for creating professional-looking recordings. Without working position controls, users cannot customize their recording layout, making the feature effectively broken.

**Independent Test**: Can be fully tested by hovering over the camera preview, moving the mouse down to any of the 4 position buttons, and successfully clicking to change camera position. Delivers immediate visual feedback of camera repositioning.

**Acceptance Scenarios**:

1. **Given** user is on the recording setup page with camera preview visible, **When** user hovers over camera preview and moves mouse to a position button (e.g., top-right), **Then** the controls remain visible and the button can be clicked to reposition the camera
2. **Given** camera is in bottom-left position, **When** user clicks the top-right position button, **Then** camera preview moves to top-right corner and controls remain accessible
3. **Given** user is on a touch device with camera preview visible, **When** user taps the camera preview once, **Then** the controls appear and remain visible
4. **Given** controls are visible on a touch device, **When** user taps a position button, **Then** camera repositions and controls remain visible for further adjustments
5. **Given** controls are visible on a touch device, **When** user taps the camera preview again (second tap), **Then** controls hide

---

### User Story 2 - Adjust Camera Size (Priority: P1)

Users need to adjust their camera overlay size (using 2 size buttons) during recording setup without the controls disappearing when moving the mouse cursor.

**Why this priority**: Camera size adjustment is essential for balancing screen real estate with visibility of the presenter. Without working size controls, users are locked into a single camera size, limiting recording customization.

**Independent Test**: Can be fully tested by hovering over the camera preview, moving the mouse down to either size button, and successfully clicking to change camera size. Delivers immediate visual feedback of camera resizing.

**Acceptance Scenarios**:

1. **Given** user is on the recording setup page with camera preview visible, **When** user hovers over camera preview and moves mouse to a size button, **Then** the controls remain visible and the button can be clicked to resize the camera
2. **Given** camera is at default size, **When** user clicks a different size button, **Then** camera preview changes size and controls remain accessible

---

### User Story 3 - Toggle Camera Shape (Priority: P2)

Users need to toggle their camera overlay shape to circular using the circle camera button during recording setup without the controls disappearing when moving the mouse cursor.

**Why this priority**: Camera shape customization enhances the professional appearance of recordings, but is less critical than position and size controls. Users can still create functional recordings without this feature.

**Independent Test**: Can be fully tested by hovering over the camera preview, moving the mouse down to the circle shape button, and successfully clicking to toggle between rectangular and circular camera shapes. Delivers immediate visual feedback of shape change.

**Acceptance Scenarios**:

1. **Given** user is on the recording setup page with camera preview visible, **When** user hovers over camera preview and moves mouse to the circle button, **Then** the controls remain visible and the button can be clicked to toggle camera shape
2. **Given** camera is rectangular, **When** user clicks the circle button, **Then** camera preview becomes circular and controls remain accessible
3. **Given** camera is circular, **When** user clicks the circle button again, **Then** camera preview becomes rectangular and controls remain accessible

---

### Edge Cases

- Fast mouse movement from camera preview to buttons: The 300ms delay provides sufficient grace period for quick mouse movements while preventing accidental flickering
- Diagonal mouse movement from camera preview to buttons: Controls remain visible as long as hover state persists on either preview or controls area
- Mouse moving sideways off preview area: Controls hide after 300ms delay (unless mouse enters controls area within that window)
- UI element overlap with camera controls area: Camera controls have high z-index positioning (above most UI elements but below modal dialogs and critical system overlays) to ensure accessibility while respecting important system-level interactions
- Touch devices without hover state: First tap on camera preview shows controls, second tap hides controls (toggle behavior); controls stay visible while interacting with buttons

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Camera modifier controls (8 buttons: 1 circle toggle, 4 position buttons, 2 size buttons) MUST remain visible when user moves mouse from camera preview area to the control buttons area
- **FR-002**: Camera modifier controls MUST remain visible with a 300ms delay after mouse cursor leaves both the camera preview and controls area to allow users to reach and click any of the 8 buttons without the controls disappearing prematurely
- **FR-003**: The controls hide delay timing MUST be easily configurable to accommodate different user preferences and accessibility needs
- **FR-004**: All 8 camera modifier buttons MUST be clickable and functional when controls are visible
- **FR-005**: Camera preview hover state MUST persist when mouse cursor is over either the camera preview itself OR the camera modifier controls area
- **FR-006**: Controls MUST hide only when the mouse cursor leaves both the camera preview area AND the controls area (after the configured delay)
- **FR-007**: On touch devices, the first tap on the camera preview MUST show the controls, and a second tap on the camera preview MUST hide the controls (toggle behavior)
- **FR-008**: On touch devices, controls MUST remain visible while user interacts with any of the 8 camera modifier buttons
- **FR-009**: Camera modifier controls MUST have high z-index positioning to appear above most UI elements (ensuring accessibility) while remaining below modal dialogs and critical system overlays
- **FR-010**: System MUST work consistently across Firefox and Chrome browsers on Linux
- **FR-011**: Visual feedback MUST indicate when camera preview is in a hoverable/interactive state

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully click any of the 8 camera modifier buttons on first attempt without controls disappearing (100% success rate in testing)
- **SC-002**: Controls remain visible for the entire duration of mouse movement from camera preview to any button (measured as zero premature hide events during user testing)
- **SC-003**: Feature works identically on Firefox and Chrome browsers on Linux (zero browser-specific failures in testing)
- **SC-004**: Users can complete camera customization tasks (change position, size, or shape) in under 5 seconds without frustration or repeated attempts
