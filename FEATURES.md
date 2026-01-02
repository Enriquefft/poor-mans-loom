# Feature Comparison: Poor Man's Loom vs Industry Leaders

This document compares Poor Man's Loom with industry leaders [Loom](https://www.loom.com/) and [Screen.studio](https://screen.studio/), focusing exclusively on features that can be implemented while adhering to our **Client-Side First** constitutional principle.

> **Note**: Only features that can be fully implemented in the browser without backend dependencies are listed. Features requiring cloud services, backend processing, or server-side AI are excluded.

---

## 🎬 Recording Features

| Feature                    | Poor Man's Loom                    | Loom        | Screen.studio      | Client-Side Viable?                           |
| -------------------------- | ---------------------------------- | ----------- | ------------------ | --------------------------------------------- |
| **Screen Recording**       | ✅ Full screen, window, or tab     | ✅ Yes      | ✅ Yes             | ✅ Yes (getDisplayMedia API)                  |
| **Camera Overlay**         | ✅ Customizable position, size & shape | ✅ Yes  | ✅ Yes             | ✅ Yes (getUserMedia API)                     |
| **Camera-Only Recording**  | ❌ No                              | ✅ Yes      | ✅ Yes             | ✅ Yes (getUserMedia API)                     |
| **Screen-Only Recording**  | ✅ Yes                             | ✅ Yes      | ✅ Yes             | ✅ Yes                                        |
| **Microphone Audio**       | ✅ Yes                             | ✅ Yes      | ✅ Yes             | ✅ Yes (getUserMedia API)                     |
| **System Audio**           | ✅ Yes                             | ✅ Yes      | ✅ Yes             | ✅ Yes (getDisplayMedia with audio)           |
| **Pause/Resume**           | ✅ Yes                             | ✅ Yes      | ❌ No              | ✅ Yes (MediaRecorder API)                    |
| **Draggable Camera**       | ✅ Yes                             | ❌ No       | ❌ No              | ✅ Yes (Canvas API)                           |
| **Camera Shape Toggle**    | ✅ Circle & Rectangle              | ❌ No       | ❌ No              | ✅ Yes (Canvas API)                           |
| **Camera Flip (Mirror)**   | ✅ Yes (hardcoded)                 | ❌ No       | ❌ No              | ✅ Yes (Canvas transform)                     |
| **HD/4K Recording**        | ✅ Browser-dependent               | ✅ Up to 4K | ✅ Up to 4K 60fps  | ✅ Yes (MediaRecorder quality)                |
| **Background Blur**        | ❌ No                              | ✅ Yes      | ❌ No              | ⚠️ Partial (Browser-native only, limited support) |
| **Background Replacement** | ❌ No                              | ✅ Yes      | ❌ No              | ⚠️ Partial (Requires ML models, complex)     |
| **Device Selection**       | ⚠️ Partial (mic only)              | ✅ Full     | ✅ Full            | ✅ Yes (enumerateDevices API)                 |

### 📊 Recording Feature Summary
- **Poor Man's Loom**: 9/14 ✅ (64%)
- **Achievable with Client-Side**: 12/14 ✅ (86%)

---

## ✂️ Editing Features

