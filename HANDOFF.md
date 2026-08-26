# Chairside — Complete Engineering Handoff

*Generated 2026-07-24. This is the exhaustive, pick-it-up-cold reference for the Chairside study game. Every subsystem section below was written by reading the actual source files — it is meant to be accurate to the code, not aspirational. Read this top-to-bottom once, then keep it open.*

**Companion docs (read after this):** `GRAPHICS_ROADMAP.md` (the gray-box → studio-look plan) · `SOLUTIONS.md` (hard-won bug/gotcha log) · `D:\My Apps\CLAUDE.md` (the operating rules you MUST follow).

---

## 0. Orientation — read this first

**What it is.** Chairside is a study game: a student's own lecture material becomes patients they diagnose. You walk a first-person 3D clinic, study your material at a desk, then treat a booked patient by making clinical decisions. There's also a 2D "classic" fallback path. Bilingual — English is the study language, Arabic is an optional add-on, RTL is first-class.

**Owner.** Yaman — dentistry student + solo founder (Jordan), building with AI. Brand: "Not Your AVG Dentist."

**Where it lives.** `D:\My Apps\study-game`

**Two things that shape everything:**
- **Client-only.** All state is in `localStorage`. There is **no backend, no database, no Supabase, and therefore no migrations.** (The parent `CLAUDE.md`'s "migrations are written, never applied" rule simply does not apply here — there's nothing to migrate.)
- **No git yet.** There is no version history. **Strongly recommended:** `git init` + an initial commit of the current working tree before you change anything, and add a `.gitignore` (at least `node_modules/`, `dist/`, `dev-dist/`, `reference/`).

### Stack (all current + mutually compatible as of 2026-07)

| Package | Version | Notes |
|---|---|---|
| vite | ^8.1.1 | dev server + build |
| react / react-dom | ^19.2.7 | React 19, **StrictMode ON** |
| typescript | ~6.0.2 | |
| @react-three/fiber | ^9.6.1 | r3f v9 (required for React 19) |
| @react-three/drei | ^10.7.7 | Environment/Lightformer/ContactShadows/RoundedBox |
| three | ^0.185.1 | **pinned — do NOT bump to r186** (postprocessing's peer range excludes it) |
| @react-three/postprocessing | ^3.0.4 | + `postprocessing` ^6.39.3 (N8AO bundled) |
| motion | ^12.42.2 | Framer Motion; `AnimatePresence mode="wait"` was removed — see §1 |
| zod | ^4.4.3 | the content contract |
| @anthropic-ai/sdk | ^0.112.4 | the AI import pipeline |
| pdfjs-dist | ^6.1.200 | PDF text extraction |
| vite-plugin-pwa | ^1.3.0 | offline PWA |
| dev: tsx ^4.23.1, oxlint ^1.71.0, @vitejs/plugin-react ^6.0.3, @types/* | | |

### Commands

```bash
npm run dev        # Vite dev server → http://localhost:5173
npm run build      # tsc -b && vite build   ← THE REAL TYPE GATE
npm test           # tsx runs every co-located *.test.ts (11 suites)
npm run typecheck  # tsc --noEmit -p tsconfig.app.json  (looser — see below)
npm run lint       # oxlint
npm run icons      # regenerate PWA icons (scripts/make-icons.mjs)
```

> ⚠️ **Gate on `npm run build`, not `npm run typecheck`.** `build` runs `tsc -b` (project references) which is stricter than `tsc --noEmit` and has already caught a real r3f `ref`-type error that `--noEmit` let through.

### The rules you MUST follow (full text in `D:\My Apps\CLAUDE.md`)

1. **Both locales or neither.** Any user-facing string ships in `src/locales/en.ts` AND `src/locales/ar.ts` in the same change (or a deliberate inline bilingual ternary — say which). See §7 for the exact recipe.
2. **Deterministic first.** Default features to plain rules/math. Reach for an LLM only where natural language genuinely requires it. Never label deterministic logic "AI."
3. **Clinical accuracy.** Any clinical computation cites its standard (EFP/AAP 2018, Löe-Silness, O'Leary, etc.) and has test cases. AI-generated content carries a visible "generated from your notes — verify against your syllabus" label. Computed clinical values are *suggestions the clinician can override*, never auto-final.
4. **Ask before writing.** Creating/editing/deleting files, installing packages, deploying — confirm first. Reading, searching, running tests/typechecks — just do it.
5. **One concern per commit.** No feature+bugfix bundles. No bulk dependency changes / `npm audit fix --force`.
6. **Done = verified.** Run `npm run build` + `npm test`, paste the real output, and end every report with: what changed, what you verified with real command output, and what the human must verify with their own eyes.
7. **Record hard-won reasoning.** When a session cracks something hard, append an entry to `D:\My Apps\SOLUTIONS.md` (abandoned approaches are the most valuable part).

### Current state (as inherited)

Clean and green: `npm run build` → 0, `npm test` → 11 suites pass, no console errors. Visuals: Tier 1 (Lightformer IBL, contact shadows, rounded edges) + Tier 2 (post FX: AO/bloom/DOF/grade/vignette/SMAA/ACES) + rebuilt first-person hands. All geometry is **stylized primitive** — the ceiling is real GLB assets + animation + baked lighting (see `GRAPHICS_ROADMAP.md`). Known perf follow-up: ~80 draw calls in the clinic, over the <50 mobile target (triangles are fine).

---

## Table of contents

- **§0** Orientation (above)
- **§1** App Shell, Navigation & Providers
- **§2** Game State: Save, Scoring, Streaks, Profile
- **§3** Content Schema & How to Author a Day
- **§4** The Import / AI Generation Pipeline
- **§5** 3D Clinic Internals (r3f)
- **§6** Screens, Cast & Question Bank
- **§7** Build, Tooling, PWA & i18n
- **Appendix A** — Master gotchas & traps (compiled from every subsystem)
- **Appendix B** — Verifying visual changes (normal + headless-pane recipe)
- **Appendix C** — Outstanding work & where to start
- **Appendix D** — Housekeeping notes

*(Tip: sections use `##`/`###` headings — search the section title to jump.)*

---

## §1. App Shell, Navigation & Providers

This section documents how Chairside boots, how it decides what screen to show, how it survives the Android hardware back button, and the small set of layout/animation/i18n primitives that wrap every screen. The five files that own all of this are `src/main.tsx`, `src/App.tsx`, `src/ui/Shell.tsx`, `src/ui/motion.ts`, and `src/locales/LocaleContext.tsx`.

There is no router. Navigation is a single `phase` state variable in `App` (a discriminated union), mutated by `setPhase`. Understand that variable and you understand the whole app's flow.

### Provider tree (`src/main.tsx`)

The entire tree is three wrappers deep — there is no store provider, no query client, no theme provider component (theme is plain CSS):

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
)
```

Key facts:
- `document.getElementById('root')!` is non-null-asserted — the mount node must exist in `index.html`.
- `./ui/theme.css` is imported here (side-effect import) — this is the single global stylesheet. All the class names used by `Shell` (`app-shell`, `topbar`, `brand`, `brand-mark`, `stat-pills`, `pill`, `lang-btn`) and by `App`'s fallbacks (`centered`, `muted`, `card`) live in that file.
- **StrictMode is ON.** This is a Vite + React 19 web app (unlike the Expo side of the workshop where StrictMode is disabled on web). Every effect and state initializer runs twice in dev. The back-button effect in `App` is written to tolerate this (it's idempotent via the `awayFromTablet` ref guard), but keep StrictMode double-invocation in mind when adding effects here.
- `LocaleProvider` wraps `App`, so `useLocale()` is available everywhere in the app, including inside `Shell`.

### The Phase state machine (`src/App.tsx`)

The exact union type, verbatim (`src/App.tsx:26-33`):

```tsx
type Phase =
  | { name: 'subject' }
  | { name: 'tablet' }
  | { name: 'clinic'; dayId: string }
  | { name: 'prep'; dayId: string }
  | { name: 'treat'; dayId: string; prep: PrepResult }
  | { name: 'close'; dayId: string; summary: DaySummary }
  | { name: 'import' }
```

Initial phase is `{ name: 'tablet' }` (`src/App.tsx:38`) — the app boots straight to the tablet/home screen, NOT to login. The login gate is layered on top of the phase system (see "Sign-in gating" below), so `phase` is `'tablet'` even while the Login screen is showing.

Note the `'dayId' in phase` narrowing idiom used twice:
- `const day = 'dayId' in phase ? getDay(phase.dayId) : undefined` (`src/App.tsx:138`) — resolves the current day for any day-bearing phase.
- The `AnimatePresence` key (`src/App.tsx:174`) uses `phase.name + ('dayId' in phase ? phase.dayId : '')`.

The seven phases and what each renders:

| `phase.name` | Renders | Wrapped in Shell? | Notes |
|---|---|---|---|
| `subject` | `<SubjectSelect>` | yes | Subject picker; also has an Import entry point |
| `tablet` | `<Tablet>` | yes | Home screen / day schedule. Default phase. |
| `clinic` | `<ClinicExperience>` (lazy) | **NO** — full-bleed, returned before Shell | The 3D react-three-fiber path |
| `prep` | `<Prep>` | yes | Classic 2D path, step 1 |
| `treat` | `<Treat>` | yes | Classic 2D path, step 2 |
| `close` | `<DayClose>` | yes | End-of-day summary (both paths converge here) |
| `import` | `<Import>` (lazy, in `<Suspense>`) | yes | PDF/lecture import |

Two screens are code-split via `React.lazy` (`src/App.tsx:20-24`) because their dependencies are heavy:
- `Import` — pulls in pdf.js and the Anthropic SDK.
- `ClinicExperience` (default export of `./clinic/ClinicExperience`) — pulls in three.js, "the heaviest of the three."

Both need a `<Suspense>` boundary. `clinic` uses a `.centered` fallback with `t('loading')`; `import` uses a `.card.muted` fallback with `t('loading')`.

### Transitions — every edge in the machine

State is held in `App` via `useState<Phase>`. There are no reducers; each transition is a direct `setPhase(...)` call. Complete list of what moves the machine:

- **(login) → `subject`**: `signIn()` sets the profile, then `setPhase({ name: 'subject' })` (`src/App.tsx:65`).
- **`subject` → `tablet`**: `pickSubject(subject)` sets `profile.subject` then `setPhase({ name: 'tablet' })` (`src/App.tsx:73`).
- **`subject` → `import`**: `SubjectSelect`'s `onImport` → `setPhase({ name: 'import' })` (`src/App.tsx:184`).
- **`tablet` → `clinic`**: `Tablet`'s `onStartDay(dayId)` → `setPhase({ name: 'clinic', dayId })` (`src/App.tsx:193`). This is the 3D path.
- **`tablet` → `prep`**: `Tablet`'s `onStartClassic(dayId)` → `setPhase({ name: 'prep', dayId })` (`src/App.tsx:194`). This is the classic 2D path.
- **`tablet` → `import`**: `onImport` → `setPhase({ name: 'import' })` (`src/App.tsx:195`).
- **`tablet` → `subject`**: `onChangeSubject` → `setPhase({ name: 'subject' })` (`src/App.tsx:196`).
- **`tablet` → (login)**: `onSignOut` → `clearProfile()`, `setProfile(null)`, `setPhase({ name: 'tablet' })` (`src/App.tsx:197-201`). Phase resets to `tablet` but the `!profile` gate now renders Login.
- **`import` → `tablet`** (success): `onImported` reloads the library, calls `pickSubject(null)` (drops the subject filter so the freshly imported day is visible) and `goTablet()` (`src/App.tsx:209-217`).
- **`import` → `tablet`** (cancel): `onBack` → `goTablet` (`src/App.tsx:218`).
- **`prep` → `treat`**: `Prep`'s `onDone(prep)` → `setPhase({ name: 'treat', dayId: phase.dayId, prep })` (`src/App.tsx:225`). The `PrepResult` is carried in the phase payload.
- **`treat` → `close`**: `Treat`'s `onDone(treat)` → scores the day via `commitDay(phase.dayId, phase.prep, treat)` and stashes the returned `DaySummary` in the phase: `setPhase({ name: 'close', dayId, summary })` (`src/App.tsx:232-239`).
- **`close` → `tablet`**: `DayClose`'s `onBack` → `goTablet` (`src/App.tsx:243`).
- **`clinic` → `tablet`**: `ClinicExperience`'s `onExit` → `goTablet` (`src/App.tsx:155`). Scoring is delivered separately through `onFinish={commitDay}` (`src/App.tsx:154`), so the clinic calls `commitDay` itself rather than routing a result back through `App`.

Invariant worth noting: both the 3D clinic path and the classic 2D `prep → treat` path funnel their scoring through the single `commitDay` callback so "the two can never drift apart on scoring" (`src/App.tsx:108-112`). `close` is the shared terminal screen.

### Sign-in gating (`profile === null` → Login)

Profile is loaded lazily from storage: `useState<Profile | null>(() => loadProfile())` (`src/App.tsx:42`). The gate sits between the full-bleed clinic check and the normal Shell render (`src/App.tsx:161-168`):

```tsx
// Sign-in gates everything: the track decides which content even exists.
if (!profile) {
  return (
    <Shell coins={save.coins} streak={save.streak}>
      <Login onSignIn={signIn} />
    </Shell>
  )
}
```

Consequences to internalize:
- Login IS wrapped in `Shell` (so the coins/streak header and language toggle show even on the login screen), but it is NOT wrapped in the `AnimatePresence`/`motion.div` block — the gate returns early, above that JSX.
- The `clinic` full-bleed branch (`src/App.tsx:141`) is checked BEFORE the profile gate. In practice you can't reach `clinic` without a profile, but ordering matters if you edit this.
- `signIn(displayName, doctorId, track)` builds a `Profile` with `version: 1`, `subject: null`, and `createdOn: localDateKey()`, saves it via `saveProfile`, and advances to `subject` (`src/App.tsx:54-66`). So a fresh sign-in always lands on the subject picker, never straight on the tablet.

### The three profile/navigation functions

- `signIn(displayName: string, doctorId: string, track: Track)` — `src/App.tsx:54`. Creates and persists the profile, then `setPhase({ name: 'subject' })`. `Track` is imported from `./game/cast`.
- `pickSubject(subject: string | null)` — `src/App.tsx:68`. No-op if `!profile`. Merges `{ ...profile, subject }`, persists, then `setPhase({ name: 'tablet' })`. Passing `null` means "all subjects" — this is exactly what the import-success flow uses to guarantee the new day isn't filtered out.
- `goTablet` — `src/App.tsx:81`, a `useCallback` with empty deps. Sets phase to `tablet` AND, if `awayFromTablet.current` is set, clears it and calls `window.history.back()` to pop the single synthetic history entry (see next section). This is the ONE correct way to programmatically return to the tablet — do not `setPhase({ name: 'tablet' })` directly from a screen's "back" handler, or the synthetic history entry will leak.

`commitDay(dayId, prep, treat): DaySummary` — `src/App.tsx:113`, `useCallback` depending on `[save]` (with an eslint-disable on exhaustive-deps because `persist` is treated as stable). It computes `ratio = treatRatio(...)`, `tier = outcomeTier(ratio)`, `stars = starsFor(tier)`, `total = prep.score + treat.score`, `coins = coinsEarned(total, tier)`, applies them via `applyDayCompletion(save, {dayId, score: total, stars}, undefined, coins)`, persists, and returns the `DaySummary { tier, stars, score, coins, streak, missed }` where `missed` is `[...prep.missed, ...treat.missed]`.

### Data derived on every render

- `allDays = [...library, ...ALL_DAYS]` (`src/App.tsx:43`) — imported/library days come FIRST, then the built-ins, "since a day built from your own lecture is the one you actually came to play."
- `days` (`src/App.tsx:46-50`) — the schedule shown on the tablet, filtered by profile: track must match (`d.track ?? 'dental'` defaulting), and subject must match unless `profile.subject === null`. If there's no profile at all the filter returns everything.
- `getDay(id)` (`src/App.tsx:52`) — looks up across `allDays` (the UNFILTERED list) so an in-progress day survives a subject change mid-play. Use `getDay`, not `days.find`, whenever you need the day behind the current phase.

### Android back button / history handling

This is the subtlest part of `App`. It exists because, on Android, with no history entries the hardware back button exits the PWA from any screen. The design holds **exactly one** synthetic history entry the entire time the user is away from the tablet.

The ref `awayFromTablet = useRef(false)` (`src/App.tsx:79`) tracks whether that single entry is currently held.

The effect (`src/App.tsx:89-101`):

```tsx
useEffect(() => {
  if (phase.name === 'tablet') return
  if (!awayFromTablet.current) {
    awayFromTablet.current = true
    window.history.pushState({ inGame: true }, '')
  }
  const onPop = () => {
    awayFromTablet.current = false
    setPhase({ name: 'tablet' })
  }
  window.addEventListener('popstate', onPop)
  return () => window.removeEventListener('popstate', onPop)
}, [phase.name])
```

How it behaves:
- On any non-tablet phase, if no entry is held yet, push exactly one (`{ inGame: true }`). The `!awayFromTablet.current` guard is why moving `prep → treat → close` does NOT push three entries — only the first departure from the tablet pushes.
- While away, a `popstate` (hardware/browser back) clears the flag and returns to `tablet` instead of exiting the app.
- Returning to the tablet via UI (through `goTablet`) pops the held entry with `window.history.back()` so it doesn't linger.
- The comment at `src/App.tsx:76-78` spells out the rationale: pushing one entry per screen "would leave dead entries that swallow later back presses."

**Trap:** any new "return to tablet" path must go through `goTablet` (or otherwise reconcile `awayFromTablet` + `history.back()`), or you desync the ref from the actual history stack. The one place that legitimately sets phase to tablet without `goTablet` is `onSignOut`, which is fine because sign-out from the tablet means `awayFromTablet` is already false.

### AnimatePresence & the keyed-remount approach

The main screen area (everything except the clinic full-bleed and the login gate) is (`src/App.tsx:172-246`):

```tsx
<AnimatePresence>
  <motion.div
    key={phase.name + ('dayId' in phase ? phase.dayId : '')}
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.2 }}
  >
    {/* phase-conditional children */}
  </motion.div>
