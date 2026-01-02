# Quickstart: React 19.2 + Vite Migration

**Feature**: React 19.2 + Vite Migration
**Branch**: 001-react-vite-migration
**Date**: 2026-01-02

## Overview

This quickstart guides developers through verifying and using the migrated Vite-based build system. For implementation details, see [plan.md](plan.md).

---

## Prerequisites

- Bun runtime installed (or npm/yarn/pnpm)
- Modern browser with WebRTC support (Chrome/Edge 90+, Firefox 88+, Safari 15+)
- HTTPS certificate acceptance (for self-signed cert in dev)

---

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

**Expected output**: Vite, React 19.2, and all dependencies installed without Next.js or Vercel Analytics.

**Verify**:
```bash
bun list | grep -E "(vite|next|@vercel/analytics)"
```

Should show:
- ✅ `vite@6.x.x`
- ❌ No `next` package
- ❌ No `@vercel/analytics` package

---

### 2. Start Development Server

```bash
bun run dev
```

**Expected output**:
```
  VITE v6.0.0  ready in 1234 ms

  ➜  Local:   https://localhost:3000/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**Verify**:
- Server starts in <5 seconds (SC-001)
- HTTPS enabled (required for WebRTC)
- Port 3000 default (configurable in vite.config.ts)

**Browser Warning**: Accept self-signed certificate when prompted. This is expected and safe for local development.

---

### 3. Verify Application Loads

Open `https://localhost:3000` in your browser.

**Expected behavior**:
- ✅ Application UI renders correctly
- ✅ No console errors
- ✅ Tailwind CSS styles applied
- ✅ Lucide icons visible

**Check DevTools Network tab**:
- Response headers include:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`

---

### 4. Test Hot Module Replacement (HMR)

1. Open `src/App.tsx` in your editor
2. Change some text (e.g., heading content)
3. Save the file

**Expected behavior**:
- Changes appear in browser within 2 seconds (SC-002)
- No full page reload
- React component state preserved

---

### 5. Test Core Features

#### Screen Recording
1. Click "Start Recording"
2. Select screen/window to share
3. Record for a few seconds
4. Click "Stop Recording"

**Expected**:
- ✅ Recording starts successfully
- ✅ Preview shows captured content
- ✅ Recording saves as WebM blob

#### Camera Capture (if available)
1. Enable camera overlay option
2. Grant camera permissions
3. Verify camera feed appears

**Expected**:
- ✅ Camera stream displays
- ✅ Camera position/size adjustable

#### Video Export
1. Record a short clip
2. Switch to editor mode
3. Click "Export"
4. Wait for FFmpeg.wasm processing

**Expected**:
- ✅ FFmpeg.wasm loads without SharedArrayBuffer errors
- ✅ Export completes successfully
- ✅ Output file downloads

---

### 6. Build for Production

```bash
bun run build
```

**Expected output**:
```
vite v6.0.0 building for production...
✓ 123 modules transformed.
dist/index.html                   1.23 kB │ gzip:  0.56 kB
dist/assets/index-abc123.js     234.56 kB │ gzip: 78.90 kB
✓ built in 5.67s
```

**Verify**:
- Build completes in <30 seconds (SC-003)
- Bundle size within 10% of previous Next.js build (SC-006)
- `dist/` directory created with optimized assets

---

### 7. Preview Production Build

```bash
bun run preview
```

**Expected output**:
```
  ➜  Local:   http://localhost:4173/
  ➜  Network: use --host to expose
```

**Verify**:
- Production build runs correctly
- All features work identically to dev mode (SC-004)
- No console errors (SC-008)

---

## Common Issues & Solutions

### Issue: "SharedArrayBuffer is not defined"

**Symptom**: Video export fails with SharedArrayBuffer error.

**Cause**: COOP/COEP headers not configured.

**Solution**:
1. Check `vite.config.ts` has headers middleware
2. Verify browser DevTools Network tab shows correct headers
3. Restart dev server if headers were just added

---

### Issue: Module not found "@/components/..."

**Symptom**: Import errors for `@/` path alias.

**Cause**: Path alias not configured in vite.config.ts or tsconfig.json.

**Solution**:
```typescript
// vite.config.ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

Restart dev server and TypeScript server (VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server").

---

### Issue: "getUserMedia is not a function"

**Symptom**: Camera/microphone access fails.

**Cause**: HTTPS not enabled or browser doesn't support WebRTC.

**Solution**:
1. Verify `vite.config.ts` has `server.https: true`
2. Accept self-signed certificate in browser
3. Use modern browser (Chrome/Edge/Firefox/Safari latest)

---

### Issue: HMR takes >2 seconds

**Symptom**: Slow hot reload.

**Cause**: Large dependency tree or slow file system.

**Solution**:
1. Check if you're importing large unused libraries
2. Verify SWC plugin is installed (`@vitejs/plugin-react-swc`)
3. Exclude `node_modules` from file watcher (should be default)

---

### Issue: TypeScript errors in imports

**Symptom**: `Cannot find module 'react'` or similar.

**Cause**: Type definitions not installed or tsconfig misconfigured.

**Solution**:
```bash
bun add -D @types/react @types/react-dom
```

Check `tsconfig.json`:
```json
{
  "compilerOptions": {
    "types": ["vite/client"]
  }
}
```

---

## Configuration Reference

### vite.config.ts Essentials

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'configure-response-headers',
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
          next()
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    https: true,
    port: 3000,
  },
})
```

### package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src"
  }
}
```

---

## Performance Benchmarks

After successful migration, you should observe:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Dev server start | <5s | Time from `bun run dev` to "ready" message |
| HMR update | <2s | Time from file save to browser update |
| Production build | <30s | Time for `bun run build` to complete |
| Bundle size | ±10% of previous | Compare `dist/` size to previous `.next/` output |

**Measure commands**:
```bash
# Dev server start time
time bun run dev

# Build time
time bun run build

# Bundle size
du -sh dist/
```

---

## Next Steps

After verifying the quickstart:

1. **Review CLAUDE.md**: Updated development guidelines
2. **Check tasks.md**: Implementation checklist (generated by `/speckit.tasks`)
3. **Test all features**: Run through complete recording → editing → export workflow
4. **Deploy**: Configure production headers on your hosting platform (see research.md R1)

---

## Rollback (Emergency Only)

If critical issues arise:

```bash
# Checkout previous stable branch
git checkout main

# Reinstall dependencies
bun install

# Start Next.js version
bun run dev
```

**Note**: Per clarification (Session 2026-01-02), migration is one-step with comprehensive testing. Rollback should only be needed for unforeseen critical issues discovered in production.

---

## Support

- **Documentation**: See [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md)
- **Contracts**: JSON schemas in [contracts/](contracts/) directory
- **Issues**: Check edge cases in [spec.md](spec.md#edge-cases)
