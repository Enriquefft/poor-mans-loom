# Tasks: React 19.2 + Vite Migration

**Input**: Design documents from `/specs/001-react-vite-migration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Manual testing required for WebRTC features (browser permissions). No automated test tasks generated per specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency migration

- [ ] T001 Remove Next.js dependencies from package.json (next, eslint-config-next, @vercel/analytics)
- [ ] T002 [P] Add Vite dependencies to package.json (vite@^6.0.0, @vitejs/plugin-react-swc@^4.0.0)
- [ ] T003 [P] Update React to 19.2 in package.json (react@^19.2.0, react-dom@^19.2.0)
- [ ] T004 Install dependencies with `bun install`
- [ ] T005 Remove @vercel/analytics imports from all source files (search codebase for "@vercel/analytics")

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Vite configuration that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create src/ directory at repository root
- [ ] T007 Create src/styles/ directory for global CSS
- [ ] T008 [P] Create index.html at repository root with React mount point and module script reference to /src/main.tsx
- [ ] T009 [P] Create vite.config.ts with basic React plugin configuration (see research.md R3)
- [ ] T010 [P] Update tsconfig.json baseUrl and paths for @/* alias mapping to ./src/* (see research.md R2)
- [ ] T011 Add path alias to vite.config.ts resolve.alias mapping @ to ./src (see research.md R2)
- [ ] T012 Update package.json scripts: "dev": "vite", "build": "vite build", "preview": "vite preview"
- [ ] T013 [P] Move app/globals.css to src/styles/globals.css
- [ ] T014 [P] Update src/styles/globals.css to use @import "tailwindcss" instead of @tailwind directives
- [ ] T015 Create src/vite-env.d.ts with Vite type definitions reference

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Development Experience (Priority: P1) 🎯 MVP

**Goal**: Developers can run dev server, make code changes, and see HMR updates <2 seconds

**Independent Test**:
1. Run `bun run dev` - server starts in <5s at https://localhost:3000
2. Modify a component file - changes appear in browser within 2s
3. No console errors or warnings
4. Style changes apply instantly without losing component state

### Implementation for User Story 1

- [ ] T016 [US1] Create src/main.tsx entry point with ReactDOM.createRoot and StrictMode wrapper (see research.md R7)
- [ ] T017 [US1] Create src/App.tsx by consolidating app/layout.tsx and app/page.tsx into single root component
- [ ] T018 [US1] Import src/styles/globals.css in src/main.tsx
- [ ] T019 [US1] Update all component imports to use @/ path alias if currently using ../app or ../components
- [ ] T020 [US1] Configure vite.config.ts with server.https: true for WebRTC support (see research.md R5)
- [ ] T021 [US1] Configure vite.config.ts with server.port: 3000
- [ ] T022 [US1] Verify postcss.config.mjs works with Vite (should require no changes, see research.md R4)
- [ ] T023 [US1] Test dev server startup time (<5s target)
- [ ] T024 [US1] Test HMR by modifying component - verify <2s update time
- [ ] T025 [US1] Test style changes apply without component state loss
- [ ] T026 [US1] Verify no console errors in browser DevTools
- [ ] T027 [US1] Verify all existing features load correctly (recording UI, camera controls, editor)

**Checkpoint**: At this point, User Story 1 should be fully functional - dev server runs with fast HMR

---

## Phase 4: User Story 2 - Production Build Process (Priority: P2)

**Goal**: Production builds generate optimized bundles <30s, deployable to static hosting

**Independent Test**:
1. Run `bun run build` - completes in <30s
2. Run `bun run preview` - serves dist/ correctly
3. All features work identically to dev mode
4. Bundle size within 10% of previous Next.js build

### Implementation for User Story 2

- [ ] T028 [US2] Configure vite.config.ts build.outDir: 'dist'
- [ ] T029 [US2] Configure vite.config.ts build.minify: 'esbuild' for fast builds
- [ ] T030 [US2] Configure vite.config.ts build.sourcemap: false for production (smaller bundles)
- [ ] T031 [US2] Test production build with `bun run build` - verify <30s completion
- [ ] T032 [US2] Measure dist/ output size and compare to previous .next/ build (target: within 10%)
- [ ] T033 [US2] Test preview server with `bun run preview` - verify app loads correctly
- [ ] T034 [US2] Manual test: screen recording functionality works in preview build
- [ ] T035 [US2] Manual test: camera capture functionality works in preview build (requires HTTPS in preview if needed)
- [ ] T036 [US2] Manual test: video editing functionality works in preview build
- [ ] T037 [US2] Manual test: FFmpeg.wasm export functionality works in preview build
- [ ] T038 [US2] Verify no runtime errors in browser console when running preview build

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - dev + production builds functional

---

## Phase 5: User Story 3 - Cross-Origin Isolation Headers (Priority: P3)

**Goal**: COOP/COEP headers configured for FFmpeg.wasm SharedArrayBuffer support

**Independent Test**:
1. Open DevTools Network tab
2. Verify `Cross-Origin-Opener-Policy: same-origin` header present
3. Verify `Cross-Origin-Embedder-Policy: require-corp` header present
4. Export a video - FFmpeg.wasm initializes without SharedArrayBuffer errors
5. External resources (fonts, CDN assets) load without CORS errors

### Implementation for User Story 3

- [ ] T039 [US3] Add headers middleware plugin to vite.config.ts for dev server (see research.md R1)
- [ ] T040 [US3] Configure headers middleware to set Cross-Origin-Opener-Policy: same-origin
- [ ] T041 [US3] Configure headers middleware to set Cross-Origin-Embedder-Policy: require-corp
- [ ] T042 [US3] Create public/_headers file for Netlify deployment with COOP/COEP headers (see research.md R1)
- [ ] T043 [US3] Create vercel.json at repository root with COOP/COEP headers configuration (see research.md R1)
- [ ] T044 [US3] Test dev server headers in DevTools Network tab - verify both headers present
- [ ] T045 [US3] Manual test: record short video clip in dev server
- [ ] T046 [US3] Manual test: export video using FFmpeg.wasm - verify no SharedArrayBuffer errors
- [ ] T047 [US3] Manual test: verify external CDN resources (FFmpeg.wasm from unpkg.com) load successfully
- [ ] T048 [US3] Document deployment platform header configuration in README or deployment guide

**Checkpoint**: All user stories should now be independently functional - video export works with SharedArrayBuffer

---

## Phase 6: User Story 4 - Asset Handling (Priority: P3)

**Goal**: Static assets (images, fonts, SVG) load correctly in dev and production

**Independent Test**:
1. Inspect page - all images display correctly
2. Fonts load without fallback to system fonts
3. No 404 errors for assets in Network tab
4. Production build includes asset hashes for cache-busting

### Implementation for User Story 4

- [ ] T049 [US4] Move app/favicon.ico to public/favicon.ico (if not already there)
- [ ] T050 [US4] Verify all assets in public/ directory are preserved (file.svg, globe.svg, logo.svg, etc.)
- [ ] T051 [US4] Update index.html favicon reference to /favicon.ico (should work automatically with public/)
- [ ] T052 [US4] Verify image imports in components use correct paths (Vite handles /public automatically)
- [ ] T053 [US4] Test dev server - verify all images load correctly (inspect Network tab for 200 status)
- [ ] T054 [US4] Test dev server - verify custom fonts load (check Computed styles in DevTools)
- [ ] T055 [US4] Run production build and inspect dist/assets/ - verify hashed filenames (e.g., logo-abc123.svg)
- [ ] T056 [US4] Test preview server - verify all assets load with correct paths
- [ ] T057 [US4] Verify no 404 errors for assets in production preview

**Checkpoint**: All 4 user stories complete - full feature parity with Next.js version achieved

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup and final validation

- [ ] T058 [P] Update ESLint configuration - remove eslint-config-next, add TypeScript strict rules (see research.md R6)
- [ ] T059 [P] Verify ESLint runs with `bun run lint` - no errors from migration
- [ ] T060 [P] Remove next.config.ts file
- [ ] T061 [P] Remove next-env.d.ts file
- [ ] T062 [P] Move app/opengraph-image.tsx to public/ as static asset if still needed (or remove if Next.js-specific)
- [ ] T063 [P] Clean up app/ directory - remove or migrate remaining Next.js-specific files
- [ ] T064 Update CLAUDE.md with Vite-specific development notes (replace Next.js references)
- [ ] T065 Update README.md with new dev/build/preview commands
- [ ] T066 Run quickstart.md validation - follow all steps to verify migration success
- [ ] T067 Performance benchmark: measure dev server start time (target: <5s)
- [ ] T068 Performance benchmark: measure HMR update time (target: <2s)
- [ ] T069 Performance benchmark: measure production build time (target: <30s)
- [ ] T070 Bundle size validation: compare dist/ to previous build (target: within 10%)
- [ ] T071 Manual comprehensive test: complete recording → editing → export workflow end-to-end
- [ ] T072 Search codebase for any remaining Next.js imports or globals (e.g., `next/`, `useRouter`, etc.)
- [ ] T073 Verify TypeScript compilation with `tsc --noEmit` - no type errors
- [ ] T074 Create git commit with migration changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion - BLOCKS all user stories
- **User Stories (Phases 3-6)**: All depend on Foundational (Phase 2) completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P3)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1 - US1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2 - US2)**: Can start after Foundational - Depends on US1 for build configuration but independently testable
- **User Story 3 (P3 - US3)**: Can start after Foundational - Independent of US1/US2, adds headers configuration
- **User Story 4 (P3 - US4)**: Can start after Foundational - Independent of US1/US2/US3, focuses on assets only

### Within Each User Story

- US1: Entry point creation → App component migration → import updates → dev server config → testing
- US2: Build configuration → build testing → preview testing → feature verification
- US3: Headers middleware → platform configs → FFmpeg.wasm testing
- US4: Asset migration → verification in dev → verification in production

### Parallel Opportunities

- **Phase 1 Setup**: T002, T003, T005 can run in parallel after T001
- **Phase 2 Foundational**: T008, T009, T010, T013, T014 can run in parallel
- **Phase 3 US1**: T019 can happen while T016-T018 are being developed
- **Phase 7 Polish**: T058, T059, T060, T061, T062, T063 can all run in parallel
- **Across User Stories**: After Phase 2 completes, all 4 user stories (Phases 3-6) can be worked on in parallel by different team members

---

## Parallel Example: Foundational Phase

```bash
# Launch multiple foundational tasks together:
Task: "Create index.html at repository root"
Task: "Create vite.config.ts with basic React plugin"
Task: "Update tsconfig.json baseUrl and paths"
Task: "Move app/globals.css to src/styles/globals.css"
Task: "Update src/styles/globals.css Tailwind imports"
```

---

## Parallel Example: Polish Phase

```bash
# Launch all cleanup tasks together:
Task: "Update ESLint configuration"
Task: "Verify ESLint runs"
Task: "Remove next.config.ts"
Task: "Remove next-env.d.ts"
Task: "Move app/opengraph-image.tsx"
Task: "Clean up app/ directory"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005) - ~10 min
2. Complete Phase 2: Foundational (T006-T015) - ~20 min (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (T016-T027) - ~45 min
4. **STOP and VALIDATE**: Test dev server independently per US1 acceptance criteria
5. Can deploy/demo working dev environment if ready

**Total MVP Time**: ~75 minutes for functional dev workflow

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (30 min)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! +45 min)
3. Add User Story 2 → Test independently → Deploy/Demo (production builds +30 min)
4. Add User Story 3 → Test independently → Deploy/Demo (FFmpeg export +20 min)
5. Add User Story 4 → Test independently → Deploy/Demo (asset handling +15 min)
6. Add Polish → Final validation → Production deployment (+30 min)

