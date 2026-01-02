# Research: React 19.2 + Vite Migration

**Date**: 2026-01-02
**Feature**: React 19.2 + Vite Migration
**Branch**: 001-react-vite-migration

## Research Questions

This document resolves technical unknowns identified in the Technical Context and Constitution Check.

---

## R1: Vite Configuration for COOP/COEP Headers

**Question**: How to configure Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers in Vite dev server and production builds for FFmpeg.wasm SharedArrayBuffer support?

**Decision**: Use `vite-plugin-headers` for dev server + platform-specific configuration for production

**Rationale**:
- Vite dev server requires headers plugin since it doesn't have built-in header configuration
- Production builds are static files - headers set by hosting platform (Netlify `_headers`, Vercel `vercel.json`, Cloudflare `_headers`)
- Consistent approach across dev and production environments
- FFmpeg.wasm requires these headers to use SharedArrayBuffer

**Implementation**:

### Dev Server (vite.config.ts)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

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
})
```

### Production (Static Hosting)

**Netlify** (`public/_headers`):
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

**Vercel** (`vercel.json`):
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

**Alternatives Considered**:
- vite-plugin-cross-origin-isolation: Less flexible, adds extra dependency
- Manual server configuration: Not portable across hosting platforms
- Service Worker approach: Adds complexity, requires HTTPS even in dev

---

## R2: TypeScript Path Alias Configuration

**Question**: How to migrate `@/*` path alias from tsconfig.json to work with Vite?

**Decision**: Configure both `tsconfig.json` and `vite.config.ts` with consistent path mappings

**Rationale**:
- TypeScript compiler needs paths in `tsconfig.json` for type checking
- Vite needs paths in `vite.config.ts` for module resolution during bundling
- Both configurations must match to avoid runtime vs compile-time discrepancies
- Using `path.resolve(__dirname, './src')` ensures absolute paths

**Implementation**:

### tsconfig.json
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### vite.config.ts
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Alternatives Considered**:
- vite-tsconfig-paths plugin: Automatically reads tsconfig paths but adds dependency and indirection
- Relative imports: Breaks existing code, doesn't solve the problem
- Move components to src/: Works but requires large refactor, chosen approach allows gradual migration

---

## R3: React 19.2 + Vite Plugin Selection

**Question**: Which Vite React plugin should be used for React 19.2 support and optimal performance?

**Decision**: Use `@vitejs/plugin-react-swc` (SWC-based)

**Rationale**:
- **SWC is faster** than Babel for TypeScript transpilation and JSX transformation
- React 19 support confirmed in @vitejs/plugin-react-swc@4.x
- Official Vite plugin with first-class React support
- Fast Refresh (HMR) works out of the box
- No Babel configuration needed - reduces complexity
- Meets <2s HMR requirement (SC-002)

**Implementation**:

```bash
bun add -D vite @vitejs/plugin-react-swc
```

```typescript
// vite.config.ts
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
})
```

**Alternatives Considered**:
- `@vitejs/plugin-react` (Babel-based): Slower, requires Babel config for advanced features
- `@vitejs/plugin-react-refresh`: Deprecated, superseded by plugin-react
- Custom esbuild configuration: More control but higher complexity, not needed for this project

---

## R4: Tailwind CSS 4.x with Vite

**Question**: How to configure Tailwind CSS 4.x (currently using @tailwindcss/postcss) to work with Vite?

**Decision**: Use Tailwind CSS 4.x with Vite's PostCSS integration (built-in)

**Rationale**:
- Tailwind 4.x uses CSS-first configuration (no tailwind.config.js)
- Vite has native PostCSS support - automatically processes CSS files
- @tailwindcss/postcss plugin already in use - no breaking changes
- Configuration migrates from Next.js postcss.config.mjs directly
- Performance: Tailwind v4 is faster than v3

**Implementation**:

### postcss.config.mjs (existing - no changes needed)
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

### src/styles/globals.css
```css
@import "tailwindcss";
/* Custom utilities and styles */
```

### src/main.tsx
```typescript
import './styles/globals.css'
```

**Alternatives Considered**:
- Downgrade to Tailwind v3: Loses performance improvements, unnecessary backwards step
- UnoCSS: Different API, requires rewriting all Tailwind classes
- vanilla-extract: Requires refactoring all styles to TypeScript

---

## R5: HTTPS Dev Server for WebRTC Testing

**Question**: How to enable HTTPS in Vite dev server for testing camera, microphone, and screen capture features?

**Decision**: Use Vite's built-in `server.https` option with self-signed certificates

**Rationale**:
- WebRTC APIs (getUserMedia, getDisplayMedia) require HTTPS or localhost
- Vite supports HTTPS via `server.https: true` (auto-generates certificates)
- Simpler than external reverse proxy (nginx, Caddy)
- Works across platforms (Linux, macOS, Windows)
- Meets FR-011 requirement

**Implementation**:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    https: true, // Auto-generates self-signed cert
    port: 3000,
  },
})
```