</AnimatePresence>
```

Key points:
- The `key` is `phase.name` plus the `dayId` when present. Changing phase changes the key, which makes React unmount the old `motion.div` and mount a fresh one — a keyed remount — so each screen replays its `initial → animate` entrance (fade + slight scale-up, 0.2s).
- There is **no `exit` prop** on the `motion.div` and **no `mode="wait"`** on `AnimatePresence`. `mode="wait"` was deliberately removed: with `mode="wait"` AnimatePresence holds the outgoing element until its exit animation completes before mounting the next, which — combined with keyed remounts and no `exit` variant — stalls the UI. The current setup animates only entrances and lets the old node leave immediately.
- The library is `motion/react` (Motion, formerly Framer Motion) — imported as `{ AnimatePresence, motion }` at `src/App.tsx:2`.

### `Shell` layout (`src/ui/Shell.tsx`)

`Shell` is a pure layout wrapper. Props (`src/ui/Shell.tsx:4-8`):

```tsx
interface Props {
  coins: number
  streak: number
  children: ReactNode
}
```

Structure: a `.app-shell` div containing a `.topbar` header and then `{children}`. The header has:
- `.brand` — the tooth emoji `🦷` in a `.brand-mark` span (`aria-hidden`) plus `t('appName')`.
- `.stat-pills` group with:
  - `.pill` streak — `🔥 {streak}`, `title={t('streakLabel')}`.
  - `.pill` coins — `🪙 {coins}`, `title={t('coinsLabel')}`.
  - `.lang-btn` button — toggles locale: `onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}`, label `t('language')`.

`Shell` pulls `t, locale, setLocale` from `useLocale()`. It renders no phase logic — it's purely presentational chrome around whatever screen `App` passes in. `coins`/`streak` come from `App`'s `save.coins` / `save.streak`.

### Motion variants (`src/ui/motion.ts`)

A small set of reusable Motion variants/transitions consumed by individual screens (NOT by `App`'s inline `motion.div`, which defines its animation inline):

- `slideVariants(dir: 1 | -1): Variants` — direction-aware horizontal slide. Returns `{ enter: {x: 40*dir, opacity: 0}, center: {x: 0, opacity: 1}, exit: {x: -40*dir, opacity: 0} }`. **You must pass `dir` from `useLocale()`** — Motion animates raw `x`, not logical/RTL-aware properties, so in Arabic every slide would go the wrong way without the multiplier.
- `springy` — `{ type: 'spring', stiffness: 320, damping: 30 } as const`. A shared spring transition.
- `popIn: Variants` — direction-neutral scale/opacity pop: `enter {scale: 0.94, opacity: 0}`, `center {scale: 1, opacity: 1}`, `exit {scale: 0.98, opacity: 0}`. Safe anywhere regardless of locale.
- `listStagger: Variants` — `enter {}`, `center { transition: { staggerChildren: 0.05 } }`, `exit {}`. For staggered list entrances.

All variant sets use the label triad `enter` / `center` / `exit`. The comment at `src/ui/motion.ts:27-28` warns: every set must define all three labels, because a missing label can leave `AnimatePresence` "waiting forever on a child that never animates."

### `LocaleProvider` / `useLocale` (`src/locales/LocaleContext.tsx`)

The i18n layer. `useLocale()` returns a `LocaleValue`:

```tsx
interface LocaleValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  c: (text: BiText) => string
  dir: 1 | -1        // +1 in LTR, -1 in RTL
  isRtl: boolean
}
```

- `locale` is initialized from persisted save: `useState<Locale>(() => loadSave().locale)` (`src/locales/LocaleContext.tsx:27`). Locale lives inside the game save blob, not a separate key.
- An effect (`src/locales/LocaleContext.tsx:29-33`) sets `document.documentElement.lang = locale` and `.dir = locale === 'ar' ? 'rtl' : 'ltr'` — this is what flips the whole page to RTL for Arabic.
- `setLocale(l)` (`src/locales/LocaleContext.tsx:37-40`) updates state AND read-modify-writes the save: `writeSave({ ...loadSave(), locale: l })`. The comment notes `LocaleProvider` is "the only writer of `locale`" and it re-reads before writing so a concurrent progress save can't clobber the language choice. **Trap:** if you add another writer of `locale` into the save, you break this invariant.
- `t(key, vars?)` — looks up `dict[key] ?? en[key]` (English is the fallback dictionary), then does `{placeholder}` substitution via `replaceAll` over `vars`.
- `c(text: BiText)` — reads bilingual *content* text via `pickText(text, locale)`, falling back to English wherever Arabic is absent. Note the split: `t` is for UI strings (typed `TranslationKey`), `c` is for content objects (typed `BiText` from `../content/schema`).
- `dir` is `-1` for `ar`, `+1` otherwise — feed it directly to `slideVariants`.
- Dictionaries are `const DICTS = { en, ar } as const` (`src/locales/LocaleContext.tsx:24`). `Locale` is re-exported from `./pickText`.
- `useLocale()` throws `'useLocale must be used inside LocaleProvider'` if called outside the provider — so every consumer must be under the `main.tsx` tree.
- The `value` is `useMemo`'d on `[locale, setLocale]`; `setLocale` is a stable `useCallback([])`.
- `useLocale` and `LocaleProvider` are co-exported from one module; both files carry `eslint-disable react-refresh/only-export-components` for that reason.

---

## §2. Game State: Save, Scoring, Streaks, Profile

This section documents the four pure/state modules under `src/game/`. All four are dependency-light: `save.ts` and `profile.ts` use `zod` for validation; `dates.ts` and `scoring.ts` are dependency-free (scoring only imports types). None of these modules touch React — they are plain functions plus zod schemas, all synchronous, all persistence via `localStorage`.

### localStorage keys (complete list across these four files)

Only two keys are used anywhere in these files:

| Key | Defined in | Holds |
|---|---|---|
| `clinic.save.v1` | `src/game/save.ts:4` (`STORAGE_KEY`) | The `SaveData` progress blob (coins, streak, completed days, upgrades, locale) |
| `clinic.profile.v1` | `src/game/profile.ts:11` (`STORAGE_KEY`) | The `Profile` blob (who is playing) |

`dates.ts` and `scoring.ts` touch no storage. The two `STORAGE_KEY` constants are module-private (not exported); each file names its own constant `STORAGE_KEY` independently.

### `save.ts` — progress persistence

**Constants:** `STORAGE_KEY = 'clinic.save.v1'`, `SAVE_VERSION = 1` (both module-private, `save.ts:4-5`).

**The two zod schemas and their exact shapes:**

```ts
const DayRecordSchema = z.object({
  dayId: z.string(),
  score: z.number().int().min(0).max(1_000_000),
  stars: z.number().int().min(0).max(3),
  completedOn: z.string(), // local YYYY-MM-DD
})

const SaveSchema = z.object({
  saveVersion: z.number().int(),
  coins: z.number().int().min(0).max(100_000_000),
  streak: z.number().int().min(0).max(100_000),
  lastPlayedDate: z.string().nullable(),
  completed: z.array(DayRecordSchema),
  upgrades: z.array(z.string()),
  locale: z.enum(['en', 'ar']),
})

export type DayRecord = z.infer<typeof DayRecordSchema>
export type SaveData = z.infer<typeof SaveSchema>
```

Note the exact numeric caps: `score` max `1_000_000`, `stars` max `3`, `coins` max `100_000_000`, `streak` max `100_000`. `lastPlayedDate` is `string | null`. `locale` is a strict enum `'en' | 'ar'`. The completed-records shape is an **array** of `DayRecord` (one entry per unique `dayId`), NOT a map.

**`EMPTY_SAVE`** (exported, `save.ts:27-35`) — the canonical zero state:

```ts
export const EMPTY_SAVE: SaveData = {
  saveVersion: 1,        // = SAVE_VERSION
  coins: 0,
  streak: 0,
  lastPlayedDate: null,
  completed: [],
  upgrades: [],
  locale: 'en',
}
```

**Function behavior:**

- **`migrate(raw: unknown): SaveData`** — merges the raw object over `EMPTY_SAVE` (`{ ...EMPTY_SAVE, ...(raw as object) }`) then `safeParse`s it. On parse failure returns `EMPTY_SAVE` (never throws — a corrupt save costs progress, never the app). On success returns the parsed data but force-overwrites `saveVersion: SAVE_VERSION`. The spread-over-`EMPTY_SAVE` means missing fields are backfilled with defaults before validation.
- **`loadSave(): SaveData`** — reads `clinic.save.v1`; if absent returns `EMPTY_SAVE`; otherwise `JSON.parse` → `migrate`. Wrapped in try/catch; any throw (bad JSON, storage error) returns `EMPTY_SAVE`.
- **`writeSave(data: SaveData): void`** — `JSON.stringify` → `setItem`. try/catch swallows quota/private-mode failures silently so the game loop never breaks. Writes `data` **verbatim** (does not re-read locale — that is `writeProgress`'s job).
- **`writeProgress(data: SaveData): void`** — the one you almost always want. Calls `writeSave({ ...data, locale: loadSave().locale })`. **Invariant/trap:** locale is owned by `LocaleProvider`, which writes it independently. `writeProgress` re-reads the current persisted locale and overrides whatever `data.locale` held, so persisting progress can never silently revert the app's language. If you call `writeSave` directly with a stale `locale`, you reintroduce that bug.
- **`applyDayCompletion(save, record, today?, coins?): SaveData`** — pure; the only progress mutator. Signature:

  ```ts
  applyDayCompletion(
    save: SaveData,
    record: Omit<DayRecord, 'completedOn'>,  // { dayId, score, stars }
    today: string = localDateKey(),
    coins = 0,
  ): SaveData
  ```

  Behavior:
  - `completedOn` = `today`.
  - Filters out any existing record with the same `dayId` (`previous`), and separately finds the existing `best` record for that `dayId`.
  - New coins: `save.coins + coins` (additive).
  - New streak: `nextStreak(save.streak, save.lastPlayedDate, completedOn)`.
  - `lastPlayedDate` set to `completedOn`.
  - The rewritten record keeps **best-of** score and stars: `score: Math.max(record.score, best?.score ?? 0)`, `stars: Math.max(record.stars, best?.stars ?? 0)`. Replaying a day can never lower a stored score/star. The `completed` array is rebuilt as `[...previous, rewrittenRecord]`, so a replayed day moves to the end of the array (order is not by dayId).
  - **Trap:** `applyDayCompletion` does NOT persist — it returns a new `SaveData`. The caller must pass the result to `writeProgress`. Coins are passed as a separate 4th arg, not read from `record`.

### `scoring.ts` — points, tiers, stars, coins

Fully deterministic (module comment: "no AI"). Imports only types (`ClinicDay`, `DecisionQuality`) from `../content/schema`.

**Exact constants:**

```ts
export const DECISION_POINTS: Record<DecisionQuality, number> = {
  best: 100,
  acceptable: 50,
  poor: 0,
}
export const PREP_CORRECT_POINTS = 60
export const PREP_WRONG_POINTS = 10   // "you still read it; effort is not zero"
```

`DecisionQuality` has exactly three members: `best | acceptable | poor` → `100 | 50 | 0`. Note `PREP_WRONG_POINTS = 10` is a nonzero consolation value (defined and exported, though the tier math below uses only `PREP_CORRECT_POINTS`).

**`OutcomeTier`** = `'success' | 'partial' | 'failure'`.

**`treatRatio(earned, maxPossible): number`** — `earned / maxPossible`, clamped to `[0, 1]`. Guards `maxPossible <= 0` by returning `0` (avoids divide-by-zero).

**`outcomeTier(ratio): OutcomeTier`** — exact cutoffs on the 0..1 ratio:
- `ratio >= 0.85` → `'success'`
- `ratio >= 0.5` → `'partial'`
- otherwise → `'failure'`

(So `[0.85, 1] = success`, `[0.5, 0.85) = partial`, `[0, 0.5) = failure`.)

**`maxTreatPoints(day): number`** — `day.treat.cases[0].decisions.length * DECISION_POINTS.best` (i.e. `× 100`). **Trap/invariant:** it uses **only `cases[0]`**, not all cases. v0.1 plays exactly one case per Clinic Day (see `Treat.tsx`); if a day ever ships with two cases this ceiling is wrong and every outcome mis-tiers. Documented intentionally in the source comment.

**`maxPrepPoints(day): number`** — `day.prep.chunks.length * PREP_CORRECT_POINTS` (i.e. `× 60`).

**`coinsEarned(totalScore, tier): number`** — `Math.floor(totalScore / 10) + bonus`, where `bonus = 50` for `success`, `20` for `partial`, `0` for `failure`. So coins = floor(score/10) plus a tier completion bonus.

**`starsFor(tier): number`** — `success → 3`, `partial → 2`, `failure → 1`. **Note:** minimum is 1 star, never 0 (comment: "1..3"). This differs from `DayRecordSchema.stars` which allows `min(0)` — a stored 0 is possible from other paths/migration, but `starsFor` itself never returns 0.

### `dates.ts` — local dates and streak logic

Dependency-free. Deliberately avoids UTC.

**`localDateKey(d = new Date()): string`** — formats to `YYYY-MM-DD` using **local** getters (`getFullYear`, `getMonth()+1`, `getDate()`), month/day zero-padded to 2 digits. **Invariant/reason:** `toISOString()` is intentionally NOT used — it would file a pre-03:00 completion in Jordan (UTC+3) as the previous day and break streaks. Always use this for date keys, never `.toISOString().slice(0,10)`.

**`daysBetween(a, b): number`** — whole calendar days `b - a`. Splits each `YYYY-MM-DD`, rebuilds with `Date.UTC(...)` (UTC used here only as a stable arithmetic base, since both sides are converted identically), diffs in ms, `Math.round(ms / 86_400_000)`. Can be negative if `b` is before `a`.

**`nextStreak(currentStreak, lastPlayedDate, today): number`** — exact rules (`dates.ts:26-36`):
- `lastPlayedDate` is `null` → return `1` (first-ever play).
- `gap = daysBetween(lastPlayedDate, today)`.
- `gap <= 0` (same day or clock moved backward) → `Math.max(currentStreak, 1)` — no change, but never below 1.
- `gap === 1` (next calendar day) → `currentStreak + 1`.
- `gap >= 2` (any longer gap) → `1` (reset).

So: same-day replays don't inflate the streak; consecutive days increment; a missed day resets to 1 (not 0).

### `profile.ts` — who is playing

Kept deliberately **separate from the save** so switching player or subject can never corrupt streak/coin data (module comment).

**Constant:** `STORAGE_KEY = 'clinic.profile.v1'` (private).

**Exact schema:**

```ts
const ProfileSchema = z.object({
  version: z.literal(1),
  displayName: z.string().min(1).max(40),
  doctorId: z.string().min(1),          // a doctor id from cast.ts — the character played as
  track: z.enum(['dental', 'medical']),
  subject: z.string().nullable(),        // matched against ClinicDay.subject.en; null = all
  createdOn: z.string(),
})

export type Profile = z.infer<typeof ProfileSchema>
```

Note: `version` is `z.literal(1)` (an old/other version fails parse → treated as no profile). `track` enum is `'dental' | 'medical'` (compare with `SaveData.locale`'s enum and note `Profile.track` uses `'medical'`, while surrounding docs may say "medicine"). `subject: null` means "all subjects". `doctorId` references an id from `cast.ts`.

**Functions:**
- **`loadProfile(): Profile | null`** — reads `clinic.profile.v1`; absent → `null`; else `JSON.parse` → `safeParse` → returns `data` on success, `null` on parse failure. try/catch returns `null` on any throw. So the "no profile / invalid profile" states are indistinguishable to callers (both `null`), which typically routes the player to onboarding.
- **`saveProfile(profile): void`** — `JSON.stringify` → `setItem`; try/catch swallows private-mode/quota errors (session works, just isn't remembered).
- **`clearProfile(): void`** — `removeItem('clinic.profile.v1')`; try/catch ignores. This is the "sign out / switch player" primitive; it does NOT clear `clinic.save.v1`, so progress survives a profile clear.

---

## §3. Content Schema & How to Author a Day

All game content is a list of `ClinicDay` objects that must pass a single Zod gate before the game ever sees them. There is no other content path: hand-written demo days, LLM-generated days, and localStorage-restored days all go through `parseClinicDay`. If you understand `src/content/schema.ts` you understand every shape the rest of the app consumes.

### The single source of truth: `src/content/schema.ts`

`schemaVersion` is the literal `1` everywhere (`schemaVersion: z.literal(1)` at `src/content/schema.ts:143`). This is `schemaVersion 1`; there is no migration layer yet, so any future breaking change must bump this literal and add handling.

The header comment (`schema.ts:3-17`) states the load-bearing design rules, and they are worth internalizing before authoring:
- **English is the study language.** `en` is required; `ar` is optional and falls back to English at render time (per the comment, via `LocaleContext.c`). A new lecture only has to be written once (English), Arabic is an optional aid.
- **No derived data in content files.** The flattened question bank is computed at load time in `src/game/questionBank.ts` — do not try to precompute it here.
- **Correctness lives on the option (`isCorrect`), never as an index**, so options can be shuffled at render time.
- **Clinical decisions are graded best/acceptable/poor, not right/wrong** (house rule G3 — a clinical value is a suggestion, never auto-final).

#### `BiText` — the bilingual string primitive

Every user-facing string is a `BiText`. `en` is required and non-empty; `ar` is optional but if present must also be non-empty.

```ts
export const BiText = z.object({
  en: z.string().min(1),
  ar: z.string().min(1).optional(),
})
export type BiText = z.infer<typeof BiText>
```

Per the comment at `schema.ts:19-28`: Arabic that IS written keeps clinical terms in English — a student revising "Stage III, Grade C" needs to meet those exact words. You can see this convention throughout the demo days, e.g. `ar: 'المرحلة الثالثة — Stage III'`.

#### `Difficulty` and `Cognitive` enums

```ts
export const Difficulty = z.enum(['easy', 'moderate', 'hard', 'brutal'])
export type Difficulty = z.infer<typeof Difficulty>

export const Cognitive = z.enum(['recall', 'application', 'analysis', 'synthesis'])
export type Cognitive = z.infer<typeof Cognitive>
```

`Difficulty` members: `'easy' | 'moderate' | 'hard' | 'brutal'`. `Cognitive` members (Bloom terms): `'recall' | 'application' | 'analysis' | 'synthesis'`. Both are **optional** wherever they appear (on `MicroQuestion` and `DecisionPoint`). Note: neither demo day actually sets `difficulty` or `cognitive` — they are there for the Phase 2 LLM pipeline to fill in.

#### `AnswerOption` — a multiple-choice option

```ts
export const AnswerOption = z.object({
  id: z.string().min(1),
  label: BiText,
  isCorrect: z.boolean(),
  rationale: BiText.optional(),
})
export type AnswerOption = z.infer<typeof AnswerOption>
```

`rationale` (optional) is why a well-prepared student might still pick this and what makes it wrong — generated items are required to carry it, but the demo days omit it on quiz options.

#### `MicroQuestion` — a one-question quiz attached to a prep chunk

```ts
export const MicroQuestion = z
  .object({
    id: z.string().min(1),
    prompt: BiText,
    options: z.array(AnswerOption).min(2).max(5),
    explanation: BiText,
    sourceRef: BiText,          // e.g. { en: "Slide 12" }
    difficulty: Difficulty.optional(),
    cognitive: Cognitive.optional(),
    sourceQuote: z.string().optional(),
  })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, {
    message: 'A micro-question must have exactly one correct option',
  })
