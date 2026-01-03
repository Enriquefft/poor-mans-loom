# Integration Test Plan (Phase 7, T144-T149)

This document outlines end-to-end integration tests for AI-powered recording features.

**Status**: Manual testing required (browser APIs like MediaRecorder cannot be fully automated)

---

## T144: Record → Transcribe → Search → Export SRT

### Objective
Verify complete transcription workflow from recording to searchable transcript export.

### Prerequisites
- Chrome/Edge browser (for optimal compatibility)
- Microphone access
- ~50MB free bandwidth (model download)

### Test Steps

1. **Record Audio**
   - Navigate to application
   - Click "Start Recording"
   - Grant screen + audio permissions
   - Speak clearly: "The quick brown fox jumps over the lazy dog. Testing transcription accuracy."
   - Record for 30 seconds
   - Click "Stop Recording"
   - **Expected**: Recording saved, video player visible

2. **Auto-Transcription**
   - Wait for transcription to auto-trigger
   - **Expected**: Toast shows "Transcribing audio..."
   - **Expected**: Progress updates appear (0% → 100%)
   - **Expected**: Toast shows "Transcription complete (X segments)"
   - **Duration**: Should complete in <30 seconds for 30-second recording

3. **Search Transcript**
   - Locate transcript viewer panel
   - Type "fox" in search box
   - **Expected**: Search results highlight matching segments
   - **Expected**: Search shows "1 result" or similar
   - Click on search result
   - **Expected**: Video seeks to timestamp of that word

4. **Export SRT**
   - Click "Export" button
   - Select "SRT" format from options (if available) or use caption export
   - Click "Download"
   - **Expected**: `.srt` file downloads
   - Open SRT file in text editor
   - **Expected**: Format matches SRT spec:
     ```
     1
     00:00:01,000 --> 00:00:03,500
     The quick brown fox
     ```

### Success Criteria
- ✅ Recording captures audio clearly
- ✅ Transcription completes without errors
- ✅ Search finds correct segments
- ✅ SRT export is valid and contains transcribed text
- ✅ Timestamps in SRT match video playback

### Known Limitations
- Transcription accuracy depends on audio quality (target: 90%+)
- Search is case-insensitive
- Short words (<3 letters) may have less accurate timestamps

---

## T145: Record → Detect Silence → Remove All → Export

### Objective
Verify silence detection and removal workflow.

### Test Steps

1. **Record with Silence**
   - Start recording
   - Speak for 10 seconds
   - **Be silent for 5 seconds**
   - Speak for 10 seconds again
   - **Be silent for 5 seconds**
   - Speak for final 10 seconds
   - Stop recording
   - **Expected**: ~40-second recording with 10 seconds of silence

2. **Auto Silence Detection**
   - Wait for silence detection to auto-trigger (after transcription)
   - **Expected**: Toast shows "Detecting silence..."
   - **Expected**: Toast shows "Found X silence segments (Ys total)"
   - **Expected**: Timeline shows red/gray markers for silence

3. **Review Silence Markers**
   - Scrub through timeline
   - **Expected**: Silence markers align with silent portions
   - **Expected**: No false positives during speech

4. **Remove All Silence**
   - Click "Remove All Silence" button
   - **Expected**: Confirmation dialog appears
   - Confirm removal
   - **Expected**: Silent segments removed from timeline
   - **Expected**: Timeline segments now total ~30 seconds
   - Play through edited video
   - **Expected**: No silence gaps, speech flows continuously

5. **Export**
   - Click "Export" → select MP4/WebM
   - Choose "Medium" quality
   - Export video
   - **Expected**: Exported video is ~30 seconds (not 40)
   - Play exported file
   - **Expected**: Silence successfully removed

### Success Criteria
- ✅ Silence detection finds gaps >2 seconds @ <-40dB
- ✅ Silence markers accurately placed
- ✅ Remove All successfully deletes silent segments
- ✅ Exported video shorter than original
- ✅ Audio remains continuous (no pops/clicks)

---

## T146: Record with Background Blur → Export → Verify Effect

### Objective
Verify real-time background effects (blur/removal) during recording.

### Test Steps