| Feature                   | Poor Man's Loom | Loom           | Screen.studio      | Client-Side Viable?                                 |
| ------------------------- | --------------- | -------------- | ------------------ | --------------------------------------------------- |
| **Trim Start/End**        | ✅ Yes          | ✅ Yes         | ✅ Yes             | ✅ Yes (FFmpeg.wasm)                                |
| **Split Segments**        | ✅ Yes          | ❌ No          | ✅ Yes             | ✅ Yes (Timeline logic)                             |
| **Delete Segments**       | ✅ Yes          | ❌ No          | ✅ Yes             | ✅ Yes (Timeline logic)                             |
| **Restore Deleted**       | ✅ Yes          | ❌ No          | ❌ No              | ✅ Yes (Immutable state)                            |
| **Video Preview**         | ✅ Yes          | ✅ Yes         | ✅ Yes             | ✅ Yes (HTML5 video)                                |
| **Timeline Scrubbing**    | ✅ Yes          | ✅ Yes         | ✅ Yes             | ✅ Yes (Video seek API)                             |
| **Remove Filler Words**   | ❌ No           | ✅ AI-powered  | ❌ No              | ❌ No (Requires server-side AI)                     |
| **Auto Remove Silence**   | ❌ No           | ✅ AI-powered  | ❌ No              | ⚠️ Partial (Client-side audio analysis possible but intensive) |
| **Text Overlays**         | ❌ No           | ✅ Yes         | ✅ Yes             | ✅ Yes (Canvas/FFmpeg)                              |
| **Arrows/Shapes**         | ❌ No           | ✅ Yes         | ✅ Yes             | ✅ Yes (Canvas/FFmpeg overlay filters)              |
| **Speed Up/Slow Down**    | ❌ No           | ❌ No          | ✅ Yes             | ✅ Yes (FFmpeg setpts filter)                       |
| **Automatic Zoom**        | ❌ No           | ❌ No          | ✅ AI-powered      | ⚠️ Partial (Manual zoom: Yes, Auto-detect: Requires ML) |
| **Smooth Cursor**         | ❌ No           | ❌ No          | ✅ Yes             | ⚠️ Partial (Requires cursor tracking + motion smoothing) |
| **Cursor Size Change**    | ❌ No           | ❌ No          | ✅ Post-recording  | ⚠️ Partial (Requires cursor extraction/replacement) |
| **Hide Static Cursor**    | ❌ No           | ❌ No          | ✅ Auto            | ⚠️ Partial (Requires motion detection)              |

### 📊 Editing Feature Summary
- **Poor Man's Loom**: 6/15 ✅ (40%)
- **Achievable with Client-Side**: 11/15 ✅ (73%)

---

## 📤 Export Features

| Feature                        | Poor Man's Loom             | Loom           | Screen.studio   | Client-Side Viable?                   |
| ------------------------------ | --------------------------- | -------------- | --------------- | ------------------------------------- |
| **WebM Export**                | ✅ Yes (VP9/Opus)           | ✅ Yes         | ✅ Yes          | ✅ Yes (Native browser output)        |
| **MP4 Export**                 | ✅ Yes (H.264/AAC)          | ✅ Yes         | ✅ Yes          | ✅ Yes (FFmpeg.wasm)                  |
| **Quality Presets**            | ✅ Low/Medium/High CRF      | ✅ Yes         | ✅ Yes          | ✅ Yes (FFmpeg encoding options)      |
| **GIF Export**                 | ❌ No                       | ❌ No          | ✅ Optimized    | ✅ Yes (FFmpeg palette generation)    |
| **Progress Indicator**         | ✅ Yes                      | ✅ Yes         | ✅ Yes          | ✅ Yes (FFmpeg progress events)       |
| **Fast Export**                | ✅ Stream copy for trims    | ❌ N/A         | ❌ N/A          | ✅ Yes (FFmpeg -c copy)               |
| **Direct Download**            | ✅ Yes                      | ✅ Yes         | ✅ Yes          | ✅ Yes (Blob download)                |
| **Quick Download (No Edit)**   | ✅ Yes                      | ❌ N/A         | ❌ N/A          | ✅ Yes (Skip FFmpeg)                  |
| **Cloud Upload**               | ❌ No                       | ✅ Auto        | ❌ No           | ❌ No (Requires backend)              |
| **Shareable Links**            | ❌ No                       | ✅ Auto-generated | ✅ Yes       | ❌ No (Requires hosting)              |
| **Auto-Optimized for Social**  | ❌ No                       | ❌ No          | ✅ Yes          | ✅ Yes (FFmpeg scale/crop filters)    |