export type MicroQuestion = z.infer<typeof MicroQuestion>
```

Traps:
- **Exactly one** option must have `isCorrect: true` (the `.refine`). Zero or two correct options throws.
- `options` must be **2–5** entries.
- `sourceRef` is a **required `BiText`** here (unlike on `DecisionOption` where it is optional). `sourceQuote` is a **plain `z.string()`**, not a `BiText` — a single verbatim source-deck sentence supporting the keyed answer.

#### `PrepChunk` — a teaching card + its quiz

```ts
export const PrepChunk = z.object({
  id: z.string().min(1),
  title: BiText,
  body: BiText,               // short transformed content, a few sentences max — never a raw slide dump
  question: MicroQuestion,    // exactly one micro-question per chunk
})
export type PrepChunk = z.infer<typeof PrepChunk>
```

#### `DecisionQuality`, `DecisionOption`, `DecisionPoint` — the "Treat" branch

```ts
export const DecisionQuality = z.enum(['best', 'acceptable', 'poor'])
export type DecisionQuality = z.infer<typeof DecisionQuality>

export const DecisionOption = z.object({
  id: z.string().min(1),
  label: BiText,
  quality: DecisionQuality,   // 'best' | 'acceptable' | 'poor'
  feedback: BiText,           // immediate consequence shown after choosing — the teaching moment
  sourceRef: BiText.optional(),
})
export type DecisionOption = z.infer<typeof DecisionOption>

export const DecisionPoint = z
  .object({
    id: z.string().min(1),
    prompt: BiText,
    options: z.array(DecisionOption).min(2).max(5),
    difficulty: Difficulty.optional(),
    cognitive: Cognitive.optional(),
    sourceQuote: z.string().optional(),
  })
  .refine((d) => d.options.filter((o) => o.quality === 'best').length === 1, {
    message: 'A decision point must have exactly one "best" option',
  })
export type DecisionPoint = z.infer<typeof DecisionPoint>
```

Traps:
- A `DecisionPoint` must have **exactly one** option with `quality: 'best'` (the `.refine`). You can have any number of `'acceptable'` and `'poor'` options, but never two `'best'`.
- Options are **2–5**. `sourceRef` on a `DecisionOption` is **optional** (compare: required on `MicroQuestion`).

#### `PatientCase` — one patient encounter

```ts
export const PatientCase = z.object({
  id: z.string().min(1),
  patient: z.object({
    name: BiText,
    age: z.number().int().positive(),
    avatar: z.string().min(1),   // emoji / short glyph, e.g. '🧔'
  }),
  chiefComplaint: BiText,
  history: BiText,
  findings: z.array(BiText).min(1),
  decisions: z.array(DecisionPoint).min(3).max(6),
  outcome: z.object({
    success: BiText,
    partial: BiText,
    failure: BiText,
  }),
})
export type PatientCase = z.infer<typeof PatientCase>
```

Traps:
- `decisions` must be **3–6** decision points — fewer than 3 or more than 6 throws.
- `findings` needs **at least 1** entry.
- `age` must be a **positive integer** (`z.number().int().positive()`).
- `outcome` needs all three of `success` / `partial` / `failure` (shown depending on the end-of-encounter score ratio).

#### `ClinicDay` — the top-level object

```ts
export const ClinicDay = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  subject: BiText,
  title: BiText,
  track: z.enum(['dental', 'medical']).optional(),  // defaults to dental
  isDemo: z.boolean(),                              // REQUIRED, not optional
  provenance: z
    .object({
      sourceFile: z.string(),
      pageCount: z.number().int().positive(),
      model: z.string(),
      generatedOn: z.string(),   // local YYYY-MM-DD, stamped by the pipeline, not the model
    })
    .optional(),
  citations: z.array(z.string()),  // REQUIRED array (may be empty), plain strings not BiText
  prep: z.object({
    missionTitle: BiText,
    briefing: BiText,              // the in-story reason: why this material matters TODAY
    chunks: z.array(PrepChunk).min(1),
  }),
  treat: z.object({
    missionTitle: BiText,
    cases: z.array(PatientCase).min(1),
  }),
})
export type ClinicDay = z.infer<typeof ClinicDay>
```

Field-by-field traps:
- **`isDemo` is required** (`z.boolean()`, not `.optional()`). Hand-written demo content must set `isDemo: true` so it is visibly labeled in-game; generated content should set `false`.
- **`track` is optional** and only accepts `'dental' | 'medical'`; absence means dental.
- **`citations` is a required `z.array(z.string())`** — plain strings, NOT `BiText`. For hand-written days these are the clinical standards; for LLM-generated days the comment (`schema.ts:161-165`, house rule G2) says it instead records the source deck name. It may be empty `[]` but the key must be present.
- **`provenance` is present only for generated days.** `generatedOn` is a `YYYY-MM-DD` string stamped by the pipeline (not the model); `pageCount` must be a positive int. Hand-written days omit `provenance` entirely.
- `prep.chunks` needs **≥1** chunk; `treat.cases` needs **≥1** case.

#### `parseClinicDay` — the single gate

```ts
export function parseClinicDay(raw: unknown): ClinicDay {
  return ClinicDay.parse(raw)
}
```

It is `ClinicDay.parse` (throwing), not `safeParse`. Every content entry point calls it: the registry, the LLM pipeline (Phase 2), and library load/save. There is deliberately no bypass — "no content skips validation."

### How days are registered: `src/content/index.ts`

```ts
const RAW_DAYS: unknown[] = [perioStaging, medAnaphylaxis]
export const ALL_DAYS: ClinicDay[] = RAW_DAYS.map(parseClinicDay)

export function getDay(id: string): ClinicDay | undefined {
  return ALL_DAYS.find((d) => d.id === id)
}
```

Notes:
- `RAW_DAYS` is typed `unknown[]` on purpose — even the hand-written imports are re-validated at module load. `ALL_DAYS` is the validated, exported registry.
- **`parseClinicDay` runs at module-import time.** A malformed day here throws immediately on app boot (this is what `schema.test.ts` guards). This is different from library loading, which swallows per-entry errors.
- `getDay(id)` is the lookup used elsewhere; day `id`s must be unique across the built-in registry (nothing enforces uniqueness in code, so keep them distinct by hand). The two built-in ids are `'perio-staging'` and `'med-anaphylaxis'`.

### Generated-day persistence: `src/content/library.ts`

localStorage key: **`'clinic.library.v1'`** (`const STORAGE_KEY`). Three functions, all returning the resulting `ClinicDay[]`:

- **`loadLibrary(): ClinicDay[]`** — reads the key, `JSON.parse`, requires an array, then parses each entry through `parseClinicDay` inside a per-entry `try/catch`. **An unreadable/outdated day is skipped, not fatal** — one bad entry never loses the whole library, and the whole thing returns `[]` on any outer failure (missing key, bad JSON, non-array). Contrast with `index.ts` where a bad day throws.
- **`saveToLibrary(day: ClinicDay): ClinicDay[]`** — de-dupes by `id` (filters out any existing day with the same `id`, then appends), writes back. **Same-`id` save overwrites** the previous version. On quota-exceeded it silently swallows — the day stays playable this session but will not persist.
- **`removeFromLibrary(dayId: string): ClinicDay[]`** — filters out the matching `id` and writes back; also swallows write errors.

Trap: saving does NOT re-validate the incoming `day` (it is already typed `ClinicDay`), but loading DOES re-validate — so a save written by an older pipeline version that no longer matches the schema will simply be dropped on the next load.

### Which clinical standards the two demo days cite

Both demo days are hand-written (`isDemo: true`), dated 2026-07-21, and carry their standards in the `citations` array (house rule G2 — every clinical computation cites its standard):

- **`perio-staging.ts`** (`track: 'dental'`, subject Periodontology):
  - `'2018 EFP/AAP classification of periodontal diseases'` — drives staging (Stage I–IV by interdental CAL, bone loss, tooth loss, masticatory dysfunction) and grading (bone-loss-%/age ratio bands <0.25 = A, 0.25–1.0 = B, >1.0 = C, plus smoking/diabetes grade modifiers). Seen in prep chunks `c1`–`c3` and case `p1` decisions `d1`–`d4`.
  - `'Löe & Silness gingival index (1963)'` — cited in the header comment and `citations`; the bleeding/inflammation framing.
- **`med-anaphylaxis.ts`** (`track: 'medical'`, subject Medical Emergencies):
  - `'Resuscitation Council anaphylaxis algorithm (adult)'` — drives the adult adrenaline dose (0.5 mg of 1:1000 IM, anterolateral thigh, repeat at 5 min), ABC-problem recognition, and positioning. Seen in prep chunks `c1`–`c3` and case `p1` decisions `d1`–`d4`.
  - `'ABCDE assessment framework'` — the recognition logic (skin signs alone ≠ anaphylaxis; needs an A/B/C problem).

### Step-by-step: authoring a new hand-written day (worked with `perio-staging.ts`)

1. **Create the file** `src/content/days/<your-id>.ts`. Import the type and export a typed constant:
   ```ts
   import type { ClinicDay } from '../schema'
   export const myDay: ClinicDay = { /* ... */ }
   ```
   Typing it `: ClinicDay` gives you compile-time checking; the runtime Zod parse in `index.ts` is the real gate. (Note the demo files import `type { ClinicDay }`, not `parseClinicDay` — parsing happens centrally in `index.ts`.)

2. **Fill the top-level identity block.** Copy the shape from `perio-staging.ts:8-15`:
   - `schemaVersion: 1` (literal), unique `id` (kebab-case, e.g. `'perio-staging'`),
   - `isDemo: true` (required for hand-written content so it is labeled in-game),
   - `track: 'dental'` or `'medical'` (omit for dental default),
   - `subject` and `title` as `BiText`,
   - `citations: [...]` — every clinical standard the day's logic relies on (G2). Omit `provenance` entirely for hand-written days.

3. **Write the `prep` block** (`missionTitle`, `briefing`, `chunks`). `briefing` is the in-story hook — "why this matters TODAY" (e.g. perio's "A perio referral is booked for 3pm..."). Each chunk needs a unique `id`, a `title`, a short transformed `body` (a few sentences — never a raw slide dump), and exactly one `question`.

4. **Write each `MicroQuestion`.** Give it an `id`, `prompt`, 2–5 `options`, an `explanation`, and a `sourceRef` (required `BiText`, e.g. `{ en: 'Slide 12' }`). **Exactly one option must be `isCorrect: true`.** Follow the perio pattern where distractors are plausible (averaged probing depth, BoP%, plaque index) rather than filler.

5. **Write the `treat` block** — `missionTitle` plus `cases`. Each `PatientCase` needs: `id`, `patient` (`name`/`age` positive int/`avatar` emoji like `'🧔'`/`'🧕'`), `chiefComplaint`, `history`, at least one `findings` entry, **3–6 `decisions`**, and an `outcome` with all three of `success`/`partial`/`failure`.

6. **Write each `DecisionPoint`.** `id`, `prompt`, 2–5 `options`. Each `DecisionOption` carries a `quality` (`'best' | 'acceptable' | 'poor'`) and `feedback` (the teaching moment shown on selection), optional `sourceRef`. **Exactly one option must be `quality: 'best'`.** Use `'acceptable'` for right-idea/wrong-order answers (perio `d4` option `d`: scaling before hygiene instruction) and `'poor'` for genuinely wrong ones.

7. **Both locales or neither** (house rule G4/G5, non-negotiable #4). English is required; if you write Arabic, keep clinical terms in English inside the Arabic string (`'المرحلة الثالثة — Stage III'`). The demo days write full Arabic; you may ship English-only and let render-time fallback handle Arabic.

8. **Register it in `src/content/index.ts`**: add the import and append your constant to `RAW_DAYS`:
   ```ts
   import { myDay } from './days/my-day'
   const RAW_DAYS: unknown[] = [perioStaging, medAnaphylaxis, myDay]
   ```

9. **Validate.** The `.map(parseClinicDay)` in `index.ts` throws on boot if anything is malformed, and `src/content/schema.test.ts` exercises the schema. Run `npx tsc --noEmit` and the co-located `*.test.ts` (`npx tsx src/content/schema.test.ts`) before declaring done (house rule G7).

Reminder of the four `.refine`/count invariants that a compiler will NOT catch (only the runtime parse will):
- each `MicroQuestion`: exactly one `isCorrect` option;
- each `DecisionPoint`: exactly one `'best'` option;
- `decisions` per case: 3–6;
- option arrays: 2–5.

---

## §4. The Import / AI Generation Pipeline

This subsystem turns a lecture PDF into a validated `ClinicDay` (the game's playable content unit) using the user's own Anthropic API key, entirely client-side. It lives in `src/ingest/` and is composed of seven files: `pdf.ts` (extraction), `client.ts` (the single Anthropic call wrapper), `prompts.ts` (the system prompts), `schemas.ts` (Zod + JSON-Schema wire shapes), `pipeline.ts` (the four-stage orchestration), `verify.ts` (deterministic source verification), and `assemble.ts` (mapping onto `ClinicDay`).

The high-level flow: **extract PDF → blueprint → write items (per topic, pooled) → review committee (per topic, pooled) → patient case → assemble + verify → `AssembleReport`**.

### PDF extraction — `src/ingest/pdf.ts`

Uses `pdfjs-dist`. The worker is imported as a hashed asset URL and set as `workerSrc` (pdf.ts:1-6); the comment warns it must NOT be inlined or large PDFs freeze the UI mid-extraction.

Types:

```ts
export interface DeckPage { page: number; text: string }
export interface Deck { fileName: string; pages: DeckPage[] }
```

`extractDeck(file: File): Promise<Deck>` (pdf.ts:24) reads `file.arrayBuffer()`, loads the doc, then loops `for (let i = 1; i <= doc.numPages; i++)`. **Page numbers are 1-based and carried through the entire pipeline** — this is load-bearing, because every generated item cites a page the student can click to verify. For each page it maps `content.items` to `('str' in item ? item.str : '')`, joins with a space, collapses `\s+` to single spaces, trims. Calls `page.cleanup()` per page and `doc.cleanup()` at the end (memory hygiene for large decks).

Helper functions:
- `deckToText(deck)` (pdf.ts:46) — the whole deck as one string, dropping empty pages, each page prefixed `[Page N]\n...`, joined by `\n\n`. **This is the cached prefix for every model call.**
- `pagesToText(deck, pageNumbers)` (pdf.ts:54) — same format but only the requested pages (via a `Set`), used to re-inject a topic's specific pages into the item-writing instruction.
- `estimateTokens(text)` (pdf.ts:63) — `Math.ceil(text.length / 3.5)`. Deliberately approximate, for cost display only.
- `looksScanned(deck)` (pdf.ts:71) — returns true when `pages.length > 0 && total / pages.length < 80`, i.e. **average < 80 characters of extracted text per page** flags a scanned/image PDF so the UI can warn before sending an empty prompt.

### The Anthropic client — `src/ingest/client.ts`

- **localStorage key: `'clinic.apiKey.v1'`** (the `KEY_STORAGE` const, client.ts:3). `getApiKey()` / `setApiKey(key)` read/write it; both wrap access in try/catch so private-mode failures degrade to "key won't persist" rather than throwing. Setting an empty string removes the key.
- **Model: `export const MODEL = 'claude-opus-4-8'`** (client.ts:6) — Opus-tier, comment: "item quality is the product." `MODEL` is re-exported through the pipeline into the assembled day's provenance.
- `client()` (client.ts:32) constructs `new Anthropic({ apiKey, dangerouslyAllowBrowser: true })`, throwing `new Error('NO_API_KEY')` when no key is stored.

**Security caveat baked into the source (client.ts:25-31):** the key is sent straight from the browser to Anthropic. The comment explicitly states this is acceptable ONLY for a personal tool where the user supplies their own key, and is NOT acceptable once published — any script on the page can read the key. Shipping publicly requires proxying calls through a server that holds the key. Treat this as a known, documented pre-launch blocker.

`GenerateOptions<T>` shape:

```ts
export interface GenerateOptions<T> {
  system: string
  cachedContext: string      // deck text, placed first and cached
  instruction: string        // per-call instruction, comes AFTER the cached prefix
  schema: Record<string, unknown>
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  maxTokens?: number
  parse: (raw: unknown) => T
}
```

`generate<T>(opts)` (client.ts:58) is the ONE function every stage calls. Exact request shape:

```ts
anthropic.messages.stream({
  model: MODEL,
  max_tokens: opts.maxTokens ?? 32000,
  thinking: { type: 'adaptive' },                 // adaptive extended thinking
  output_config: {
    effort: opts.effort ?? 'high',
    format: { type: 'json_schema', schema: opts.schema },  // structured outputs
  },
  system: [
    { type: 'text', text: opts.system },
    { type: 'text', text: opts.cachedContext, cache_control: { type: 'ephemeral' } },  // prompt caching
  ],
  messages: [{ role: 'user', content: opts.instruction }],
})
```

Key behaviors:
- **Adaptive thinking**: `thinking: { type: 'adaptive' }` — the model decides how hard to think.
- **`output_config.effort`**: defaults to `'high'`; the pipeline passes `'high'` for the blueprint and `'xhigh'` for item writing, review, and case (see below).
- **Structured outputs**: `output_config.format = { type: 'json_schema', schema }` constrains decoding to the JSON Schema. The Zod `parse` is the *second* gate.
- **Prompt caching**: the system array has two text blocks; the deck context is the second block with `cache_control: { type: 'ephemeral' }`. Because the deck is identical across every call in a run, it is billed at full input price once and at cache-read rates thereafter (pipeline.ts:59-64 comment: "60-page deck billed at full input price once and cache-read for every topic after").
- It awaits `stream.finalMessage()`, then throws on `stop_reason === 'refusal'` ("The model declined this request.") and `stop_reason === 'max_tokens'` ("Output was cut off — try a smaller page range."). It finds the first `text` content block, JSON.parses `text.text`, and hands the result to `opts.parse`.

### The pipeline stages — `src/ingest/pipeline.ts`

The `Stage` union (progress reporting, pipeline.ts:22-28) — exact members and order:

```ts
export type Stage =
  | { name: 'reading' }
  | { name: 'blueprint' }
  | { name: 'writing'; done: number; total: number }
  | { name: 'reviewing'; done: number; total: number }
  | { name: 'case' }
  | { name: 'assembling' }