1. **Enable Camera**
   - Navigate to recording screen
   - Toggle "Enable Camera" option
   - Grant camera permission
   - **Expected**: Camera preview appears

2. **Enable Background Blur**
   - Click "Background Effects" dropdown
   - Select "Blur" option
   - Adjust blur intensity slider (optional)
   - **Expected**: Camera preview shows blurred background
   - **Expected**: Person/face remains sharp
   - **Expected**: 30fps performance (no lag)

3. **Record with Effect**
   - Click "Start Recording"
   - Move around, change position
   - Record for 30 seconds
   - Stop recording
   - **Expected**: Preview shows background remained blurred

4. **Verify in Playback**
   - Play recorded video
   - **Expected**: Background is blurred throughout
   - **Expected**: Person segmentation accurate (no flickering)
   - **Expected**: No edge artifacts around person

5. **Export and Verify**
   - Export video
   - Download and play in external player (VLC, etc.)
   - **Expected**: Background blur effect preserved in export
   - **Expected**: Video quality maintained

### Success Criteria
- ✅ Background blur applies in real-time (30fps)
- ✅ Segmentation accurate (person vs background)
- ✅ Effect persists in recording and export
- ✅ No performance degradation during recording

### Known Limitations
- Segmentation works best with single person
- Complex backgrounds (e.g., through windows) may have artifacts
- GPU acceleration significantly improves performance

---

## T147: Transcribe → Generate Captions → Burn into Video → Export

### Objective
Verify automatic caption generation and burn-in to video.

### Test Steps

1. **Record and Transcribe**
   - Record 60-second video with speech
   - Wait for auto-transcription
   - **Expected**: Transcript appears with timestamps

2. **Auto-Generate Captions**
   - Verify captions auto-generated from transcript
   - **Expected**: Toast shows "X captions generated"
   - Open Caption Editor panel
   - **Expected**: Captions listed with timestamps
   - **Expected**: Caption text matches transcript

3. **Customize Caption Style**
   - Change font family to "Arial"
   - Change font size to 24px
   - Change text color to #FFFF00 (yellow)
   - Change background color to #000000 (black)
   - Select position: "Bottom Center"
   - **Expected**: Preview updates (if available)

4. **Export with Burn-In**
   - Click "Export"
   - Enable "Captions" option
   - Select "Burn into video"
   - Choose MP4 format
   - Export
   - **Expected**: FFmpeg processes with caption overlay
   - **Expected**: Export completes successfully

5. **Verify in Player**
   - Play exported MP4 in external player
   - **Expected**: Captions visible at bottom of video
   - **Expected**: Captions styled correctly (yellow text, black bg)
   - **Expected**: Caption timing matches speech (±200ms)
   - **Expected**: Captions readable (no overlap, proper line breaks)

### Success Criteria
- ✅ Captions auto-generated from transcript
- ✅ Caption styling applied correctly
- ✅ FFmpeg burn-in successful
- ✅ Captions synchronized with audio (±200ms tolerance)
- ✅ Exported video playable in standard players

---

## T148: Cross-Feature Test: Transcribe + Silence Detection Simultaneously

### Objective
Verify multiple AI operations can run concurrently without conflicts.

### Test Steps

1. **Record Audio**
   - Record 60-second video with speech + silence
   - Stop recording

2. **Monitor Concurrent Processing**
   - **Expected**: Toast shows "Transcribing audio..." first
   - **Expected**: While transcription running, silence detection also starts
   - **Expected**: Progress updates for both operations
   - Monitor browser performance (CPU/memory via DevTools)
   - **Expected**: UI remains responsive during processing

3. **Verify Both Complete**
   - **Expected**: Transcription completes first (~30 seconds)
   - **Expected**: Silence detection completes second (~10 seconds)
   - **Expected**: Both results visible in UI:
     - Transcript panel populated
     - Silence markers on timeline

4. **Verify Data Consistency**
   - Check transcript timestamps
   - Check silence segment timestamps
   - **Expected**: No timestamp overlaps or conflicts
   - Edit transcript
   - **Expected**: Captions auto-update
   - **Expected**: No interference with silence markers

### Success Criteria
- ✅ Both AI operations run concurrently
- ✅ UI remains responsive (no freezing)
- ✅ Both operations complete successfully
- ✅ No data corruption or conflicts
- ✅ State management handles concurrent updates