For production-grade certificates (optional):
```typescript
import fs from 'fs'

export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync('path/to/key.pem'),
      cert: fs.readFileSync('path/to/cert.pem'),
    },
  },
})
```

**Alternatives Considered**:
- mkcert + manual cert generation: Extra step for developers, more complex setup
- ngrok/localhost.run: Requires external service, adds latency
- Disable HTTPS: Breaks WebRTC features, not acceptable

---

## R6: ESLint Configuration Migration

**Question**: How to migrate Next.js ESLint config to work with Vite?

**Decision**: Keep existing ESLint config, remove Next.js plugin, add Vite-specific rules if needed

**Rationale**:
- Current config uses `eslint-config-next` which includes React rules
- Remove Next.js-specific rules (no pages/, no app router)
- Core TypeScript/React rules remain valid
- @typescript-eslint and eslint-plugin-react still apply
- Maintain strict mode linting (no any, no ts-ignore)

**Implementation**:

### eslint.config.mjs (update)
```javascript
import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      'react': react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...typescript.configs.strict.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
    },
  },
]
```

**Alternatives Considered**:
- Keep eslint-config-next: Includes Next.js-specific rules that will trigger false positives
- Disable ESLint: Violates Principle II (Type Safety First)
- Use @antfu/eslint-config: Different philosophy, requires adapting team conventions

---

## R7: HTML Entry Point Structure

**Question**: How to structure index.html as Vite's entry point, migrating from Next.js app routing?

**Decision**: Create minimal index.html with script tag pointing to src/main.tsx, migrate metadata from layout.tsx

**Rationale**:
- Vite requires HTML entry point (Next.js auto-generates it)
- Keep HTML minimal - most structure in React components
- Metadata (title, description, OG tags) moves to react-helmet-async or index.html
- Favicon and static assets referenced from public/

**Implementation**:

### index.html (root)
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Browser-based screen recording and editing" />
    <title>Poor Man's Loom</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### src/main.tsx (new)
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### src/App.tsx (migrated from app/layout.tsx + app/page.tsx)
```typescript
// Consolidates layout and page components
```

**Alternatives Considered**:
- Multiple HTML files: Not needed for SPA
- Template engine (EJS, Pug): Adds complexity, HTML is simple enough
- Dynamic metadata: Use react-helmet-async if needed later

---

## R8: Dependency Package Migration

**Question**: Which packages need to be replaced, removed, or updated during migration?

**Decision**: Replace Next.js packages with Vite equivalents, remove Vercel Analytics, update React to 19.2

**Rationale**:
- Clean removal of Next.js dependencies
- Vercel Analytics removal per clarification (Session 2026-01-02)
- Maintain all functional dependencies (FFmpeg.wasm, Radix UI, Tailwind, etc.)
- Use latest stable versions for new tooling

**Packages to Remove**:
```json
{
  "next": "^16.1.1",
  "eslint-config-next": "16.1.1",
  "@vercel/analytics": "^1.5.0"
}
```

**Packages to Add**:
```json
{
  "vite": "^6.0.0",
  "@vitejs/plugin-react-swc": "^4.0.0"
}
```

**Packages to Update**:
```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0"
}
```

**Packages to Keep** (no changes):
```json
{
  "@ffmpeg/ffmpeg": "^0.12.15",
  "@ffmpeg/util": "^0.12.2",
  "@radix-ui/*": "existing versions",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.488.0",
  "react-webcam": "^7.2.0",
  "sonner": "^2.0.3",
  "tailwind-merge": "^3.2.0",
  "tw-animate-css": "^1.2.5",
  "@tailwindcss/postcss": "^4",
  "tailwindcss": "^4",
  "typescript": "^5"
}
```

**Implementation**:
```bash
# Remove
bun remove next eslint-config-next @vercel/analytics

# Add
bun add -D vite @vitejs/plugin-react-swc

# Update
bun add react@^19.2.0 react-dom@^19.2.0
```

**Alternatives Considered**:
- Keep Next.js as dependency: Conflicts with Vite, unnecessary bloat
- Gradual migration: Complexity of dual build systems not worth it (per clarification)

---

## Summary

All technical unknowns resolved:

1. ✅ COOP/COEP headers: Vite middleware + platform-specific config
2. ✅ Path aliases: Dual configuration in tsconfig.json + vite.config.ts
3. ✅ React plugin: @vitejs/plugin-react-swc for performance
4. ✅ Tailwind CSS 4: PostCSS integration (no changes needed)
5. ✅ HTTPS dev server: Built-in Vite server.https option
6. ✅ ESLint: Remove Next.js plugin, keep strict TypeScript rules
7. ✅ HTML entry: Minimal index.html + src/main.tsx pattern
8. ✅ Dependencies: Clean Next.js removal, Vite addition, React 19.2 update

All decisions maintain constitutional compliance and support functional requirements (FR-001 through FR-015).