**Total Migration Time**: ~2.5-3 hours for complete migration with testing

### Parallel Team Strategy

With 3 developers after Phase 2 completes:

- **Developer A**: User Story 1 (Dev Experience) - highest priority
- **Developer B**: User Story 2 (Production Builds) + User Story 4 (Assets) - related build concerns
- **Developer C**: User Story 3 (Headers) + Polish tasks - infrastructure concerns

Stories complete and integrate independently, then final validation together.

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability (US1, US2, US3, US4)
- Each user story should be independently completable and testable
- Manual testing required for WebRTC features (camera, microphone, screen capture) - browser permissions cannot be automated
- TypeScript strict mode must be maintained throughout (Principle II)
- All media stream handling code in lib/recorder/ remains unchanged (Principle III)
- Commit after each phase or logical group of tasks
- Stop at any checkpoint to validate story independently
- Verify contracts in specs/001-react-vite-migration/contracts/ are met:
  - package-json.schema.json: No Next.js deps, Vite present, React 19.2
  - vite-config.schema.json: Required plugins, path aliases, HTTPS server
  - headers.schema.json: COOP/COEP headers in dev and production

**Critical Success Metrics**:
- Dev server start <5s (SC-001)
- HMR <2s (SC-002)
- Build <30s (SC-003)
- All features work identically (SC-004)
- Bundle size within 10% (SC-006)
- Video export works (SC-007)
- Zero console errors (SC-008)
- TypeScript compilation works (SC-009)
- No Vercel Analytics references remain (SC-012)