### 📊 Export Feature Summary
- **Poor Man's Loom**: 7/11 ✅ (64%)
- **Achievable with Client-Side**: 9/11 ✅ (82%)

---

## 🎨 User Experience Features

| Feature                  | Poor Man's Loom        | Loom                    | Screen.studio   | Client-Side Viable?                    |
| ------------------------ | ---------------------- | ----------------------- | --------------- | -------------------------------------- |
| **No Sign-up Required**  | ✅ Yes                 | ❌ No                   | ❌ No           | ✅ Yes                                 |
| **100% Offline**         | ✅ Yes (after load)    | ❌ No                   | ❌ No           | ✅ Yes                                 |
| **No Watermarks**        | ✅ Yes                 | ⚠️ Free plan has        | ❌ Paid only    | ✅ Yes                                 |
| **Unlimited Recording**  | ✅ Yes                 | ⚠️ 25 videos (free)     | ❌ Paid only    | ✅ Yes                                 |
| **Cross-Platform**       | ✅ Any modern browser  | ⚠️ App required         | ⚠️ macOS only   | ✅ Yes (Web-based)                     |
| **Mobile Support**       | ⚠️ Limited             | ✅ iOS/Android apps     | ❌ No           | ⚠️ Partial (Browser APIs limited on mobile) |
| **Browser Extension**    | ❌ No                  | ✅ Chrome               | ❌ No           | ✅ Yes (Manifest V3)                   |
| **Hotkeys**              | ❌ No                  | ❌ No                   | ❌ No           | ✅ Yes (Keyboard API)                  |
| **Custom Shortcuts**     | ❌ No                  | ❌ No                   | ❌ No           | ✅ Yes (LocalStorage persistence)      |

### 📊 UX Feature Summary
- **Poor Man's Loom**: 5/9 ✅ (56%)
- **Achievable with Client-Side**: 8/9 ✅ (89%)

---

## 🚫 Features NOT Viable Client-Side

The following features require backend services and **cannot** be implemented while adhering to our Client-Side First principle:

### AI-Powered Features
- ❌ **Auto Titles** (Loom) - Requires server-side AI/LLM
- ❌ **Auto Chapters** (Loom) - Requires server-side AI/LLM
- ❌ **Auto Summaries** (Loom) - Requires server-side AI/LLM
- ❌ **Auto CTA Links** (Loom) - Requires server-side AI/LLM
- ❌ **Filler Word Removal** (Loom) - Requires server-side speech-to-text AI
- ❌ **Auto Transcriptions** (Loom) - Requires server-side speech-to-text AI
- ❌ **50+ Language Captions** (Loom) - Requires server-side AI
- ❌ **Meeting Notes/Action Items** (Loom) - Requires server-side AI

### Collaboration Features
- ❌ **Timestamped Comments** (Loom) - Requires backend database
- ❌ **Emoji Reactions** (Loom) - Requires backend real-time sync
- ❌ **Team Member Tagging** (Loom) - Requires backend user management
- ❌ **Viewer Analytics** (Loom) - Requires backend tracking
- ❌ **Engagement Tracking** (Loom) - Requires backend analytics

### Sharing/Storage Features
- ❌ **Auto-Generated Share Links** (Loom/Screen.studio) - Requires hosting backend
- ❌ **Cloud Storage** (Loom) - Requires backend storage
- ❌ **Workspace Organization** (Loom) - Requires backend database
- ❌ **Password Protection** (Loom) - Requires backend authentication
- ❌ **Domain Management** (Loom) - Requires backend access control

### Integration Features
- ❌ **Slack/Jira/GitHub Integration** (Loom) - Requires backend OAuth
- ❌ **Email Sharing** (Loom) - Requires backend email service
- ❌ **Embed Codes** (Loom) - Requires hosted player

---

## 📈 Overall Comparison

### Total Features by Category

