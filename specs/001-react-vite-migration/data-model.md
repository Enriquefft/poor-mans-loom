# Data Model: React 19.2 + Vite Migration

**Date**: 2026-01-02
**Feature**: React 19.2 + Vite Migration
**Branch**: 001-react-vite-migration

## Overview

This migration is a build tooling change with no runtime data model changes. The application's existing client-side data structures remain unchanged. This document describes the configuration entities that will be migrated.

---

## Configuration Entities

### Build Configuration

Represents Vite build and dev server configuration.

**File**: `vite.config.ts`

**Attributes**:

| Attribute | Type | Description | Validation |
|-----------|------|-------------|------------|
| plugins | Plugin[] | Array of Vite plugins (react-swc, headers) | Required, non-empty |
| resolve.alias | Record<string, string> | Path aliases (@/ mapping) | Required, must include '@' |
| server.https | boolean \| HttpsOptions | HTTPS configuration for dev server | Required true for WebRTC |
| server.port | number | Dev server port | Optional, default 3000 |
| build.outDir | string | Production build output directory | Optional, default 'dist' |
| build.sourcemap | boolean | Generate source maps | Optional, default false (prod) |

**Example**:
```typescript
{
  plugins: [react(), headersPlugin()],
  resolve: {
    alias: { '@': '/absolute/path/to/src' }
  },
  server: {
    https: true,
    port: 3000
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
}
```

**Relationships**:
- References: `package.json` (dependencies for plugins)
- Consumed by: Vite dev server and build process

**State Transitions**: None (static configuration)

---

### Module Resolution Configuration

Represents TypeScript and Vite path alias configuration.

**Files**: `tsconfig.json`, `vite.config.ts`

**Attributes**:

| Attribute | Type | Description | Validation |
|-----------|------|-------------|------------|
| baseUrl | string | Base path for module resolution | Required, typically "." |
| paths | Record<string, string[]> | Path alias mappings | Required, must include "@/*" |
| compilerOptions.strict | boolean | TypeScript strict mode | Required true (Principle II) |
| include | string[] | Files to include in compilation | Required, must include src/** |

**Consistency Rule**: `tsconfig.json` paths MUST match `vite.config.ts` resolve.alias to ensure compile-time and runtime resolution agree.

**Example**:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "strict": true
  },
  "include": ["src/**/*"]
}
```

**Relationships**:
- Consumed by: TypeScript compiler (tsc) and Vite module resolver
- References: Source files in src/

**State Transitions**: None (static configuration)

---

### Package Dependencies

Represents npm package dependencies for the project.

**File**: `package.json`

**Attributes**:

| Attribute | Type | Description | Validation |
|-----------|------|-------------|------------|
| dependencies | Record<string, string> | Runtime dependencies | Must NOT include next, @vercel/analytics |
| devDependencies | Record<string, string> | Build-time dependencies | Must include vite, @vitejs/plugin-react-swc |
| scripts.dev | string | Dev server command | Must use vite (not next dev) |
| scripts.build | string | Production build command | Must use vite build (not next build) |
| scripts.preview | string | Preview prod build | Should use vite preview |

**Migration Invariants**:
- React version: MUST be 19.2.x (FR-009)
- FFmpeg.wasm: MUST be preserved at 0.12.x (FR-003)
- Tailwind CSS: MUST be 4.x (FR-007)
- TypeScript: MUST be 5.x (FR-004)

**Example**:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@ffmpeg/ffmpeg": "^0.12.15",
    "/* other runtime deps */"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react-swc": "^4.0.0",
    "typescript": "^5"
  }
}
```

**Relationships**:
- References: All project source files
- Consumed by: Bun/npm package manager, Vite build process

**State Transitions**: None (static configuration, changed during migration)

---

### Cross-Origin Headers Configuration

Represents COOP/COEP headers for SharedArrayBuffer support.

**Files**: `vite.config.ts` (dev), `public/_headers` or `vercel.json` (prod)

**Attributes**:

| Attribute | Type | Description | Validation |
|-----------|------|-------------|------------|
| Cross-Origin-Opener-Policy | string | COOP header value | Required, must be "same-origin" |
| Cross-Origin-Embedder-Policy | string | COEP header value | Required, must be "require-corp" |
| scope | string | Paths covered by headers | Required, typically "/*" or "/(.*)" |

**Consistency Rule**: Headers MUST be identical in dev (Vite middleware) and production (platform config) to ensure FFmpeg.wasm works in both environments.

**Example (Netlify)**:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

**Example (Vercel)**:
```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
      { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
    ]
  }]
}
```

**Relationships**:
- Consumed by: Browser (enables SharedArrayBuffer)
- Required by: FFmpeg.wasm (video export functionality)

**State Transitions**: None (static configuration)

---

### HTML Entry Point

Represents the root HTML file for the SPA.

**File**: `index.html`

**Attributes**:

| Attribute | Type | Description | Validation |
|-----------|------|-------------|------------|
| root div | HTMLElement | React mount point | Required, id="root" |
| module script | HTMLScriptElement | Entry point reference | Required, src="/src/main.tsx" type="module" |
| meta viewport | HTMLMetaElement | Mobile viewport config | Required for responsive design |
| title | string | Page title | Required, descriptive text |
| favicon | string | Icon reference | Optional, should point to /favicon.ico |

**Example**:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Poor Man's Loom</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Relationships**:
- References: `src/main.tsx` (application entry point)
- References: `public/favicon.ico` (static asset)

**State Transitions**: None (static file)

---

## Validation Rules

### Cross-Configuration Consistency

1. **Path Aliases**: `tsconfig.json` paths MUST match `vite.config.ts` resolve.alias
2. **Headers**: Dev server headers MUST match production platform headers
3. **React Version**: `package.json` react version MUST be compatible with vite plugin version
4. **TypeScript Strict**: `tsconfig.json` strict mode MUST be enabled (Principle II)

### Migration Completeness Checks

Pre-deployment validation:

| Check | Validation | Error if Violated |
|-------|------------|-------------------|
| Next.js removed | `package.json` dependencies MUST NOT include "next" | Build will fail with conflicting dependencies |
| Vercel Analytics removed | No imports from "@vercel/analytics" in codebase | Runtime error if imported |
| HTTPS enabled | `vite.config.ts` server.https MUST be true | WebRTC features will fail (getUserMedia requires HTTPS) |
| Headers configured | COOP/COEP headers present in dev config | FFmpeg.wasm will fail with SharedArrayBuffer error |
| Path alias works | `@/` imports resolve correctly | TypeScript and runtime module resolution errors |
| Entry point exists | `index.html` references valid `/src/main.tsx` | Blank page, script 404 error |

---

## Runtime Data Model (Unchanged)

The following existing data models are NOT modified by this migration:

- **Recording State** (`lib/recorder/`): MediaStream management, recording progress
- **Editor State** (`lib/editor/timeline.ts`): Timeline segments, playback state
- **App State** (`app/page.tsx` → `src/App.tsx`): Mode switching (recording/editing)

These remain immutable per Principle IV and maintain existing type-safe error handling per Principle VI.

---

## Summary

This migration involves configuration entities only. No runtime data structures change. Key validation points:

1. ✅ Path alias consistency across tsconfig.json and vite.config.ts
2. ✅ Header configuration in both dev and production
3. ✅ Package.json script updates (dev, build, preview)
4. ✅ HTML entry point with correct module script reference
5. ✅ TypeScript strict mode enforcement maintained