```

Note: `'reading'` is declared in the union but `runPipeline` itself never emits it (the caller does PDF extraction before invoking the pipeline; `runPipeline` starts by emitting `{ name: 'blueprint' }`). `total` in `writing`/`reviewing` is `blueprint.topics.length`.

`RunOptions`: `{ deck: Deck; onStage: (stage: Stage) => void; concurrency?: number }` — **`concurrency` defaults to 3** (pipeline.ts:66), described as keeping "well inside per-minute limits."

`pooled<T,R>(items, limit, fn)` (pipeline.ts:38) — a concurrency-limited map that runs `min(limit, items.length)` workers pulling from a shared `next` cursor, **preserving input order** in the results array.

`runPipeline(opts): Promise<AssembleReport>` (pipeline.ts:65) runs four model stages:

1. **Blueprint** (`effort: 'high'`, `BLUEPRINT_SYSTEM`, `BLUEPRINT_JSON_SCHEMA`, parsed by `Blueprint.parse`). Instruction: build the exam blueprint, weighting each topic by the deck's own emphasis. Produces `subject`, `title`, `citations`, `topics[]` (each with `id`, `title`, `objective`, `pages`, `itemCount`), and `caseScenario`.

2. **Write items** (`effort: 'xhigh'`, `ITEM_SYSTEM`, `TOPIC_ITEMS_JSON_SCHEMA`, parsed by `TopicItems.parse`) — one `generate` call **per topic, pooled at `concurrency`**. The instruction (pipeline.ts:90-104) tells the model to write `topic.itemCount` items, injects `topic.title`/`objective`/`pages`, re-injects `pagesToText(deck, topic.pages)` "for precision," requires each item id to start with `"${topic.id}-"`, and demands the difficulty range be spanned (at least one multi-step-reasoning item, no padding with too-easy recall). Emits `{ name: 'writing', done, total }` after each topic completes (`written++`).

3. **Review committee** (`effort: 'xhigh'`, `REVIEW_SYSTEM`, `REVIEW_JSON_SCHEMA`, parsed by `ReviewResult.parse`) — one call **per topic, pooled**. Instruction passes the topic's items as pretty-printed JSON and asks for one verdict per item. Then it reconciles verdicts (pipeline.ts:131-139):
   - Build `Map<itemId, verdict>`.
   - `keep`, OR **no verdict returned for an item** → item survives unchanged.
   - `revise` **with** a `revised` payload → survives as `{ ...verdict.revised, id: item.id }` (original id preserved).
   - `cut`, OR `revise` **without** a replacement → dropped.
   Emits `{ name: 'reviewing', done, total }`.

4. **Case** (`effort: 'xhigh'`, `CASE_SYSTEM`, `CASE_JSON_SCHEMA`, parsed by `GeneratedCase.parse`). Instruction feeds `blueprint.caseScenario` and asks for decisions that exercise the deck's reasoning in encounter order.

Finally it emits `{ name: 'assembling' }` and returns `assembleDay({ blueprint, topics: reviewedTopics, patientCase, deck, model: MODEL })`.

### The prompt strategy — `src/ingest/prompts.ts`

The file's own header calls the prompts "the product." The core is `ITEM_WRITING_RULES` (prompts.ts:15), embedded verbatim into both `ITEM_SYSTEM` and `CASE_SYSTEM`. It encodes NBME / Case-&-Swanson item-writing discipline:

- **Focused lead-in / cover-the-options test**: the stem must be answerable with the options hidden. "Which of the following is true about X?" is explicitly forbidden.
- **Vignettes above recall**: anything beyond recall opens with a short clinical vignette (patient age/sex, complaint, relevant findings only — no padding with irrelevant normals).
- **Homogeneous options**: all options answer the same question and share a category (all diagnoses, or all next-steps, or all mechanisms); similar length and grammatical form; never mix a drug + diagnosis + lab.
- **Distractors from real errors**: each wrong option is a mistake a *prepared* student makes (confusing adjacent classifications, wrong threshold, one step too early/late, a superseded guideline). The rationale must state the reasoning that leads there and why it's wrong.
- **Banned constructions**: no "all/none of the above", no negative stems (NOT/EXCEPT), no absolute qualifiers ("always"/"never") in the key, no overlapping/subsuming options, no grammatical cues.
- **One defensible answer, anchored to the uploaded deck** — not to some other guideline the model knows. If the deck is outdated, write to the deck and note the tension.
- **Difficulty is reasoning depth, not obscurity.** Target mix stated numerically: **~25% easy, 40% moderate, 25% hard, 10% brutal.**
- **Source anchoring**: every item carries a `sourceQuote` copied verbatim from the deck plus its page; if no such sentence exists, write a different item. This is the anti-invention mechanism.
- **Language**: English only (clinical terms/drugs/doses/numbers stay English). Note this diverges from the DentiPlan "both locales" rule — this game's generated content is deliberately English-only, and `assemble.ts` only ever emits `{ en: ... }` values.

`BLUEPRINT_SYSTEM` (prompts.ts:79): act like an exam committee — identify the load-bearing topics (not every heading), state what the student must DO with each, which pages, and item weight proportional to emphasis; exclude administrivia; and pick the single most clinically consequential scenario as the case.

`REVIEW_SYSTEM` (prompts.ts:107): the committee looks for flaws in a fixed **severity order**: (1) factually unsupported/quote not in deck (fatal), (2) multiple defensible answers, (3) no defensible answer, (4) cueing, (5) unfocused lead-in, (6) worthless distractor, (7) banned construction, (8) trivial. Returns `keep` / `revise` (supply the full corrected item) / `cut`. Explicitly told to be strict: "If you find yourself keeping everything, you are not reviewing."

`CASE_SYSTEM` (prompts.ts:136): the afternoon encounter is a sequence of decisions (not a quiz), ordered as the encounter unfolds (assessment → diagnosis → treatment). Each decision has exactly one `best` option; `acceptable` = defensible-but-inferior with a cost stated; `poor` = would harm the patient, feedback must name the harm. Feedback is second-person, at the moment of consequence.

### Wire schemas — `src/ingest/schemas.ts`

English-only, flat schemas deliberately simpler than the game's bilingual `ClinicDay`, so the model never sees the game's data model. Every Zod schema is paired with a hand-written JSON Schema (the `*_JSON_SCHEMA` consts) sent as `output_config.format`; they must describe the same shape and `assembleDay.test.ts` is said to check that.

Notable constraints:
- `BlueprintTopic`: `pages` is `array(int positive).min(1)`; `itemCount` is `int min(1).max(8)`.
- `Blueprint.topics`: `.min(1).max(12)`.
- `GeneratedItem`: `options` is `.min(3).max(5)`, each option `{ text, isCorrect, rationale }`; `difficulty ∈ {easy, moderate, hard, brutal}`; `cognitive ∈ {recall, application, analysis, synthesis}`; `sourcePage` int positive; `sourceQuote` string.
- `TopicItems`: `{ teachingChunk, items[].min(1) }` — `teachingChunk` is 3–5 sentences of transformed prose (no bullets) shown before the questions.
- `ReviewVerdict`: `{ itemId, verdict ∈ {keep,revise,cut}, flaw, revised: GeneratedItem.nullable() }`. Note `revised` in JSON Schema reuses `TOPIC_ITEMS_JSON_SCHEMA.properties.items.items` via `anyOf` with `{type:'null'}` — a self-referential dependency; changing the item schema changes the review schema too.
- `GeneratedCase`: `findings` `.min(2)`; `decisions` `.min(3).max(6)`, each decision's `options` `.min(3).max(5)` with `quality ∈ {best, acceptable, poor}`; plus `outcomeSuccess/Partial/Failure`. `avatar` is a single emoji; `patientName` a "plausible name for a patient in Jordan."

### Deterministic source verification — `src/ingest/verify.ts`

This is "the deterministic half of quality control" — a check the review model cannot fudge, because it searches the actual extracted text.

- `normalise(s)` (verify.ts:14) — lowercases, folds smart quotes `[''""]` to `'`, strips everything except `[a-z0-9' ]` to spaces, collapses whitespace, trims.
- `quoteOverlap(quote, pageText)` (verify.ts:28) — **ordered word-overlap fraction**, NOT substring match (substring fails on PDF ligatures/hyphenation). It walks the quote's words and advances a `cursor` via `hay.indexOf(word, cursor)`, counting matches that appear *in order*. Returns `matched / q.length`. Returns 0 for an empty quote.
- **`export const QUOTE_THRESHOLD = 0.75`** (verify.ts:45) — an item is `verified` when its best overlap `>= 0.75`, i.e. **75% of the quote's words must appear in order** on some candidate page.
- `verifyItem(item, deck)` (verify.ts:61) checks the cited page **and its neighbours in the order `[0, -1, 1, -2, 2]`** — the cited page, then ±1, then ±2 (decks split sentences across slides; an off-by-one is treated as a nuisance not a fabrication). It keeps the best overlap and the page that produced it (`matchedPage`), short-circuiting if `best >= 1`.

```ts
export interface VerifiedItem {
  item: GeneratedItem
  overlap: number          // best overlap found across candidate pages
  verified: boolean        // overlap >= QUOTE_THRESHOLD (0.75)
  matchedPage: number | null  // page the quote actually matched (may differ from cited)
}
```

- `verifyAll(items, deck)` maps `verifyItem` over all items.
- `difficultyMix(items)` — counts by difficulty into `{ easy, moderate, hard, brutal }` (a standalone helper; note `assemble.ts` computes its own mix inline rather than calling this).
- `findDuplicates(items)` (verify.ts:99) — O(n²) pairwise; when `quoteOverlap(stem_i, stem_j) > 0.85` it flags the **later** item's id (`items[j].id`) as a duplicate to drop.

**What causes an item to be DROPPED** (two independent deterministic gates in `assemble.ts`, on top of the review model's `cut`):
1. **Unverified** — `verifyItem` overlap `< 0.75` on the cited page and all four neighbours (the quote isn't really in the deck → treated as invented).
2. **Duplicate** — its stem overlaps another item's stem by `> 0.85`.

### Assembly — `src/ingest/assemble.ts`

`assembleDay(input): AssembleReport` (assemble.ts:38) is the terminal step. It flattens all surviving items across topics, runs `verifyAll`, computes `findDuplicates`, and builds `usable = ` the set of item ids that are `verified && !duplicate`.

`AssembleReport` shape:

```ts
export interface AssembleReport {
  day: ClinicDay
  kept: number
  droppedUnverified: number
  droppedDuplicate: number
  unverified: VerifiedItem[]   // surfaced for inspection in the UI
  difficultyMix: Record<string, number>
}
```

It maps each topic's kept items into `prep.chunks` (one chunk per kept item; `body` = the topic's `teachingChunk`, `question` carries options → `{ id: 'o'+index, label, isCorrect, rationale }`, `sourceRef: 'Page N'`, `difficulty`, `cognitive`, `sourceQuote`). Chunks with zero kept items are dropped (`return null` then filtered). The case is mapped into `treat.cases[0]` (single case, `id: 'case-1'`; decision option ids `'d'+index`).

The assembled `raw` object is given `schemaVersion: 1`, `id: gen-${slug(blueprint.title)}-${localDateKey()}`, `isDemo: false`, and a `provenance` block (`sourceFile`, `pageCount`, `model`, `generatedOn`). `citations` falls back to `["Generated from <file> — verify against your syllabus"]` when the blueprint reported none.

**Critical invariant (assemble.ts:145):** the whole `raw` object is passed through **`parseClinicDay(raw)`** — the exact same validation gate as hand-authored content. "Nothing skips validation just because a model produced it." If the generated shape can't satisfy the game's `ClinicDay` schema, `parseClinicDay` throws and the whole import fails. The report's `difficultyMix` is recomputed inline over only the `usable` items (so it reflects what actually shipped, not what was generated).

---

## §5. 3D Clinic Internals (r3f)

The 3D clinic is a self-contained first-person walkable room, built **entirely from three.js primitives** — zero downloaded assets, zero network, zero credits. It lives in `src/clinic/` (12 files). `ClinicExperience.tsx` is the only default export and the single entry point; everything else is an internal component or a pure module. The room is authored so that when real GLBs eventually exist, you swap a `<group>`'s children for `<primitive object={gltf.scene} />` and the collision/layout/interaction code stays valid (see `Room.tsx:7-17`, `Patient.tsx:6-14`).

### The `<Canvas>` config and WHY NoToneMapping

`src/clinic/ClinicExperience.tsx:151-167`:

```tsx
<Canvas
  dpr={isTouch ? [1, 1.25] : [1, 1.5]}
  camera={{ fov: 72, near: 0.1, far: 60 }}
  gl={{
    antialias: false,
    toneMapping: NoToneMapping,
    powerPreference: 'high-performance',
  }}
  frameloop={roaming ? 'always' : 'demand'}
>
```

- **`dpr`** — phones get `[1, 1.25]`, desktop `[1, 1.5]`. First-person redraws the whole room every frame, so resolution is the first thing traded on mobile (`ClinicExperience.tsx:152-154`).
- **`camera`** — `fov: 72`, `near: 0.1`, `far: 60`. There is **no `<PerspectiveCamera>` component**; this is r3f's default camera configured inline. `Player.tsx` reads it via `useThree((s) => s.camera)` and mutates it directly.
- **`gl.antialias: false`** — MSAA is off because **SMAA in the postprocessing composer does the AA** (`PostFX.tsx:27-31`). Turning both on just doubles cost.
- **`gl.toneMapping: NoToneMapping`** (imported from `three`) — **CRITICAL INVARIANT.** The `<ToneMapping mode={ACES_FILMIC}>` effect in `PostFX.tsx:64` owns ACES tone-mapping now. If the renderer *also* tone-maps, the frame is mapped twice and washes out. These two settings are a matched pair: never enable renderer tone-mapping without removing the PostFX ToneMapping effect, and vice-versa (`ClinicExperience.tsx:156-158`, `PostFX.tsx:14-23`).
- **`frameloop`** — `'always'` while roaming, `'demand'` otherwise (not `'never'`). Behind an opaque overlay there's nothing to animate, but `'demand'` keeps `invalidate()` and the DevProbe's manual `state.advance()` stepping working (`ClinicExperience.tsx:165-166`).

Background and fog are set as **children of the Canvas**, both cream `#f2e9dc` / `0xf2e9dc`, fog near/far `16`/`34` (`ClinicExperience.tsx:176-177`). **Trap documented in-code:** the background MUST be authored as a hex **string** (`'#f2e9dc'`), not a float triple — three reads `new THREE.Color(r,g,b)` as already-linear (no sRGB conversion) and the background renders washed-out and lighter than the fog. A hex string goes through `setStyle` → sRGB → converted, so background and fog match (`ClinicExperience.tsx:170-175`).

Canvas children, in order: `<color>`, `<fog>`, `<Room>`, `<Patient>`, `<Hands>`, `<Player>`, `{roaming && !isTouch && <PointerLockControls/>}`, `<PostFX>`, `<DevProbe>`.

### The Mode ladder and the Escape de-escalation ladder

`type Mode = 'roam' | 'study' | 'solve' | 'close'` (`ClinicExperience.tsx:29`). Held in `useState<Mode>('roam')`. `roaming = mode === 'roam'` gates the whole first-person layer.

Mode transitions (`activate()`, `ClinicExperience.tsx:55-73`): interactable `study` → `setMode('study')`; `solve` → `setMode('solve')`; `drawer` → toggles `drawerOpen` (does NOT change mode); `board` → fires a toast (clears then re-sets on next tick so repeated presses re-trigger the fade). `finishStudy` stores the `PrepResult` in `prepRef`, sets `studied`, returns to `'roam'`. `finishSolve` calls `onFinish(day.id, prepRef.current ?? EMPTY_PREP, result)` (where `EMPTY_PREP = { score: 0, missed: [] }`), stores the returned `DaySummary`, and sets `mode = 'close'`.

**Escape is a de-escalation ladder, never a quit key** (`ClinicExperience.tsx:82-103`). On each Escape keydown, in order:
1. If `mode !== 'roam'` and `mode !== 'close'` → `setMode('roam')` (close the panel). `close` mode ignores Escape entirely.
2. Else if `document.pointerLockElement` → `document.exitPointerLock()` (release the mouse).
3. Else → `onExit()` (leave the clinic).

So the reflexive post-pointer-lock Escape closes a panel first, releases the mouse next, and only leaves when nothing is left to back out of. Escape is **deliberately not** handled in `input.ts`'s keyboard handler (`input.ts:51-52`) — the clinic owns it.

Related effects: movement/interact keys are attached **only while roaming** via `attachKeyboard` (an open overlay owns the keyboard otherwise, `ClinicExperience.tsx:77-80`); pointer lock is force-exited whenever you leave roam (`ClinicExperience.tsx:114-116`); `locked` tracks `pointerlockchange`; toast auto-clears after `2600` ms.

`Player` receives `paused={!roaming}`. `PointerLockControls` (drei) renders only when `roaming && !isTouch`.

### `theme3d.ts` — full palette and every constant

Palette object `C` (`theme3d.ts:9-32`), `as const`:

```ts
export const C = {
  wall: 0xf4ece1,      wallWarm: 0xefe3d3,  ceiling: 0xfcf8f3,
  floor: 0xeee5d8,     skirting: 0xc99a63,
  wood: 0xc99a63,      woodDark: 0xa87a45,  woodLight: 0xdcb387,
  teal: 0x6dc5bc,      tealDeep: 0x4fa79e,
  white: 0xfbf8f4,     metal: 0xcfd4d8,     skin: 0xd9a276,
  glove: 0x6f9fe0,     window: 0xfff6e2,    cork: 0xd9b98c,
  star: 0xf5c249,      leaf: 0x5fa361,      pot: 0xc4764f,
} as const
```

Physics/geometry constants (`theme3d.ts:35-41`):

```ts
export const EYE_HEIGHT = 1.62      // metres
export const WALK_SPEED = 2.6       // metres per second
export const PLAYER_RADIUS = 0.32
export const ROOM_HALF = 4          // room is 8×8 m, walls at ±4
export const BOUND = ROOM_HALF - PLAYER_RADIUS - 0.05   // = 3.63
```

`BOUND` (3.63) is the clamp that keeps the player off the walls. Note `wallWarm`, `ceiling`, `skirting`, `woodLight`, `leaf`, `pot` are defined but not all referenced by `Room.tsx` — the actively-used ones are `wall`, `floor`, `wood`, `woodDark`, `teal`, `tealDeep`, `white`, `metal`, `skin`, `glove`, `window`, `cork`, `star`.

### `layout.ts` — SPAWN, colliders, interactables

Coordinate convention: **X left(−)→right(+), Z far(−)→near(+)**. Player enters at the near edge facing −Z.

`SPAWN = { x: 0.2, z: 3.0, yaw: 0 }` (`layout.ts:43`) — yaw 0 = looking −Z (into the room).

`COLLIDERS: Box[]` — AABBs in the XZ plane the player can't walk through (`layout.ts:17-23`):

| Furniture | minX | maxX | minZ | maxZ |
|---|---|---|---|---|
| study desk | −3.2 | −1.4 | −3.5 | −2.5 |
| dental chair | 1.0 | 2.2 | −1.0 | 0.6 |
| bookshelf | 2.8 | 3.9 | −2.9 | −1.1 |
| waiting bench | −3.4 | −1.6 | 2.5 | 3.3 |
| reception counter | 1.8 | 3.9 | 2.6 | 3.4 |