| Category       | Current         | Client-Side Possible | Backend Required |
| -------------- | --------------- | -------------------- | ---------------- |
| **Recording**  | 9/14 (64%)      | 12/14 (86%)          | 2/14 (14%)       |
| **Editing**    | 6/15 (40%)      | 11/15 (73%)          | 4/15 (27%)       |
| **Export**     | 7/11 (64%)      | 9/11 (82%)           | 2/11 (18%)       |
| **UX**         | 5/9 (56%)       | 8/9 (89%)            | 1/9 (11%)        |
| **Total**      | **27/49 (55%)** | **40/49 (82%)**      | **9/49 (18%)**   |

### Unique Competitive Advantages

**Poor Man's Loom Wins:**
1. ✅ **Draggable Camera** - Real-time repositioning during preview
2. ✅ **Camera Shape Toggle** - Circle/Rectangle switching
3. ✅ **Restore Deleted Segments** - Undo deletes with immutable state
4. ✅ **No Sign-up/No Limits** - Truly free and private
5. ✅ **100% Offline** - Works without internet (after initial load)
6. ✅ **Cross-Platform** - Any device with modern browser
7. ✅ **Fast Export Optimization** - Stream copy for unedited segments

**Loom Wins (Backend-Powered):**
1. ✅ AI-powered editing (titles, chapters, summaries, filler removal)
2. ✅ Real-time collaboration (comments, reactions, team features)
3. ✅ Auto-generated shareable links
4. ✅ Viewer analytics and engagement tracking
5. ✅ Integration ecosystem (Slack, Jira, GitHub, etc.)
6. ✅ 50+ language transcription

**Screen.studio Wins (macOS Native + Smart Editing):**
1. ✅ Automatic zoom on cursor actions
2. ✅ Smooth cursor movement algorithm
3. ✅ Cursor customization post-recording
4. ✅ Auto-hide static cursor
5. ✅ Up to 4K 60fps recording
6. ✅ iOS/iPad device recording via USB
7. ✅ Social media auto-optimization

---

## 🎯 Recommended Roadmap

Based on this analysis, here are the highest-impact client-side features to implement next:

### High Priority (Quick Wins)
1. **Camera-Only Recording Mode** - Simple toggle, high user value
2. **Device Selection UI** - Already supported in API, needs UI
3. **GIF Export** - FFmpeg.wasm already loaded, minimal effort
4. **Speed Control** - FFmpeg setpts filter, straightforward
5. **Text Overlays** - Canvas API or FFmpeg drawtext filter

### Medium Priority (Moderate Effort)
6. **Shape/Arrow Annotations** - Canvas drawing tools or FFmpeg overlay
7. **Browser Extension** - Manifest V3, better UX than web app
8. **Keyboard Shortcuts** - Keyboard API + LocalStorage
9. **Background Blur** - Use native browser API where supported
10. **Social Media Presets** - FFmpeg scale/crop/format templates

### Low Priority (Complex, High Effort)
11. **Cursor Smoothing** - Requires cursor tracking + motion interpolation
12. **Cursor Size/Hide** - Requires cursor extraction pipeline
13. **Automatic Zoom** - Requires click detection + viewport transforms
14. **Auto Silence Detection** - Web Audio API analysis + FFmpeg trimming

### Not Recommended (Against Constitution)
- ❌ Any AI transcription/summarization features
- ❌ Cloud upload/sharing features
- ❌ Collaboration/commenting features
- ❌ Analytics/tracking features

---

## 📚 Sources

- [Loom Screen Recorder](https://www.loom.com/screen-recorder)
- [Loom Reviews 2025 - G2](https://www.g2.com/products/atlassian-loom/reviews)
- [Screen Studio](https://screen.studio/)
- [Screen Recorder with Auto Zoom: Top 5 Picks](https://focusee.imobie.com/record-screen/screen-recorder-with-auto-zoom.htm)
- [ScreenStudio - ContentCreators.com](https://contentcreators.com/tools/screenstudio)

---

**Last Updated**: 2026-01-02
**Maintainer**: Poor Man's Loom Project