### Performance Metrics
- **CPU Usage**: Should stay <80% on modern hardware
- **Memory Usage**: Should stay <1GB total
- **Time to Complete**: Combined should be <60 seconds for 60-second recording

---

## T149: Performance Test: 10-Minute Recording Transcription

### Objective
Verify transcription meets performance target of <3 minutes for 10-minute recording.

### Prerequisites
- Modern desktop/laptop (4+ cores, 8GB+ RAM recommended)
- Stable internet for model download
- 10 minutes to record test content

### Test Steps

1. **Prepare Test Recording**
   - Record 10-minute video with continuous speech
   - Suggested: Record a podcast, lecture, or read an article aloud
   - Stop recording

2. **Trigger Transcription**
   - Note start time
   - Wait for auto-transcription to begin
   - **Expected**: Model loads (if first time: ~30 seconds)

3. **Monitor Progress**
   - Watch progress updates
   - Monitor system resources (CPU, memory)
   - Note any UI lag or freezing

4. **Measure Completion Time**
   - Note completion time when toast shows "Transcription complete"
   - **Target**: <3 minutes (180 seconds) excluding model download
   - **Acceptable**: 2-3x realtime (5-10 minutes on slower hardware)

5. **Verify Quality**
   - Review transcript for accuracy
   - **Expected**: 90%+ word accuracy
   - **Expected**: Proper sentence segmentation
   - **Expected**: Timestamps accurate (±500ms)

6. **Check Storage**
   - Open Storage Usage Indicator
   - **Expected**: Transcript uses <2MB storage
   - **Expected**: Total storage <10% of 10MB limit

### Success Criteria
- ✅ Transcription completes in <3 minutes (modern hardware)
- ✅ UI remains responsive throughout
- ✅ Accuracy ≥90% on clear speech
- ✅ No browser crashes or memory leaks
- ✅ Storage usage reasonable (<2MB for 10-min transcript)

### Performance Targets by Hardware

| Hardware Class | Expected Time | Status |
|----------------|---------------|--------|
| Desktop (8+ cores, GPU) | 1-2 minutes | Excellent |
| Laptop (4+ cores) | 2-3 minutes | Target |
| Budget laptop (2 cores) | 5-10 minutes | Acceptable |
| Mobile/tablet | Not recommended | N/A |

---

## Test Execution Checklist

### Environment Setup
- [ ] Browser: Chrome 120+ or Edge 120+
- [ ] HTTPS enabled (or localhost)
- [ ] Cross-origin isolation headers configured
- [ ] Microphone/camera access granted
- [ ] ~100MB free disk space
- [ ] Stable internet connection

### Manual Testing Session

**Tester**: _______________
**Date**: _______________
**Browser**: _______________ (version: _____)
**OS**: _______________
**Hardware**: _______________

| Test | Status | Notes | Duration | Issues |
|------|--------|-------|----------|--------|
| T144: Record → Transcribe → Search → Export SRT | ⬜ | | | |
| T145: Silence Detection & Removal | ⬜ | | | |
| T146: Background Blur | ⬜ | | | |
| T147: Caption Burn-In | ⬜ | | | |
| T148: Concurrent AI Operations | ⬜ | | | |
| T149: 10-Minute Performance | ⬜ | | | |

### Issue Reporting Template

```markdown
**Test**: T1XX - Test Name
**Status**: ❌ Failed
**Steps to Reproduce**:
1. ...
2. ...

**Expected**: ...
**Actual**: ...
**Browser Console Errors**: ...
**Screenshots**: ...
```

---

## Automated Testing (Future)

While full E2E testing requires browser APIs, consider:

1. **Unit Tests** (already implemented):
   - Transcript search algorithm
   - Silence detection logic
   - Caption generation

2. **Integration Tests** (partial automation possible):
   - Mock Web Worker for transcription service
   - Test storage service with fake localStorage
   - Test state management with mock AI results

3. **Visual Regression Tests**:
   - Screenshot comparison for caption styling
   - Background blur effect consistency

---

**Test Plan Version**: 1.0
**Last Updated**: 2026-01-02
**Next Review**: After user feedback from initial release