`type InteractableId = 'study' | 'solve' | 'drawer' | 'board'`. `INTERACTABLES` (`layout.ts:35-40`): `study {x:-2.3, z:-2.6, radius:1.9}`, `solve {x:1.6, z:-0.2, radius:2.0}`, `drawer {x:3.2, z:-2.0, radius:1.7}`, `board {x:-0.2, z:-3.8, radius:1.8}`.

Two pure helpers:
- `blocked(x, z, radius): boolean` (`layout.ts:46-58`) — true when the point is inside any collider **expanded by the player radius** (`x > minX - r && x < maxX + r && …`).
- `nearestInteractable(x, z): InteractableId | null` (`layout.ts:61-72`) — the closest interactable whose center is within its own `radius` (Euclidean `Math.hypot`), or null.

### `movement.ts` — pure movement math (the strafe invariant)

Kept outside the render loop precisely so it's unit-testable ("does strafing go the right way" is invisible in review, obvious in a test — `movement.ts:6-9`).

- `forwardFromYaw(yaw): Point` = `{ x: -Math.sin(yaw), z: -Math.cos(yaw) }` — a camera at yaw 0 looks down −Z.
- `rightFromForward(f): Point` = `{ x: -f.z, z: f.x }` — forward rotated −90° about +Y. **Strafe-sign invariant:** at yaw 0, `f = (0,-1)` so right = `(-(-1), 0) = (+1, 0)` = +X, which is what pressing **D** must produce (`movement.ts:23-29`).
- `stepPlayer(pos, yaw, input, delta, opts): Point` (`movement.ts:44-75`):
  1. Compose world velocity: `mx = f.x*input.z + r.x*input.x`, `mz = f.z*input.z + r.z*input.x` (input.z = forward, input.x = strafe).
  2. **Diagonal normalize**: if `len = hypot(mx,mz) > 1`, divide both by `len` so diagonal isn't faster than cardinal. `len === 0` → early return, no move.
  3. `step = opts.speed * delta`.
  4. **Per-axis slide + wall clamp**: X first — `wantX = clamp(pos.x + mx*step, -bound, bound)`, applied only if `!blocked(wantX, out.z, radius)`. Then Z using the *already-updated* `out.x`. Resolving each axis independently makes an angled bump into furniture **slide along it instead of sticking** (`movement.ts:37-42, 68-73`).

`STEP_OPTS` passed from `Player.tsx:9` = `{ speed: WALK_SPEED, radius: PLAYER_RADIUS, bound: BOUND }`.

### `input.ts` — shared mutable input state

Module-level mutable objects on purpose — the render loop reads them every frame; routing through React state would re-render 60×/s (`input.ts:1-7`).

- `moveInput = { x: 0, z: 0 }` — x: strafe right+, z: forward+.
- `touchLook = { dx: 0, dy: 0 }` — look deltas accumulated by the touch pad, consumed (zeroed) each frame.
- `attachKeyboard({ onInteract }): () => void` — key sets use **`event.code` (physical keys), never `event.key`** because letter bindings break on Arabic/non-Latin layouts (`input.ts:38-42`). `FORWARD = KeyW|ArrowUp`, `BACK = KeyS|ArrowDown`, `LEFT = KeyA|ArrowLeft`, `RIGHT = KeyD|ArrowRight`. `KeyE` or `Space` → `onInteract()` + `preventDefault`. Ignores `e.repeat`. Held keys live in a `Set`; `recompute()` sums them and clamps to [−1,1]. `blur` clears held keys. Returns a cleanup that removes listeners and clears.
- `resetInput()` — clears held set and zeroes `moveInput` + `touchLook`. Wired as `useEffect(() => resetInput, [])` on unmount in `ClinicExperience.tsx:105`.
- `isTouchDevice(): boolean` — returns `coarse && !fine` via matchMedia. **Trap:** `'ontouchstart' in window` is true on any Windows touch-laptop and would rob those users of mouse-look, so it requires a coarse pointer AND no fine one (`input.ts:84-96`).
- `isRtlLayout(): boolean` — `document.documentElement.dir === 'rtl'`; used to mirror the touch controls.

### `Player.tsx` — the controller

Renders `null`; it's a pure `useFrame` driver mutating the shared camera (`Player.tsx:25-90`). Locals: `yaw` ref (init `SPAWN.yaw`), `pitch` ref (init 0). Constants: `LOOK_SENSITIVITY = 0.0032`, `PITCH_LIMIT = 1.2`. Reuses one module-level `forward` Vector3 to avoid per-frame GC.

- On mount: `camera.position.set(SPAWN.x, EYE_HEIGHT, SPAWN.z)`, `camera.rotation.set(0, SPAWN.yaw, 0, 'YXZ')`.
- Each frame: `delta = Math.min(rawDelta, 0.05)` — clamps the giant delta a backgrounded tab returns on first return so the player can't teleport through a wall.
- **paused branch** (overlay up): zero `touchLook`, clear `nearestRef`/fire `onNearChange(null)`, return. (Dropping look deltas prevents a camera snap on re-entry.)
- **Look**: only in `isTouch` mode does Player drive rotation (`yaw -= touchLook.dx*SENS`, `pitch -= touchLook.dy*SENS`, pitch clamped ±1.2, then `camera.rotation.set(pitch, yaw, 0, 'YXZ')`). On desktop `PointerLockControls` owns rotation — doing both would fight (`Player.tsx:54-62`).
- **Move**: derives yaw from the camera itself (`camera.getWorldDirection`, flatten `.y=0`, `yawNow = atan2(-forward.x, -forward.z)`) so desktop and touch share one code path; calls `stepPlayer(...)`; writes `camera.position` back at fixed `EYE_HEIGHT`; then updates `nearestInteractable` → `nearestRef` + `onNearChange` on change.

### `Room.tsx` — the assembled room

Exported `Room` is `memo`'d (`Room.tsx:434`) because HUD state (prompt/toast/pointer-lock) lives in the same component that renders the Canvas; without memo, every step toward a desk re-reconciles ~60 meshes. Local consts `H = 2.8` (ceiling height), `W = ROOM_HALF * 2 = 8`.

**`Box` helper** (`Room.tsx:28-49`) — the auto-radius rounded box every hard cube goes through so beveled edges catch the IBL and read as moulded plastic/wood, not gray-box. Auto-radius formula when `radius` prop is omitted:
```ts
const min = Math.min(args[0], args[1], args[2])
const r = radius ?? Math.max(0.006, Math.min(0.03, min * 0.28))
```
i.e. 28% of the smallest dimension, clamped to [0.006, 0.03] so thin slabs (a laptop lid) stay valid. Wraps drei `<RoundedBox smoothness={3} creaseAngle={0.5}>`. Takes a React-19-style `ref?: Ref<Mesh>` prop (the drawer needs it).

**`Studio()` IBL** (`Room.tsx:387-427`) — image-based lighting from Lightformers rendered once, no HDRI file/network (offline-safe). `<Environment resolution={256} frames={1} environmentIntensity={0.55}>`. **`environmentIntensity` ≈ 0.55 is load-bearing**: at 1 the warm surround floods everything toward white and ACES desaturates the blown highlights, so cream/honey/teal stop reading as colours. Inside: `<color attach="background" args={['#8f7f62']}>` — a mid-warm surround the props reflect, deliberately NOT near-white (near-white acts as a giant fill and washes the palette out). Three Lightformers: warm key `rect intensity={2.6} color="#fff1d8" pos [-4,3,2] scale [7,5,1]`; cool fill `rect intensity={0.9} color="#dce6ff" pos [5,2,-3] scale [5,4,1]` (shadows read blue not black); overhead diffuse `rect intensity={0.7} color="#ffffff" pos [0,6,0]` rotated flat.

**Real lights** (`Room.tsx:444-445`) are intentionally dim since the IBL carries ambient+reflections: `<hemisphereLight args={[0xfff8ee, 0xd9c6ad, 0.35]}>` + `<directionalLight position={[-5,4,1.5]} intensity={1.4} color={0xfff2de}>`. Plus one real `<pointLight intensity={5} distance={3.5} color={0xfff2dc}>` inside `DentalChair` at the overhead lamp. **No shadow-casting real lights** anywhere — grounding comes from frozen ContactShadows.

**`ContactShadows`** (`Room.tsx:451-460`): `position={[0, 0.012, 0]} scale={13} resolution={512} blur={2.6} opacity={0.42} far={2.2} frames={1} color="#4a3b2a"`. `frames={1}` renders once and freezes (free forever, an order of magnitude cheaper than a shadow map on mobile). `far={2.2}` is tuned below furniture height to exclude ceiling/overhead lamp. Warm tint, not black (a black shadow in a cream room reads as a hole).

Sub-components assembled in the group: `Studio`, the lights, `ContactShadows`, then `Walls` (floor/ceiling/4 walls/4 `Dado` rails/`ArchedWindow`), `Desk`, `DentalChair`, `Bookshelf` (takes `drawerOpen`), `Bench`, `Counter`, `ReputationBoard`. Emissive geometry (lamp shade `0xffe9c4` @ 1.5, window `C.window` @ 1.5, chair lamp `0xfff0d0` @ 1.7) stands in for real lights and is what Bloom picks up. The `Bookshelf` drawer lerps its `mesh.position.x` toward `-0.42` (open) / `0` (closed) at `Math.min(1, delta*8)` (`Room.tsx:276-281`) — the only `useFrame` in Room, driven by the `drawerOpen` prop from `ClinicExperience`.

### `PostFX.tsx` — exact effect order and isTouch gating

`<EffectComposer multisampling={0} enableNormalPass={!isTouch}>` (`PostFX.tsx:26-31`). MSAA off (SMAA handles AA); the normal pass is built only when N8AO runs. Effects composite top-to-bottom; **ToneMapping MUST be last and the only tone-mapper** (paired with the renderer's NoToneMapping). Exact order and props:

1. **N8AO** — `aoRadius={0.5} intensity={1.6} distanceFalloff={1} halfRes={false}`. **Desktop only** (`!isTouch`); its normal pass is the single most expensive thing in the stack. On touch it's `<></>`.
2. **DepthOfField** — `focusDistance={0.05} focalLength={0.02} bokehScale={1.4} height={480}`. **Desktop only**; samples the depth buffer. On touch `<></>`.
3. **Bloom** — `mipmapBlur luminanceThreshold={1} intensity={0.5} radius={0.7}`. `luminanceThreshold={1}` means only HDR emissive (lamp/window, luminance > 1) blooms. Runs on both profiles.
4. **HueSaturation** — `saturation={0.1}`.
5. **BrightnessContrast** — `brightness={0.0} contrast={0.07}`.
6. **Vignette** — `offset={0.32} darkness={0.42}`.
7. **SMAA** (the anti-aliasing).
8. **ToneMapping** — `mode={ToneMappingMode.ACES_FILMIC}` (imported from `postprocessing`), applied exactly once, LAST.

The two heavy effects (N8AO, DOF) are the entire mobile/desktop divergence, gated purely on `isTouch`.

### `Hands.tsx` — construction + camera-transform-copy trick

First-person gloved hands, `scale={0.95}`, two `OneHand` (side −1 left, +1 right). Colors `GLOVE = C.glove` (`0x6f9fe0`, blue nitrile), `SKIN = C.skin`. **The hand group is parented to nothing** — it copies the camera transform each frame, because three.js only renders a camera's children if the camera is in the scene graph, and r3f's default camera is not (`Hands.tsx:17-20`).

`useFrame` (`Hands.tsx:114-127`): `moving = Math.abs(moveInput.x)+Math.abs(moveInput.z) > 0.05`; bob accumulates at `delta * (moving ? 9 : 1.6)`, amplitude `moving ? 0.02 : 0.006`. Then:
```ts
g.position.copy(state.camera.position)
g.quaternion.copy(state.camera.quaternion)
g.translateY(-0.34 + Math.sin(bob) * amp)   // hands low in view
g.translateZ(-0.32)                          // slightly forward
g.rotateZ(Math.sin(bob*0.5) * (moving ? 0.03 : 0.01))
```
Construction cues (`Hands.tsx:25-108`): each `Finger` = a proximal `RoundedBox` + a shorter distal one bent `rotation=[0.55,0,0]` at the knuckle (the bend is what reads as "finger" vs "mitten"). `OneHand` = forearm capsule in glove sleeve, a sliver of bare skin wrist above the cuff, a fatter glove-cuff ring, a flat rounded palm slab, four fingers fanned off the front edge (varying x/spread/length), and a thumb (two segments) angled up across the inner side. Reads `moveInput` directly from `input.ts` — no props.

### `Patient.tsx` — swap point + mood

`memo`'d. Props `PatientProps`: `color?: number` (default `0xe7b7b0`, dominant garment colour, the per-patient token), `mood?: 'calm' | 'anxious' | 'in-pain'` (default `'anxious'`). **THE swap point** for the future Higgsfield rigged-GLB character — replace the primitives with `<primitive object={useGLTF(url).scene}/>` at the same position and room/collision/interaction stay untouched (`Patient.tsx:6-14`).

Group at `position={[1.6, 0, -0.2]}` (same spot as the `DentalChair` group, so the figure sits in the chair). `useFrame` idle breathing mutates `root.position.y = Math.sin(t*rate)*0.012`, `rate = in-pain 2.4 | anxious 1.7 | calm 1.1`. `headTilt = in-pain 0.22 | anxious 0.1 | calm 0.0`. When `mood === 'in-pain'` an extra skin sphere renders as a hand held at the jaw. Body = box thighs, box lower-legs, capsule torso reclined `rotation-x={0.45}`, two arm capsules, sphere head (`C.skin`) at `rotation-x={0.45 + headTilt}`, half-sphere hair cap `0x2b2119`.

In `ClinicExperience`, `patientMood = studied ? 'anxious' : 'in-pain'` (`ClinicExperience.tsx:147`) — the patient clutches their jaw until you've studied, then relaxes to anxious.

### `DevProbe.tsx` — the `window.__clinic` API

Renders `null`. **DEV-only**, stripped in production by `if (!import.meta.env.DEV) return`. Exists because automated browser panes report `document.hidden`, so `requestAnimationFrame` never fires and the render loop never ticks — this lets a frame be stepped by hand (`DevProbe.tsx:5-12`). On mount it attaches `window.__clinic` with:

- `step(dt = 1/60)` — run one frame: `state.advance(performance.now() + dt*1000)` (drives `useFrame` subscribers then renders; works with `frameloop='demand'`).
- `setMove(x, z)` — writes `moveInput.x/z` (simulate keys/thumbstick).
- `look(dx, dy)` — **accumulates** into `touchLook.dx/dy` (`+=`).
- `pos()` → `{ x, y, z }` camera position, each `.toFixed(3)`.
- `setPos(x, z)` — sets `camera.position.x/z` (leaves y).
- `size()` → `{ w, h }` from `state.size`.
- `sceneObjects()` → count via `state.scene.traverse`.
- `drawCalls()` → `state.gl.info.render.calls`.
- `triangles()` → `state.gl.info.render.triangles`.

Cleanup `delete`s `window.__clinic` on unmount.

### `TouchControls.tsx` — phone controls

Rendered only when `isTouch && roaming`, inside the HUD (`ClinicExperience.tsx:220-225`). Props: `promptLabel: string | null`, `onInteract: () => void`. `STICK_RADIUS = 52`. Left thumb = move stick (`.stick-base`/`.stick-knob` divs), right thumb = look pad (listens on `window`). Uses **explicit `pointerId` tracking** (`movePointer`, `lookPointer` refs) so both thumbs work at once — the single-touch shortcut breaks the moment you walk and look together (`TouchControls.tsx:4-9`).

Stick: on down, captures the pointer, records center as origin, `stopPropagation`+`preventDefault` so the window look-pad doesn't also grab it. On move, clamps offset to `STICK_RADIUS`, normalizes to [−1,1], applies a **0.15 deadzone**, writes `moveInput.x = nx`, `moveInput.z = -ny` (screen-down = backward). On up/cancel, zeroes move + recenters knob.

Look pad (`TouchControls.tsx:93-129`): ignores the pointer already driving the stick; determines which screen half is the stick side via `isRtlLayout()` (stick sits on the inline-start edge, which **flips in Arabic**) and only accepts look on the opposite half; ignores touches on a `<button>` or `.stick-base`; accumulates `touchLook.dx/dy` from deltas. Both effects zero `moveInput`/`touchLook` on cleanup to avoid a stale delta snapping the camera on re-entry.

---

## §6. Screens, Cast & Question Bank

This section documents the eight screen components under `src/screens/` plus the two `src/game/` modules they lean on for characters (`cast.ts`) and the derived question substrate (`questionBank.ts`). Every screen is a **presentational component**: it takes `ClinicDay`/`Profile`/`SaveData` and a set of callbacks as props, owns only ephemeral UI state locally, and pushes all persistence and navigation decisions up to its parent via callbacks. None of these screens read or write `localStorage` directly — that is the parent orchestrator's job. All localization goes through `useLocale()`, which exposes `t` (string-key translator, accepts an interpolation object like `{ n, total }`), `c` (renders a `BiText`, falling back to `en` when `ar` is absent), and `dir` (`'ltr' | 'rtl'`, used to pick slide direction).

### Shared prop/data types (grounded, referenced by every screen)

`BiText`, `ClinicDay`, `DecisionQuality`, and friends are Zod-inferred in `src/content/schema.ts`. The load-bearing shapes:

```ts
type BiText = { en: string; ar?: string }          // en required; ar optional aid

type DecisionQuality = 'best' | 'acceptable' | 'poor'

// patient inside a PatientCase — NOTE age + avatar (emoji fallback) live here:
patient: { name: BiText; age: number /* int>0 */; avatar: string /* emoji glyph */ }

// ClinicDay (the unit every screen operates on):
type ClinicDay = {
  schemaVersion: 1
  id: string
  subject: BiText
  title: BiText
  track?: 'dental' | 'medical'   // OPTIONAL — defaults to 'dental' when absent
  isDemo: boolean
  provenance?: { sourceFile: string; pageCount: number; model: string; generatedOn: string }
  citations: string[]
  prep:  { missionTitle: BiText; briefing: BiText; chunks: PrepChunk[] /* min 1 */ }
  treat: { missionTitle: BiText; cases: PatientCase[] /* min 1 */ }
}
```

`Profile` (`src/game/profile.ts`, localStorage key `'clinic.profile.v1'`):

```ts
type Profile = {
  version: 1
  displayName: string      // 1..40 chars
  doctorId: string         // a DOCTORS[].id from cast.ts
  track: 'dental' | 'medical'
  subject: string | null   // matched against ClinicDay.subject.en; null = all subjects
  createdOn: string
}
```

Scoring constants used by the screens (`src/game/scoring.ts`): `DECISION_POINTS = { best: 100, acceptable: 50, poor: 0 }`, `PREP_CORRECT_POINTS = 60`, `PREP_WRONG_POINTS = 10`. `OutcomeTier = 'success' | 'partial' | 'failure'`.

### Login.tsx — sign-in that IS character select

```ts
interface Props {
  onSignIn: (displayName: string, doctorId: string, track: Track) => void
}
```

The core design idea: **there is no track dropdown.** The student types a display name (`<input maxLength={40}>`), then picks one of the four `DOCTORS` cards. Because every doctor carries a `track` field, *picking the doctor is how you pick the track* (`Login.tsx:11-15` comment spells this out). Local state is just `name: string` and `picked: string | null` (the chosen doctor id). `doctor = DOCTORS.find(d => d.id === picked)`; the Start button is enabled only when `ready = name.trim().length > 0 && doctor`. On click it calls `onSignIn(name.trim(), doctor.id, doctor.track)` — so the parent receives all three pieces at once and constructs the `Profile`.

Rendering details worth knowing:
- Doctor grid maps `DOCTORS`; each card shows `portraitUrl(d.id, 'calm')` (128×128, lazy), `c(d.name)`, `c(d.role)`, and a `track-chip` reading `t('trackDental')`/`t('trackMedical')`. Selected card gets the `picked` class.
- When a doctor is chosen, a preview card appears using `bodyUrl(doctor.id)` (full-body art).
- Uses `motion` with `listStagger`/`popIn` variants (`initial="enter" animate="center"`).

### SubjectSelect.tsx — track-scoped subject picker

```ts
interface Props {
  days: ClinicDay[]
  track: Track
  onPick: (subject: string | null) => void   // null = "all subjects"
  onImport: () => void
}
export interface SubjectEntry { key: string; label: { en: string; ar?: string }; dayCount: number }
```

The derivation logic is exported and testable — `subjectsFor(days, track)`:
1. Iterate `days`; **skip any day whose `(day.track ?? 'dental') !== track`** (this is the defaulting invariant: a day with no `track` is treated as dental).
2. Group by `key = day.subject.en` (the English string is the stable grouping key — Arabic is never the key).
3. Count days per subject into `dayCount`; keep the first day's `subject` `BiText` as the `label`.
4. Return sorted by `a.key.localeCompare(b.key)`.

UI: renders a header (track name + hint), an empty-state card (`t('noSubjects')`/`t('noSubjectsHint')`) when no subjects exist, then one `subject-card` per entry showing `sceneUrl(track)` art, `c(s.label)`, and `t('dayCount', { n: s.dayCount })`. Clicking a card calls `onPick(s.key)`. There is always an Import button (`onImport`), and — only when at least one subject exists — an "All subjects" ghost button that calls `onPick(null)`.

### Tablet.tsx — the hub (profile strip + day list + actions)

```ts
interface Props {
  days: ClinicDay[]
  save: SaveData
  profile: Profile
  onStartDay: (dayId: string) => void      // enters the first-person 3D clinic (primary)
  onStartClassic: (dayId: string) => void   // the tested 2D path — fallback for weak devices
  onImport: () => void
  onChangeSubject: () => void
  onSignOut: () => void
}
```

Two ways to launch a day: **`onStartDay` is the primary (3D first-person clinic); `onStartClassic` is the 2D fallback** exposed as a small ghost button per day (`slot-classic`). Both receive the `dayId`.

- **Profile strip** (top card): `doctor = getDoctor(profile.doctorId)` → avatar via `portraitUrl(doctor.id)` (defaults to `'calm'` mood). Shows `profile.displayName`, then track label plus `profile.subject` appended as `· <subject>` when set. Two ghost actions: `onChangeSubject` (`t('changeSubject')`) and `onSignOut` (`t('signOut')`).
- **Day list**: maps `days`. For each day, `record = save.completed.find(r => r.dayId === day.id)`. Icon is `📋` if completed else `🩺`. Shows `c(day.title)` + `c(day.subject)`. Two badge conditions: `day.isDemo` → `t('demoBadge')`; `day.provenance` → `t('generatedBadge', { file: day.provenance.sourceFile })` (both can appear). Right side shows `'★'.repeat(record.stars)` when completed, otherwise `t('enterClinic')`.
- Empty state when `days.length === 0`. Always an Import button at the bottom.

`SaveData.completed` records carry at least `{ dayId, stars }` (consumed here as `record.stars`).

### Prep.tsx — morning study Q&A (flashcard-style micro-questions)

```ts
export interface PrepResult {
  score: number
  missed: { prompt: string; explanation: string; source: string }[]
}
interface Props { day: ClinicDay; onDone: (result: PrepResult) => void }
```

Walks `day.prep.chunks` one at a time. Local state: `index`, `picked: string|null`, `score`, `missed`. For the current `chunk`, options are shuffled with `seededShuffle(chunk.question.options, index + 7)` inside `useMemo([chunk, index])` — **stable per render but position is never a tell** (see gotcha about the +7 seed).

`choose(id)`: no-op if already answered. On correct → `score += PREP_CORRECT_POINTS (60)`. On wrong → `score += PREP_WRONG_POINTS (10)` AND pushes a missed entry `{ prompt: c(chunk.question.prompt), explanation: c(chunk.question.explanation), source: c(chunk.question.sourceRef) }`. Note `sourceRef` is a required `BiText` on `MicroQuestion`, so `c()` always resolves.

`next()`: advances `index` and clears `picked`; on the last chunk calls `onDone({ score, missed })`. After answering, each option gets `correct`/`wrong` classes, and a feedback panel renders the explanation + `t('source')` line. Button label switches from `t('next')` to `t('seePatient')` on the final chunk. Progress bar width = `((index + (answered?1:0)) / total) * 100`.

### Treat.tsx — the patient chair (decisions + mood-reactive face)

```ts
export interface TreatResult {
  score: number
  maxScore: number
  missed: { prompt: string; explanation: string; source: string }[]
}
interface Props { day: ClinicDay; onDone: (result: TreatResult) => void }
```

**Plays exactly `day.treat.cases[0]`** — the first case only (mirrored by `maxTreatPoints` in scoring.ts, which also uses `cases[0]`). Local module maps:

```ts
const QUALITY_CLASS:    Record<DecisionQuality,string> = { best:'correct', acceptable:'acceptable', poor:'wrong' }
const QUALITY_FEEDBACK: Record<DecisionQuality,string> = { best:'good',    acceptable:'mid',        poor:'bad' }
```

**Cast selection**: `cast = patientForCase(day.id, patientCase.patient.age)` (memoized on `[day.id, patient.age]`). This is the age-matched face — see `cast.ts` below. It is used only for the *portrait art*; the displayed name/age/history text still come from the written `patientCase.patient`, not from the cast entry.

**`PatientFace` sub-component** — `{ id: string; mood: Mood; fallback: string }`. Renders `<img src={portraitUrl(id, mood)}>`; on image `onError` it flips local `failed` state and instead renders the `fallback` emoji glyph in a `patient-avatar` span. This is the "a generated day must never break because art wasn't sliced" safety net — `fallback` is always `patientCase.patient.avatar`.

**The mood logic (the emotional feedback loop):**
- **Briefing screen** (`!briefed`): face mood is hard-coded `"pain"` — the patient arrives suffering.
- **Decision screen, before answering** (`!answered`): mood `"anxious"`.
- **After answering**: `pickedOption?.quality === 'best'` → `"relieved"`, otherwise → `"pain"`. So a best answer visibly relieves the patient; anything less keeps them in pain. This is described in-code as "the fastest feedback in the screen."

**Flow**: gated by `briefed` (starts `false`). Briefing card shows chief complaint, history, and a `findings` list. `Continue` sets `briefed = true`. Then it walks `patientCase.decisions[index]`, options shuffled via `seededShuffle(decision.options, index + 13)`. `maxScore = total * DECISION_POINTS.best`. `choose(id)`: adds `DECISION_POINTS[opt.quality]`; if quality ≠ `best`, finds the single `best` option and records a missed entry using **the best option's** `feedback` as the explanation and its `sourceRef` (empty string if absent). `next()` calls `onDone({ score, maxScore, missed })` on the last decision. Final button label flips from `t('continueCase')` to `t('clinicClosed')`.

### DayClose.tsx — end-of-day summary + missed review

```ts
export interface DaySummary {
  tier: OutcomeTier          // 'success' | 'partial' | 'failure'
  stars: number
  score: number
  coins: number
  streak: number
  missed: { prompt: string; explanation: string; source: string }[]
}
interface Props { day: ClinicDay; summary: DaySummary; onBack: () => void }
```

Pure results screen (all numbers are computed by the parent using scoring.ts and handed in). `outcomeText = day.treat.cases[0].outcome[summary.tier]` — the narrative outcome line keyed by tier (`outcome` has `success`/`partial`/`failure` `BiText` fields, again from `cases[0]`). Renders: filled stars `'★'.repeat(summary.stars)` plus dimmed remainder `'★'.repeat(3 - summary.stars)`; a result grid of `score`, `+coins` (`t('coinsEarned')`), and `🔥streak`; the outcome text; then the missed review — either `t('nothingMissed')` or a list of the `missed` entries (each shows `prompt`, `explanation`, and a `source` line when non-empty). One button: `onBack` → `t('backToTablet')`.

### Import.tsx — LLM lecture-to-day generator

```ts
interface Props {
  track: Track            // stamped onto the generated day so it lands in the right schedule
  onImported: () => void
  onBack: () => void
}
```

The `track` prop is critical and load-bearing: the generation pipeline "reads a lecture, not a curriculum," so the track must be injected from who's signed in — `saveToLibrary({ ...result.day, track })` at `Import.tsx:74`. Without this the day would never appear in the student's filtered schedule.

Flow: user pastes an Anthropic API key (`getApiKey`/`setApiKey` from `src/ingest/client`, stored in-browser — screen carries a prominent "personal use only, move behind a server before publishing" warning), then picks a PDF. `pickFile` → `extractDeck(file)` (from `src/ingest/pdf`), warns via `looksScanned()` if the PDF has almost no selectable text. `run()` → `runPipeline({ deck, onStage: setStage })` (from `src/ingest/pipeline`), producing an `AssembleReport`. The special error `'NO_API_KEY'` is mapped to a friendly "Add your Anthropic API key first."

`Stage` machine (labelled by `stageLabel`): `reading` → `blueprint` → `writing` (has `done`/`total`) → `reviewing` (has `done`/`total`) → `case` → `assembling`. The progress bar only animates by fraction during `writing`/`reviewing`; other stages show 100%. The `report` card shows `kept`, `droppedUnverified`, `droppedDuplicate`, and a `difficultyMix` breakdown (`easy`/`moderate`/`hard`/`brutal`). Note: this screen's copy is **English-only inline strings** (not routed through `t()` except `backToTablet`) — a locale gap if that matters.

### cast.ts — the complete roster + selection helpers

**Types:** `type Track = 'dental' | 'medical'`; `type Mood = 'calm' | 'anxious' | 'pain' | 'relieved'`; `const MOODS: Mood[] = ['calm','anxious','pain','relieved']`.

**Asset URL helpers** (all prefixed with `import.meta.env.BASE_URL` so they survive a subpath deploy):
- `portraitUrl(id, mood='calm')` → `${BASE_URL}characters/${id}-${mood}.jpg` (256px face)
- `bodyUrl(id)` → `${BASE_URL}characters/${id}-body.jpg` (full body)
- `sceneUrl(track)` → `${BASE_URL}characters/scene-${track}.jpg`

So art files live in `public/characters/` named `<id>-<mood>.jpg`, `<id>-body.jpg`, and `scene-dental.jpg`/`scene-medical.jpg`.

**`Doctor` = `{ id, name: BiText, track: Track, role: BiText }`.** The complete `DOCTORS` roster:

| id | name (en / ar) | track | role (en) |
|----|----|----|----|
| `yaman` | Dr. Yaman / د. يمان | dental | Dentist |
| `miya` | Dr. Miya / د. ميّا | dental | Dentist |
| `amr` | Dr. Amr / د. عمرو | medical | Physician |
| `tala` | Dr. Tala / د. تالا | medical | Physician |

`getDoctor(id): Doctor | undefined` — `DOCTORS.find`.

**`CastPatient` = `{ id, name: BiText, age: number, defaultMood: Mood, blurb: BiText }`.** The complete `PATIENTS` roster:

| id | name (en / ar) | age | defaultMood | blurb (en) |
|----|----|----|----|----|
| `patient-1` | Layla / ليلى | 24 | anxious | Dental anxiety — has put this off for two years. |
| `patient-2` | Omar / عمر | 8 | anxious | First filling. Brought his dinosaur for courage. |
| `patient-3` | Abu Khaled / أبو خالد | 68 | calm | Missing teeth; asking about dentures. |
| `patient-4` | Yousef / يوسف | 45 | pain | Severe toothache, three nights without sleep. |
| `patient-5` | Khala Nadia / خالة نادية | 55 | calm | Bleeding gums whenever she brushes. |
| `patient-6` | Rami / رامي | 19 | anxious | Braces review. Talks with his hand over his mouth. |
| `patient-7` | Sara / سارة | 31 | calm | Wants whitening before her sister's wedding. |
| `patient-8` | Mr. Haddad / السيد حداد | 50 | anxious | Cracked a tooth. Checks his watch every minute. |

`getPatient(id): CastPatient | undefined` — `PATIENTS.find`.

**Deterministic selection** (`cast.ts:145-172`). `hashOf(s)` is a 32-bit unsigned FNV-ish rolling hash (`hash = (hash*31 + charCodeAt(i)) >>> 0`).
- `patientForDay(dayId): CastPatient` → `PATIENTS[hashOf(dayId) % PATIENTS.length]`. Same day always seats the same person (reload stability).
- `patientForCase(dayId, age): CastPatient` — **age-matching**, because a paediatric face on an adult periodontitis case teaches the wrong thing. It builds a pool via `near(w) = PATIENTS.filter(p => Math.abs(p.age - age) <= w)`: try `near(10)`; if empty, `near(20)`; if still empty, the full `PATIENTS` list. Then the hash **only breaks the tie within the pool**: `pool[hashOf(dayId) % pool.length]`. Treat.tsx uses this one.

Note the two selectors coexist but `patientForCase` is the one wired into gameplay (Treat.tsx); `patientForDay` is available but not currently called by these screens.

### questionBank.ts — the derived recall substrate (built, not yet consumed)

```ts
export interface BankQuestion {
  id: string
  prompt: BiText
  options: { id: string; label: BiText; isCorrect: boolean }[]
  explanation: BiText
}
export function buildQuestionBank(days: ClinicDay[]): BankQuestion[]
export function seededShuffle<T>(items: T[], seed: number): T[]
```

`buildQuestionBank` **flattens every question in every day into one uniform list**, deriving it at load time rather than storing it (the schema deliberately forbids a stored question bank — one source of truth):
- **Prep chunks** → `{ id: `${day.id}:${chunk.question.id}`, prompt, options, explanation }` (options already carry `isCorrect`).
- **Treat decisions** → `{ id: `${day.id}:${case.id}:${decision.id}`, prompt, options: mapped so `isCorrect = (quality === 'best')`, explanation: the **best** option's `feedback` }`. The `find(o => o.quality === 'best')!` is a non-null assertion that relies on the schema's `.refine()` invariant (exactly one `best` per decision) — safe only because parsing enforced it.

Per the file's own header comment: **nothing in the UI consumes `buildQuestionBank`/`BankQuestion` yet.** It exists as the substrate for a planned "RECALL / CLEAR" spaced-repetition queue (missed/flagged items returning as quick-fire active recall). `seededShuffle`, however, *is* used today — by both Prep and Treat to shuffle answer order deterministically.

`seededShuffle<T>(items, seed)`: copies the array, seeds an LCG (`s = (s*1103515245 + 12345) % 2147483648`, with `seed || 1` so a zero seed doesn't freeze it), and Fisher-Yates swaps using `Math.abs(s) % (i+1)`. Same seed ⇒ same permutation, which is why the shuffle is stable across re-renders and reproducible in tests.

---

## §7. Build, Tooling, PWA & i18n

This section covers how Chairside is built, typechecked, linted, tested, packaged as a PWA, and how its bilingual (EN/AR) string system works. All paths are relative to `D:/My Apps/study-game`.

### npm scripts (package.json)

The package is `"study-game"`, `"private": true`, `"version": "0.0.0"`, `"type": "module"`. Scripts (`package.json:6`):

| Script | Command | What it does |
|---|---|---|
| `dev` | `vite` | Starts the Vite dev server. This is the only mode where the `devFileDrop` plugin's `/__drop` and `/__ref` endpoints exist (plugin is `apply: 'serve'`). |
| `build` | `tsc -b && vite build` | **Project-references build first, then Vite bundle.** `tsc -b` type-checks BOTH `tsconfig.app.json` and `tsconfig.node.json` (it builds the referenced projects in `tsconfig.json`). Only if that exits 0 does `vite build` run. This is the strict gate — see the tsconfig section for why it catches more than `typecheck`. |
| `lint` | `oxlint` | Runs oxlint (the Rust linter, v1.71.0) with its default ruleset — there is no `.oxlintrc` in the read set, so it uses defaults. Note the code contains an `// eslint-disable-next-line react-refresh/only-export-components` comment (LocaleContext.tsx:65), a convention oxlint also honors. |
| `preview` | `vite preview` | Serves the built `dist/` (production build, so no dev endpoints). |
| `test` | `tsx src/game/dates.test.ts && tsx src/game/scoring.test.ts && tsx src/game/save.test.ts && tsx src/game/questionBank.test.ts && tsx src/game/cast.test.ts && tsx src/locales/pickText.test.ts && tsx src/ingest/verify.test.ts && tsx src/ingest/assemble.test.ts && tsx src/clinic/layout.test.ts && tsx src/clinic/movement.test.ts && tsx src/content/schema.test.ts` | Runs each co-located `*.test.ts` file directly through `tsx` (esbuild-based TS runner), chained with `&&` so the run **stops at the first failing file**. These are plain `node:assert/strict` scripts that `console.log` a pass line and throw on failure — not a test-framework run. Adding a new test file means adding it to this chain by hand. |
| `typecheck` | `tsc --noEmit -p tsconfig.app.json` | Type-checks ONLY the app project (src). Does not check `vite.config.ts` (that's the node project). **Weaker than `build`** — see below. |
| `icons` | `node scripts/make-icons.mjs` | Generates the PWA icon PNGs (`icon-192.png`, `icon-512.png`) referenced by the manifest. The script itself is outside this section's read set. |

### Dependency versions (package.json)

**dependencies:**
- `@anthropic-ai/sdk` ^0.112.4
- `@react-three/drei` ^10.7.7
- `@react-three/fiber` ^9.6.1
- `@react-three/postprocessing` ^3.0.4
- `motion` ^12.42.2
- `pdfjs-dist` ^6.1.200
- `postprocessing` ^6.39.3
- `react` ^19.2.7
- `react-dom` ^19.2.7
- `three` ^0.185.1
- `zod` ^4.4.3

**devDependencies:**
- `@types/node` ^24.13.2
- `@types/react` ^19.2.17
- `@types/react-dom` ^19.2.3
- `@types/three` ^0.185.1
- `@vitejs/plugin-react` ^6.0.3
- `oxlint` ^1.71.0
- `tsx` ^4.23.1
- `typescript` ~6.0.2 (note: TS 6.x; pinned with `~` so only patch updates)
- `vite` ^8.1.1
- `vite-plugin-pwa` ^1.3.0

Note there is no `phaser` dependency despite a Vite comment mentioning "Phaser's chunk" (see PWA workbox note below) — the 3D clinic is react-three-fiber/three, not Phaser. The comment is stale relative to the actual stack.

### Vite config (vite.config.ts)

`export default defineConfig({ ... })`. Three plugins, in this order (order matters — `devFileDrop` registers its middleware before React's transforms):

1. **`devFileDrop()`** — a custom dev-only `Plugin` (see below).
2. **`react()`** — `@vitejs/plugin-react`, default options (Babel-based Fast Refresh + JSX). `tsconfig.app.json` sets `"jsx": "react-jsx"`.
3. **`VitePWA({...})`** — see PWA subsection.

Top-level config also sets:
- `server.watch.ignored: ['**/reference/**']` — the `reference/` folder holds art-direction media and scratch frames; watching large binaries there **crashes the dev server with EBUSY on Windows** (this is Yaman's OS). Do not remove this.
- `build.chunkSizeWarningLimit: 1600` — three.js is lazily imported by the clinic and gets its own large chunk; this raises the warning threshold so the expected big chunk doesn't spam warnings.

### The devFileDrop plugin — DEV ONLY

Defined as `function devFileDrop(): Plugin` (vite.config.ts:14). Critically `apply: 'serve'`, so it is **never registered in a production build** — `/__drop` and `/__ref` do not exist under `vite preview` or in `dist/`. Its stated purpose: pull frames out of a reference video for art direction — the browser can decode video Node cannot, but has nowhere to write the result.

Root is fixed to `resolve(process.cwd(), 'reference')`. Two middlewares registered in `configureServer`:

- **`POST /__drop`** — writes a request body to a file. Filename comes from the untrusted `x-filename` header (default `'drop.bin'`). Non-POST returns 405. **Path confinement:** rejects with 400 if the name `isAbsolute(name)` OR `relative(root, target).startsWith('..')` — i.e. writes are confined to `reference/`. On success it `mkdirSync(dirname(target), { recursive: true })` then `writeFileSync` and replies `wrote <target>`.
- **`GET /__ref/<name>`** — streams a reference file back out (browser can decode video Node cannot; large binaries in `public/` crash Vite's watcher with EBUSY on Windows, so they live outside `public/`). Name is `decodeURIComponent`'d from the URL. Same confinement check (400 on absolute/`..`/empty), 404 if the file doesn't exist. Content-Type is mapped from extension via a small table: `.mp4`→`video/mp4`, `.webm`→`video/webm`, `.mov`→`video/quicktime`, `.jpg`→`image/jpeg`, `.png`→`image/png`, else `application/octet-stream`. Streams via `createReadStream(target).pipe(res)`.

Trap: these endpoints have zero auth beyond the path-confinement check. They are safe only because they're dev-only and confined to `reference/`. Never promote this pattern to production.

### PWA manifest & workbox (VitePWA options)

- `registerType: 'prompt'` — the service worker does NOT auto-update silently. The deliberate comment: a silently stale SW "would leave students playing last week's clinic days," so the app should prompt the user to refresh when new content is precached.
- `includeAssets: ['favicon.svg']`.
- **Manifest:**
  - `name`: `'Chairside — your slides become patients'`
  - `short_name`: `'Chairside'`
  - `description`: `'A clinical study game: prep your material in the morning, treat the patients booked in the afternoon.'`
  - `theme_color` / `background_color`: both `'#0b1220'` (dark navy)
  - `display`: `'standalone'`, `orientation`: `'portrait'`, `start_url`: `'/'`
  - `icons`: `icon-192.png` (192×192), `icon-512.png` (512×512), and `icon-512.png` again with `purpose: 'maskable'`. These PNGs come from `npm run icons`.
- **workbox (precache):**
  - `globPatterns: ['**/*.{js,css,html,svg,png,woff2}']` — precaches JS/CSS/HTML/SVG/PNG/woff2.
  - `maximumFileSizeToCacheInBytes: 4 * 1024 * 1024` (4 MB). Raised from the Workbox default of ~2 MB because a large JS chunk would otherwise be skipped from precache (the comment attributes this to "Phaser's chunk," but the real large chunk today is three.js — treat the number, not the label, as authoritative).

### tsconfig: project references (the critical build-vs-typecheck distinction)

There are three tsconfig files (all present):

- **`tsconfig.json`** — the solution root. `"files": []`, only `"references"` to `./tsconfig.app.json` and `./tsconfig.node.json`. A bare `tsc -b` here builds both referenced projects.
- **`tsconfig.app.json`** — the browser/app project. `include: ["src"]`. Key options: `target`/`lib` ES2023 + DOM, `module: "esnext"`, `moduleResolution: "bundler"`, `types: ["vite/client", "node"]`, `jsx: "react-jsx"`, `allowImportingTsExtensions: true`, `verbatimModuleSyntax: true`, `moduleDetection: "force"`, `noEmit: true`, `allowArbitraryExtensions: true`, `skipLibCheck: true`. **Strictness flags:** `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`. tsBuildInfo at `./node_modules/.tmp/tsconfig.app.tsbuildinfo`.
- **`tsconfig.node.json`** — the tooling project. `include: ["vite.config.ts"]` (ONLY the Vite config). `lib: ["ES2023"]` (no DOM), `types: ["node"]`, `module: "nodenext"`. Same strictness flags. tsBuildInfo at `./node_modules/.tmp/tsconfig.node.tsbuildinfo`.

**The trap that matters:** `npm run typecheck` runs `tsc --noEmit -p tsconfig.app.json` — it checks **only `src/`**. `npm run build` runs `tsc -b`, which checks **both projects**, including `vite.config.ts` under the node project. So a type error introduced in `vite.config.ts` (or any node-side tooling file) passes `typecheck` cleanly but **fails `build`**. Always run the full `tsc -b` (or `npm run build`) before declaring a config/tooling change done; `typecheck` alone is not sufficient. Note also: neither tsconfig sets `"strict": true` explicitly — the strictness here comes from the individual `noUnused*` / `noFallthrough` / `erasableSyntaxOnly` flags, not the `strict` umbrella.

Also note `erasableSyntaxOnly` is on in both projects: TypeScript-only runtime constructs (enums, parameter properties, namespaces with runtime output) are disallowed — you must use plain `const`/`type`/`as const`, which is exactly what the locale files and Zod schemas do.

### i18n mechanics

The system has two distinct layers: **UI chrome strings** (fixed dictionary, keyed) and **content strings** (bilingual objects that live inside clinic-day content). English is primary; Arabic is an optional add-on that falls back to English.

#### Layer 1 — UI strings: `en.ts` / `ar.ts` and `t()`

`src/locales/en.ts` exports `const en = { ... } as const` — a flat object of string keys to English strings, and `export type TranslationKey = keyof typeof en`. `en` is the source of truth for the set of keys.

```ts
export const en = {
  appName: 'Chairside',
  tagline: 'Your slides become patients.',
  // ...
  dayCount: '{n} clinic day(s)',
  boardReading: '{streak} day streak · {coins} coins',
  // ...
  language: 'العربية',   // NB: holds the *other* language's name — it's the toggle-button label
  loading: 'Loading…',
} as const
export type TranslationKey = keyof typeof en
```

`src/locales/ar.ts` is typed to be exhaustive:

```ts
import type { en } from './en'
export const ar: Record<keyof typeof en, string> = { /* every key, Arabic value */ }
```

Because `ar` is typed `Record<keyof typeof en, string>`, **omitting any key from `ar.ts` is a compile error** — the Arabic dictionary is forced to stay complete. (This is stricter than the content layer, where Arabic is optional.)

Special key: `language`. In `en.ts` its value is `'العربية'`; in `ar.ts` its value is `'English'`. It is the **label of the language-toggle button** (`Shell.tsx:33` renders `t('language')`, and the button `onClick` does `setLocale(locale === 'en' ? 'ar' : 'en')`) — so the button always shows the name of the language you'd switch *to*.

`t()` is provided by the React context in `src/locales/LocaleContext.tsx`. Signature (from `LocaleValue`):

```ts
t: (key: TranslationKey, vars?: Record<string, string | number>) => string
```

Implementation (LocaleContext.tsx:49): `let s = dict[key] ?? en[key]` (dict is `ar` or `en`; the `?? en[key]` is a belt-and-suspenders fallback though `ar` is exhaustive by type), then for each `vars` entry it does `s = s.replaceAll('{'+k+'}', String(v))`. So placeholders are literal `{name}` tokens, replaced by string/number vars. Example: `t('dayCount', { n: 3 })` → `"3 clinic day(s)"`; `t('boardReading', { streak: 5, coins: 120 })`. Placeholders that aren't supplied are left as-is in the string.

#### Layer 2 — content strings: `BiText`, `pickText()` and `c()`

Content (clinic days) uses `BiText` from `src/content/schema.ts`:

```ts
export const BiText = z.object({
  en: z.string().min(1),
  ar: z.string().min(1).optional(),
})
export type BiText = z.infer<typeof BiText>
```

So `en` is required and non-empty; `ar` is optional and, if present, non-empty. `src/locales/pickText.ts`:

```ts
export type Locale = 'en' | 'ar'
export function pickText(text: BiText, locale: Locale): string {
  if (locale === 'ar' && text.ar) return text.ar
  return text.en
}
```

Note the truthiness check `text.ar` means an empty-string `ar` falls back to English too (verified by `pickText.test.ts:15`, which asserts `pickText({ en: 'Grade C', ar: '' }, 'ar') === 'Grade C'`). `c()` on the context is just `c: (text) => pickText(text, locale)` (LocaleContext.tsx:58), signature `c: (text: BiText) => string`.

Design rule (schema.ts comments): Arabic that IS written keeps clinical terms in English — e.g. Arabic content still contains "Stage III, Grade C" verbatim, because that's what the student must recognize on the exam. The `pickText.test.ts` fixtures show this (`ar: 'المرحلة الثالثة (Stage III)'`).

#### Provider, RTL, persistence

`LocaleProvider` (wraps the app; see `main.tsx`) holds the locale in state initialized from the save: `useState<Locale>(() => loadSave().locale)`. The default locale in `src/game/save.ts` is `'en'` (save.ts:34; the save schema constrains `locale: z.enum(['en','ar'])` at save.ts:21).

On every locale change a `useEffect` sets `document.documentElement.lang = locale` and `document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'` — **RTL is driven at the `<html>` element**, not per-component. The context also exposes two derived helpers for animation code:
- `isRtl: boolean` (`locale === 'ar'`)
- `dir: 1 | -1` — `+1` in LTR, `-1` in RTL; the doc comment says "Multiply every animated x offset by this" so Motion animations flip horizontally in Arabic.

Persistence detail / invariant: `setLocale` does `setLocaleState(l); writeSave({ ...loadSave(), locale: l })` — it read-modify-writes the freshest save so a concurrent progress save can't clobber the language choice. Conversely `save.ts:72` shows the progress writer preserves `locale: loadSave().locale`. **LocaleProvider is the single owner/writer of the `locale` field** — don't write `locale` from anywhere else. `useLocale()` throws `'useLocale must be used inside LocaleProvider'` if called outside the provider.

`export type { Locale }` is re-exported from both `pickText.ts` and `LocaleContext.tsx`.

### Recipe: add a new user-facing string (touches BOTH locale files)

For a **UI chrome string** (menus, buttons, labels — the `t()` path):

1. Add the key + English value to `src/locales/en.ts` inside the `en` object, e.g. `newThing: 'New thing {count}',`. Keep it inside the `as const` object; `TranslationKey` updates automatically.
2. Add the **same key** with the Arabic value to `src/locales/ar.ts`. This is not optional — `ar` is typed `Record<keyof typeof en, string>`, so if you skip it `tsc -b` fails. Keep any `{placeholder}` tokens identical between the two.
3. Use it in a component via `const { t } = useLocale(); t('newThing', { count: 4 })`.
4. Run `npm run build` (full `tsc -b`, not just `typecheck`) — the exhaustiveness of `ar` is enforced only by the compiler, so build is the check that proves both locales are present. This also satisfies the house rule "both locales or neither."

For a **content string** (inside a clinic day — the `c()`/`BiText` path): you don't edit the locale files at all. You write a `BiText` object `{ en: '...' }` (Arabic optional: add `ar: '...'` only where a translation is worth writing). Render it with `const { c } = useLocale(); c(myBiText)`. Missing Arabic falls back to English automatically, so content only ever has to be authored once. Validate the content against the Zod schema (`parseClinicDay`) — `en` must be a non-empty string.

---

## Appendix A — Master gotchas & traps

*Every non-obvious trap surfaced while documenting each subsystem, grouped by section.*

### §1 — App Shell, Navigation & Providers

- The app boots to phase 'tablet', not to a login phase. Login is not a Phase variant at all — it is rendered by the `if (!profile)` gate at src/App.tsx:162, which sits ABOVE the AnimatePresence block. So `phase.name === 'tablet'` while the Login screen is on screen after sign-out.
- There is no router. All navigation is one `useState<Phase>` in App mutated by direct setPhase calls. Adding a screen means adding a Phase union member AND a conditional render block — not a route.
- Return-to-tablet from any screen MUST go through `goTablet` (src/App.tsx:81), never a bare `setPhase({name:'tablet'})`. goTablet also pops the single synthetic history entry via history.back(); skipping it desyncs the `awayFromTablet` ref from the real history stack and leaks entries.
- Exactly ONE synthetic history entry is pushed on first departure from the tablet (guarded by `awayFromTablet.current`), not one per screen — deliberately, so deep flows like prep→treat→close don't leave dead back-entries. The push happens in the phase effect (src/App.tsx:89), the pop in goTablet.
- AnimatePresence has NO `mode="wait"` and the motion.div has NO `exit` prop — both intentional. mode="wait" was removed because, combined with keyed remounts and no exit variant, it stalls the UI. Only entrances animate.
- The AnimatePresence child animation is defined INLINE on the motion.div (opacity+scale, 0.2s) and does NOT use any of the variants in src/ui/motion.ts. Those variants (slideVariants, popIn, listStagger, springy) are used by individual screens, so don't assume editing motion.ts affects the top-level transition.
- slideVariants(dir) animates raw `x`, which is NOT RTL-aware. You must pass `dir` from useLocale() (−1 for Arabic) or Arabic slides travel the wrong direction. This is a repeated footgun anywhere Motion `x`/translate is used.
- Locale is stored INSIDE the game save blob (loadSave().locale / writeSave), not a standalone key. setLocale read-modify-writes the whole save; LocaleProvider is intended to be the only writer of `locale`. Adding another writer risks clobbering it during a concurrent progress save.
- `getDay(id)` searches the UNFILTERED `allDays`, while the tablet schedule uses the profile-FILTERED `days`. Use getDay for the current phase's day so an in-progress day survives a subject change; using days.find would lose it.
- Library/imported days are prepended before built-in ALL_DAYS. On import success the code deliberately calls pickSubject(null) to drop the subject filter, otherwise the freshly imported day is filtered out and the user can't see what they just made.
- StrictMode is ON (this is the Vite web build, not the Expo web build where it's off). Effects and initializers double-invoke in dev; the back-button effect is written to tolerate it via the ref guard — keep that in mind when adding effects to App.
- Two screens are React.lazy code-split (Import → pdf.js + Anthropic SDK; ClinicExperience → three.js) and each needs its own Suspense fallback. The `clinic` phase returns BEFORE the Shell wrapper (full-bleed) and before the profile gate, so it is the one screen not inside Shell.
- `t()` (UI strings, TranslationKey) and `c()` (bilingual content, BiText) are different functions with different fallback paths. Don't use t for content or c for UI keys.
- commitDay is the single scoring chokepoint for BOTH the 3D clinic path (via onFinish) and the classic prep→treat path (called in Treat's onDone). Its useCallback deps are [save] with an eslint-disable; if you change how save is read, revisit that dependency comment at src/App.tsx:133-135.

### §2 — Game State: Save, Scoring, Streaks, Profile

- applyDayCompletion is pure and does NOT persist — you must pass its result to writeProgress(). Coins are the separate 4th arg, not taken from the record.
- Always persist via writeProgress, not writeSave: writeProgress re-reads the current locale from storage and overrides data.locale, preventing a silent language revert. writeSave writes locale verbatim.
- maxTreatPoints uses only day.treat.cases[0] — if a Clinic Day ever ships with two cases the score ceiling is wrong and every outcome mis-tiers. v0.1 assumes exactly one case per day.
- Never derive date keys with toISOString(): localDateKey uses LOCAL getters on purpose so UTC+3 (Jordan) pre-03:00 completions aren't filed as yesterday and break the streak.
- nextStreak resets a missed day to 1, not 0; same-day replays return max(current,1) (no increment); only gap===1 increments.
- completed is an ARRAY keyed by dayId (filter+rebuild), not a map. applyDayCompletion moves a replayed day to the end of the array — order is not stable by dayId.
- Score/stars are best-of: replaying a day can only raise them (Math.max against the previous best). starsFor never returns 0 (min 1), but DayRecordSchema.stars allows 0 — a 0 can only come from migration/other paths.
- outcomeTier cutoffs are on the 0..1 ratio: >=0.85 success, >=0.5 partial, else failure. Don't pass a raw score.
- loadProfile returns null for BOTH missing and corrupt profiles — callers can't tell them apart. clearProfile removes only clinic.profile.v1 and leaves clinic.save.v1 progress intact.
- migrate merges raw over EMPTY_SAVE before validating, so partial/old saves are backfilled; on any parse failure it silently returns EMPTY_SAVE (progress loss is preferred over a crash). saveVersion is always force-set to 1.
- Profile.track enum value is 'medical' (not 'medium'/'medicine'); Profile.version is z.literal(1) so a mismatched version fails parse and reads as no profile.

### §3 — Content Schema & How to Author a Day

- parseClinicDay uses ClinicDay.parse (throwing), not safeParse. A malformed built-in day throws at MODULE IMPORT time in index.ts (crashes app boot). But library.ts loadLibrary() swallows per-entry parse errors and skips bad days — two different failure modes for the same gate.
- isDemo is a REQUIRED boolean (z.boolean(), not .optional()). Forgetting it fails validation. Hand-written content must set it true so the game labels it as demo.
- citations is a required z.array(z.string()) of PLAIN strings, not BiText. The key must be present (may be []). Same for provenance.generatedOn/sourceFile/model — plain strings.
- Exactly-one invariants are enforced by Zod .refine at runtime, invisible to tsc: a MicroQuestion needs exactly one isCorrect:true option; a DecisionPoint needs exactly one quality:'best' option. Zero or two throws.
- Count bounds also runtime-only: PatientCase.decisions must be 3–6, every option array (AnswerOption/DecisionOption) must be 2–5, findings ≥1, prep.chunks ≥1, treat.cases ≥1.
- sourceRef is a REQUIRED BiText on MicroQuestion but OPTIONAL on DecisionOption — easy to mix up. sourceQuote is a plain z.string() (not BiText) on both MicroQuestion and DecisionPoint.
- localStorage key is exactly 'clinic.library.v1'. saveToLibrary de-dupes by id (same id overwrites) and does NOT re-validate on save; loadLibrary DOES re-validate, so a stale-schema saved day silently vanishes on next load.
- saveToLibrary/removeFromLibrary swallow quota/write errors silently — a save can appear to succeed in-session yet never persist.
- track defaults to dental when omitted; only 'dental'|'medical' are valid. schemaVersion must be the literal 1.
- Do NOT precompute a flattened question bank in content files — that's derived at load time in src/game/questionBank.ts by design.
- Arabic strings intentionally keep clinical terms in English (e.g. 'المرحلة الثالثة — Stage III'); this is a deliberate convention, not a mistake to 'fix'.
- New day is invisible until you add both the import AND an entry in RAW_DAYS in src/content/index.ts — there is no auto-discovery of files in days/.

### §4 — The Import / AI Generation Pipeline

- Page numbers are 1-based throughout (extractDeck loops from i=1). Every sourcePage/sourceRef and the verify.ts neighbour search assume this — an off-by-one here silently breaks source verification.
- The Stage union declares { name: 'reading' } but runPipeline NEVER emits it — it starts at 'blueprint'. The caller does PDF extraction and presumably emits 'reading' itself. Don't assume runPipeline covers the reading stage.
- QUOTE_THRESHOLD = 0.75 (ordered WORD overlap, not substring) and the duplicate threshold is 0.85. verify.ts checks the cited page plus neighbours in the exact order [0,-1,1,-2,2] (±2 pages). An item failing 0.75 is dropped as 'unverified' even if the review model kept it.
- Two silent drop paths beyond the review model: an item with no verdict returned survives (pipeline.ts), but 'revise' with a null `revised` payload is dropped. Don't assume every generated item reaches the game.
- The API key sits in plaintext localStorage under 'clinic.apiKey.v1' and is sent from the browser with dangerouslyAllowBrowser:true. client.ts explicitly flags this as a publish blocker — acceptable only for a personal tool where the user supplies their own key. Must be proxied through a server before public launch.
- Model id is hard-coded: MODEL = 'claude-opus-4-8' in client.ts. It flows into provenance. Every stage uses effort 'xhigh' except the blueprint which uses 'high'.
- Generated content is deliberately English-only (all values are { en: ... }), which DIVERGES from the DentiPlan 'both locales or neither' rule. This is intentional for this game — do not 'fix' it by forcing Arabic.
- assembleDay's final line calls parseClinicDay(raw) — the same gate as hand-written content. If a generated field can't satisfy ClinicDay, the ENTIRE import throws at the last step, after all (paid) model calls have run. Schema drift between schemas.ts and content/schema.ts is a real trap.
- The Zod schemas and the hand-written *_JSON_SCHEMA consts are two parallel definitions of the same shape that must stay in sync; assembleDay.test.ts is said to enforce this. REVIEW_JSON_SCHEMA's `revised` reuses TOPIC_ITEMS_JSON_SCHEMA.properties.items.items, so editing the item schema also changes the review schema.
- generate() throws distinct errors on stop_reason 'refusal' and 'max_tokens' (default max_tokens is 32000). A too-large deck/topic can hit max_tokens; the surfaced message tells the user to try a smaller page range.
- looksScanned uses avg < 80 chars/page as the scanned-PDF heuristic — a legit but sparse deck (mostly images with captions) could false-positive.
- pooled() preserves input order but runs concurrency=3 by default; topic item-writing and review both fan out at this limit. Bumping concurrency risks per-minute rate limits (noted in the source comment).

### §5 — 3D Clinic Internals (r3f)

- gl.toneMapping MUST stay NoToneMapping — PostFX's ToneMapping(ACES) effect is the only tone-mapper. Enabling renderer tone-mapping double-maps and washes out the whole frame. They are a matched pair.
- The Canvas <color attach="background"> must be a hex STRING ('#f2e9dc'), never a float triple — a triple is read as already-linear (no sRGB), rendering the background washed-out and mismatched from the fog.
- gl.antialias is false on purpose; SMAA in PostFX does the AA. Turning on MSAA just doubles cost. Same for the composer's multisampling={0}.
- N8AO and DepthOfField are DESKTOP ONLY (gated on !isTouch), and enableNormalPass is also !isTouch — the normal pass exists solely for N8AO. Don't add a normal-pass effect on the mobile path.
- isTouchDevice() requires coarse pointer AND no fine pointer — NOT 'ontouchstart' in window, which is true on Windows touch-laptops and would kill mouse-look for them.
- Keyboard bindings use event.code (physical keys), never event.key — required for Arabic/non-Latin layouts. Escape is intentionally NOT handled in input.ts; it's the clinic's de-escalation ladder.
- moveInput and touchLook are module-level mutable singletons read every frame. Do NOT route them through React state — that would re-render 60x/s. touchLook is consumed (zeroed) each frame; DevProbe.look() accumulates (+=).
- Escape never quits directly: it closes an open panel, then releases pointer lock, then exits — in that order. 'close' mode ignores Escape entirely so a finished-day summary can't be dismissed by reflex.
- Environment environmentIntensity (~0.55) and the Studio surround color (#8f7f62, deliberately not near-white) are load-bearing for the palette — pushing either toward white makes ACES desaturate everything to paper.
- The Hands group is parented to nothing and manually copies camera.position + camera.quaternion each frame, because r3f's default camera is not in the scene graph so its children wouldn't render.
- ContactShadows uses frames={1} (renders once, frozen) with far={2.2} tuned below furniture height. There are ZERO shadow-casting real lights — grounding is entirely the frozen contact shadow. Don't add a shadow-casting light expecting it to 'just work'.
- Patient and DentalChair both sit at position [1.6, 0, -0.2]; the dental-chair COLLIDER is {x:1.0..2.2, z:-1.0..0.6}. The patient/chair positions and the collider box are maintained separately in layout.ts — keep them in sync if you move the chair.
- movement.stepPlayer resolves X then Z independently (per-axis slide) so angled collisions slide instead of stick; and rightFromForward's sign is the strafe invariant (D must move +X at yaw 0). movement.ts is pure specifically so this is unit-testable.
- DevProbe (window.__clinic) is DEV-only (import.meta.env.DEV) and exists because headless/automated panes report document.hidden, freezing rAF. Use __clinic.step() to advance frames by hand under frameloop='demand'.
- frameloop is 'demand' (not 'never') when not roaming, on purpose, so invalidate() and DevProbe.step() still work behind the overlay.
- Room is memo'd and Player/Patient/Hands read shared module state directly — adding new props that change every frame will defeat the memo and re-reconcile ~60 meshes per step.

### §6 — Screens, Cast & Question Bank

- Treat.tsx and scoring.ts BOTH hard-code `day.treat.cases[0]` — only the FIRST case of a day is ever played or scored, even though the schema allows `cases` to have many. DayClose also reads `cases[0].outcome`. Shipping a 2-case day would silently ignore case 2 and mis-tier if you naively summed. This is deliberate for v0.1 but a trap when authoring content.
- The cast face shown in Treat is NOT the written patient. `patientForCase(day.id, patient.age)` picks a CastPatient purely for the portrait art (id + mood JPGs); the name/age/history text still come from `patientCase.patient`. So the face and the written identity can be different people who merely share an age band. Don't assume `cast.name === patientCase.patient.name`.
- `seededShuffle` seeds are `index + 7` in Prep and `index + 13` in Treat — arbitrary constants, not meaningful. But because the seed is derived from the question index (not content), two different questions at the same index across days get the same permutation seed. Fine for now; matters if you ever build cross-day recall from questionBank.
- `buildQuestionBank` uses `day.treat.cases[c].decisions` for ALL cases (not just cases[0]) — it iterates every case. So the derived bank is broader than what Treat actually plays. If you wire the RECALL queue to the bank, students will get recall items from cases they never saw in-game.
- `day.track` is OPTIONAL and defaults to 'dental' EVERYWHERE it's read (`subjectsFor` uses `day.track ?? 'dental'`). A hand-written medical day that forgets `track: 'medical'` will silently vanish from the medical schedule and appear under dental. Import.tsx guards against this by force-stamping `track` from the signed-in profile via `saveToLibrary({ ...result.day, track })`.
- Portrait art is fail-soft: `PatientFace` swaps to the `patientCase.patient.avatar` emoji on image `onError`. So a missing `public/characters/<id>-<mood>.jpg` degrades to an emoji rather than a broken image — meaning missing art is easy to not notice. All four moods (calm/anxious/pain/relieved) plus `-body` must be sliced per doctor/patient id or you'll silently see emoji fallbacks.
- `buildQuestionBank` and the `BankQuestion` type are currently DEAD as far as the UI goes — nothing renders them. Only `seededShuffle` from that file is live. Don't assume the recall/CLEAR queue exists; it's the next planned feature, not shipped.
- The non-null assertions in questionBank.ts (`decisions...find(o => o.quality==='best')!`) and Treat.tsx depend on the Zod `.refine()` invariants (exactly one correct option / exactly one 'best' decision). They are only safe because content was parsed through `parseClinicDay`. Injecting an un-parsed day object could crash these.
- Import.tsx UI copy is almost entirely English inline strings (only `backToTablet` uses `t()`), unlike every other screen. This violates the repo's usual both-locales rule and is a known locale gap on that screen.
- The API key in Import.tsx is stored in the browser and sent directly to Anthropic from the client — the screen itself warns this must move behind a server before any public deploy. Do not ship the current Import flow publicly as-is.

### §7 — Build, Tooling, PWA & i18n

- `npm run typecheck` only checks `src` (tsconfig.app.json). `npm run build` runs `tsc -b` which ALSO type-checks vite.config.ts (tsconfig.node.json). A type error in vite.config.ts passes typecheck but fails build — always run the full build/`tsc -b` for tooling/config changes.
- The `test` script is a hand-maintained `&&` chain of `tsx <file>.test.ts` runs, not a test framework. A new co-located `*.test.ts` will NOT run until you add it to the chain in package.json, and the chain stops at the first failure.
- `devFileDrop` `/__drop` and `/__ref` endpoints are DEV-ONLY (`apply: 'serve'`) — they do not exist under `vite preview` or in `dist/`. Don't rely on them at runtime; don't promote the pattern (no auth beyond path-confinement to `reference/`).
- `server.watch.ignored: ['**/reference/**']` exists because watching large binaries there crashes Vite with EBUSY on Windows (Yaman's OS). Do not remove it.
- The `language` translation key is the toggle-button LABEL and holds the OTHER language's name on purpose: en.ts `language: 'العربية'`, ar.ts `language: 'English'`. It is not the current language name.
- `ar.ts` is typed `Record<keyof typeof en, string>`, so Arabic UI strings are compiler-enforced-exhaustive — omitting a key is a build error. But content `BiText.ar` is OPTIONAL and falls back to English. Two different completeness rules for the two i18n layers.
- `pickText` uses a truthiness check on `text.ar`, so an empty-string `ar` ('') falls back to English (asserted in pickText.test.ts), not rendered as a blank.
- RTL is applied at `document.documentElement` (`dir`/`lang`) by a useEffect in LocaleProvider — not per component. Use the context's `dir` (1|-1) to flip animated x-offsets; `isRtl` for layout branches.
- LocaleProvider is the ONLY writer of the save's `locale` field; it read-modify-writes loadSave() to avoid clobbering concurrent progress saves. Don't write `locale` from elsewhere.
- `erasableSyntaxOnly` is enabled in both tsconfigs — no TS enums / parameter properties / runtime namespaces. Use `as const` objects + Zod, matching existing patterns.
- Vite comments reference 'Phaser's chunk' but there is no phaser dependency; the large precached/warned chunk is actually three.js (lazy-imported by the clinic). Trust the numbers (4MB precache limit, 1600 chunk warning), not the stale label.
- `useLocale()` throws if used outside `LocaleProvider`. Default locale is 'en' (save.ts). TypeScript is 6.x pinned with `~` (patch-only); neither tsconfig sets `strict:true` — strictness comes from individual noUnused*/noFallthrough flags.


---

---

## Appendix B — Verifying visual changes

### The normal case (you have a real browser)

Run `npm run dev`, open `http://localhost:5173`, sign in (name + pick a doctor → sets your track), pick a subject, click a day → **Enter the clinic**. Walk with WASD / arrows, look with the mouse (click to lock the pointer), `E` to interact, `Esc` to back out. Just look at it. Done.

### The headless case (automated agent, non-compositing browser pane)

If your browser pane does **not** composite frames (screenshots time out, the canvas is present but never renders), you're in the same situation this project was verified in. Two things are missing from the pane and both must be shimmed **before the Canvas mounts**:

1. `requestAnimationFrame` never fires (the pane reports `document.hidden`).
2. `ResizeObserver` never delivers a callback — and r3f measures its canvas size through a **rAF-debounced** ResizeObserver (`react-use-measure`). No rAF ⇒ size never commits ⇒ r3f never boots ⇒ `canvas.__r3f` and `window.__clinic` never appear.

Working recipe (run in the page console / JS eval **while on the tablet screen, before entering the clinic**, then click into the clinic):

```js
// 1) Shim rAF → setTimeout so r3f's measurement + render loop run.
if (!window.requestAnimationFrame.__shim) {
  const raf = (cb) => setTimeout(() => cb(performance.now()), 16);
  raf.__shim = true;
  window.requestAnimationFrame = raf;
  window.cancelAnimationFrame = (id) => clearTimeout(id);
}
// 2) Stub ResizeObserver to report size immediately.
if (!window.ResizeObserver.__shim) {
  const RO = class { constructor(cb){this.cb=cb;} observe(el){const r=el.getBoundingClientRect(); this.cb([{target:el,contentRect:r}],this);} unobserve(){} disconnect(){} };
  RO.__shim = true;
  window.ResizeObserver = RO;
}
// If the clinic already mounted before the shims, click "Leave" then re-enter
// so a FRESH Canvas mount picks them up.
```

Once mounted, `window.__clinic` (from `src/clinic/DevProbe.tsx`, dev builds only) exposes: `step(dt?)`, `setMove(x,z)`, `look(dx,dy)`, `pos()`, `setPos(x,z)`, `size()`, `sceneObjects()`, `drawCalls()`, `triangles()`. Capture a frame and write it to disk via the dev-only middleware:

```js
const c = window.__clinic;
c.setPos(0.2, 2.2);            // move to a vantage
c.step();                      // render one frame
const canvas = document.querySelector('canvas');
const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
await fetch('/__drop', { method:'POST', headers:{ 'x-filename':'shot.jpg' }, body: blob });
// → writes reference/shot.jpg (POST the Blob, NOT the dataURL string)
```

`/__drop` and `/__ref` are defined in `vite.config.ts` (`devFileDrop`, `apply:'serve'`) and only exist in dev. Writes are confined to `reference/`.

### Starting the dev server from an automated harness (Windows gotcha)

The preview launcher splits on the space in `C:\Program Files\nodejs\npm.cmd`. If `preview_start`-style launching fails with `'C:\Program' is not recognized`, point `runtimeExecutable` at the 8.3 short path in `.claude/launch.json`: `"C:/PROGRA~1/nodejs/npm.cmd"`. (A human just runs `npm run dev`.)

---

## Appendix C — Outstanding work & where to start

**Requested by the owner, not yet built:**
- **Flashcards / active-recall / "revise" mode** at the study desk — explicitly asked for. `src/game/questionBank.ts` (`buildQuestionBank`) is the intended substrate (see §6). This is the highest-value *gameplay* gap.
- **Deeper, longer cases** — 5-line clinical stems that require real reasoning; the two seed days are short-stem.
- **Multiplayer** (friends study/solve a case together) — mentioned early, untouched.

**Graphics (full costed plan in `GRAPHICS_ROADMAP.md`):**
- Phase 1 — patient → real rigged GLB character (Tripo/Meshy ~$20 → Mixamo animations) wired to the existing `mood` states. *Biggest visual impact.* `src/clinic/Patient.tsx` is the documented swap point.
- Phase 2 — bake room lighting in Blender (free; biggest "studio" lever; needs Blender labor).
- Phase 3 — real GLB props (free Quaternius/Kenney CC0 + one bought dental unit), KTX2 + meshopt compression.
- Phase 4 — clean gradient/PBR textures + LUT.
- Phase 5 — **sound design + music** (free CC0 / AI audio) — hugely underrated for perceived quality; can be started solo anytime.
- Phase 6 — draw-call merge + LODs + 60fps mobile (needs a texture-atlas/vertex-color approach so it doesn't kill per-material reflections).

**Recommended first moves for a solo dev:** Phase 1 (living patient) + Phase 5 (sound) give the biggest perceived-quality jump per dollar/hour; then Phase 2 (baked room). Don't chase photoreal, don't switch engines.

**A good first *code* task to warm up:** the flashcards/revise mode — it's pure gameplay, deterministic, no new deps, and exercises the content/scoring/i18n systems you'll need to know anyway.

---

## Appendix D — Housekeeping notes

- **Stale comment:** `vite.config.ts` (workbox block) says *"Phaser's chunk is large."* Phaser + the 2D arcade "runner" were **deleted** earlier (owner's call — "the runner is for suckers"); there is no `phaser` dependency anymore. The comment and the 4 MB `maximumFileSizeToCacheInBytes` bump are leftovers — harmless, but update them if you touch that file (one concern per commit).
- **`reference/`** holds ~260 KB of dev-only art-direction media (progression screenshots + frame-sheets from the owner's two Seedance style clips). It is git-ignore-worthy and is excluded from the Vite watcher (`server.watch.ignored`) and the build. Do not ship it.
- **The two Seedance clips** are the visual north star: warm, clean, stylized (see `reference/video-frames.jpg`, `reference/video2-frames.jpg`). Match that, don't exceed it.
- **PWA manifest** theme/background is a dark `#0b1220` while the in-game palette is warm cream — intentional (splash vs. content), but worth knowing if you touch branding.
- **`registerType: 'prompt'`** on the PWA means the service worker asks before updating — a stale SW would otherwise serve last week's clinic days.

---

*End of handoff. If anything here disagrees with the code, the code wins — and please fix the doc.*
