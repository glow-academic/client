# NUQS Audit: URL Search Param Management

## Gold Standard Pattern (Persona)

The persona pages demonstrate the canonical three-layer nuqs pattern. All search params flow through this architecture:

```
1. lib/search-params/*.ts       — Server-side parser schema (nuqs/server)
2. page.tsx (server component)  — Loads params via createLoader, fetches data
3. Client component             — Client-side parsers via useQueryStates (nuqs)
```

### What "correct" looks like

**Server-side schema** (`lib/search-params/personas.ts`):
- Imports from `"nuqs/server"` only
- Defines a flat object of parser declarations (`parseAsString`, `parseAsArrayOf`, `parseAsInteger`)
- Exports a `createLoader()` for server components
- Uses `parseAsArrayOf(parseAsString)` for multi-select arrays (standard nuqs encoding: `?key=a&key=b`)

**Server page** (`page.tsx`):
- Awaits `searchParams` Promise (Next.js 15+ convention)
- Converts to `URLSearchParams` and passes to `loadXxxSearchParams()`
- Uses parsed values to make server-side API calls
- Passes **computed data** (not raw URL strings) as props to client components

**Client component** (artifact form):
- Defines matching client-side parsers (imported from `"nuqs"`, not `"nuqs/server"`)
- Passes parsers to `GenericForm` via `nuqsParsers` prop
- `GenericForm` calls `useQueryStates(parsers, { history: "replace", shallow: false })`
- `shallow: false` triggers server re-render on URL change (full-loop server-driven)

---

## Audit Rules

### Rule 1: Server-Side Schema in `lib/search-params/`

Every page that uses URL search params MUST have a corresponding file in `client/lib/search-params/` defining:
- A parser object using `nuqs/server` imports
- A `createLoader()` export

**Why**: Centralizes parser definitions, ensures server/client use the same param names, enables shared schemas across related pages.

| Page | Has Schema File | Status |
|------|----------------|--------|
| Personas list | `personas.ts` | PASS |
| Scenarios list | `scenarios-list.ts` | PASS |
| Simulations list | `simulations.ts` | PASS |
| Cohorts list | `cohorts.ts` | PASS |
| Dashboard | `dashboard.ts` | PASS |
| Reports | `reports.ts` | PASS |
| Pricing | `pricing.ts` | PASS |
| Activity | `activity.ts` | PASS |
| Practice | `practice.ts` | PASS |
| Leaderboard | `leaderboard.ts` | PASS |
| Health | `health.ts` | PASS |
| Home | `home.ts` | PASS |
| Benchmark | `benchmark.ts` | PASS |
| Profile Report | `profile-report.ts` | PASS |
| Scenario detail | `scenarios.ts` | PASS |
| Persona detail/new | Inline in page.tsx | WARN |
| All other detail/new pages | Inline in page.tsx | WARN |

**Recommendation**: Detail/new pages define parsers inline in the page file rather than in `lib/search-params/`. This is acceptable since they're only consumed in one place, but consider extracting to `lib/search-params/` for consistency.

---

### Rule 2: Use Standard nuqs Parsers (No Custom Comma-Separated Arrays)

Arrays MUST use `parseAsArrayOf(parseAsString)` which encodes as `?key=a&key=b` (standard nuqs/URL encoding). Custom `parseAsCommaSeparatedArray` parsers (`?key=a,b,c`) are non-standard and create problems:
- Duplicated parser code (defined in BOTH `lib/search-params/analytics.ts` AND `hooks/use-analytics-params.ts`)
- Non-standard URL encoding breaks interoperability
- Comma-separated values can't contain commas

| Page/Module | Parser Used for Arrays | Status |
|-------------|----------------------|--------|
| Personas list | `parseAsArrayOf(parseAsString)` | PASS |
| Scenarios list | `parseAsArrayOf(parseAsString)` | PASS |
| Simulations list | `parseAsArrayOf(parseAsString)` | PASS |
| Cohorts list | `parseAsArrayOf(parseAsString)` | PASS |
| Analytics (shared) | `parseAsCommaSeparatedArray` (custom) | FAIL |
| Dashboard | Inherits analytics custom parser | FAIL |
| Reports | Inherits analytics custom parser | FAIL |
| Pricing | Inherits analytics custom parser | FAIL |
| Activity | Inherits analytics custom parser | FAIL |
| Practice | Inherits analytics custom parser | FAIL |
| Leaderboard | Inherits analytics custom parser | FAIL |
| Health | Inherits analytics custom parser | FAIL |
| Home | Inherits analytics custom parser | FAIL |
| Benchmark | Inherits analytics custom parser | FAIL |
| Profile Report | Inherits analytics custom parser | FAIL |

**Failing files**:
- `client/lib/search-params/analytics.ts` — defines `parseAsCommaSeparatedArray`
- `client/hooks/use-analytics-params.ts` — duplicates the same custom parser

---

### Rule 3: No Duplicated Parser Definitions

Parser objects MUST be defined once and shared. The same parsers should not be redefined in separate files.

| Parser Set | Defined In | Status |
|-----------|-----------|--------|
| `analyticsSearchParams` (server) | `lib/search-params/analytics.ts` | — |
| `analyticsParamsClient` (client) | `hooks/use-analytics-params.ts` | FAIL (duplicate) |
| `parseAsCommaSeparatedArray` (server) | `lib/search-params/analytics.ts` | — |
| `parseAsCommaSeparatedArray` (client) | `hooks/use-analytics-params.ts` | FAIL (duplicate) |

**Why this matters**: If someone adds a new field to the server schema but forgets the client hook (or vice versa), the parsers silently drift apart.

**Fix**: Export parsers from a shared file that works in both server and client contexts, or import the parser object from the schema file into the client hook.

---

### Rule 4: Client Components Must Use `useQueryStates` (Not `router.push` + `URLSearchParams`)

Client components that update URL search params MUST use `useQueryStates` from nuqs instead of manually constructing URLs with `router.push()` / `router.replace()` + `new URLSearchParams()`.

| Component | Method Used | Status |
|-----------|------------|--------|
| `GenericForm.tsx` | `useQueryStates()` | PASS |
| `use-analytics-params.ts` | `useQueryStates()` | PASS |
| `TrainingBundle.tsx` | `useQueryStates()` | PASS |
| `Agent.tsx` | `useQueryStates()` | PASS |
| **Personas.tsx** (list) | `router.push()` + `URLSearchParams` | **FAIL** |
| **Scenarios.tsx** (list) | `router.push()` + `URLSearchParams` | **FAIL** |
| **Simulations.tsx** (list) | `router.push()` + `URLSearchParams` | **FAIL** |
| **Cohorts.tsx** (list) | `router.push()` + `URLSearchParams` | **FAIL** |
| **SimulationHistory.tsx** | `router.replace()` + `URLSearchParams` | **FAIL** |
| **Activity.tsx** | `router.push()` + `URLSearchParams` | **FAIL** |
| **SaveToolbar.tsx** | `router.replace()` + `URLSearchParams` | **FAIL** |
| **AnalyticsFilters.tsx** | `router.replace()` | **FAIL** |

**Why this matters**: Manual URL construction bypasses nuqs entirely on the client, meaning:
- No type safety on param names or values
- No `shallow: false` server re-render trigger (must manually handle)
- Param serialization can diverge from the server schema
- Loss of batched updates (nuqs batches multiple `setParams` calls into one URL update)

---

### Rule 5: `useSearchParams()` Should Not Be Used for nuqs-Managed Params

Components should NOT import `useSearchParams()` from `next/navigation` to read params that are already defined in a nuqs schema. Use `useQueryStates` instead.

| Component | Uses `useSearchParams()` | Status |
|-----------|------------------------|--------|
| `Personas.tsx` (list) | Yes — reads all filter params | **FAIL** |
| `Scenarios.tsx` (list) | Yes — reads all filter params | **FAIL** |
| `Simulations.tsx` (list) | Yes — reads all filter params | **FAIL** |
| `Cohorts.tsx` (list) | Yes — reads all filter params | **FAIL** |
| `SimulationHistory.tsx` | Yes — reads history params | **FAIL** |
| `Activity.tsx` | Yes — reads activity params | **FAIL** |
| `SaveToolbar.tsx` | Yes — reads draftId | **FAIL** |
| `AnalyticsFilters.tsx` | Yes — reads filter params | **FAIL** |

---

### Rule 6: Options Must Use `{ history: "replace" }` to Avoid Back-Button Spam

All `useQueryStates` calls MUST specify `{ history: "replace" }` so that filter changes don't create new browser history entries.

| Usage | history option | Status |
|-------|---------------|--------|
| `GenericForm.tsx` | `"replace"` | PASS |
| `use-analytics-params.ts` | `"replace"` | PASS |
| `TrainingBundle.tsx` | `"replace"` | PASS |
| `Agent.tsx` | `"replace"` | PASS |

All current `useQueryStates` usages pass. The failing components in Rule 4 don't use `useQueryStates` at all.

---

### Rule 7: `shallow: false` for Server-Driven Data Fetching

When the server component fetches data based on URL params, the client-side `useQueryStates` MUST use `{ shallow: false }` so URL changes trigger a server re-render and fresh data fetch.

| Usage | shallow option | Status |
|-------|---------------|--------|
| `GenericForm.tsx` | `false` | PASS |
| `use-analytics-params.ts` | `false` | PASS |
| `TrainingBundle.tsx` | `true` | WARN |
| `Agent.tsx` (direct call) | `true` | WARN |

**Note**: `shallow: true` is acceptable when the component handles its own data fetching client-side and doesn't rely on server component re-renders.

---

### Rule 8: Server Page Must Use `loadXxxSearchParams()` (Not Manual Param Parsing)

Server pages MUST use the `createLoader`-generated function to parse params. They should NOT manually read `searchParams.get("key")`.

All current server pages use `loadXxxSearchParams()`. **PASS** across the board.

---

### Rule 9: `searchParams` Must Be Typed as `Promise<Record<string, string | string[] | undefined>>`

Server pages MUST use the Next.js 15+ async `searchParams` type.

All current server pages use this type. **PASS** across the board.

---

### Rule 10: NuqsAdapter Must Wrap the App

The root `providers.tsx` MUST include `<NuqsAdapter>` from `nuqs/adapters/next/app`.

`client/app/providers.tsx` wraps the app with `NuqsAdapter`. **PASS**.

---

## Summary

| Rule | Description | Pass | Fail | Warn |
|------|-------------|------|------|------|
| 1 | Schema in `lib/search-params/` | 15 | 0 | ~16 |
| 2 | Standard parsers (no custom comma arrays) | 4 | 10 | 0 |
| 3 | No duplicated parser definitions | 0 | 2 | 0 |
| 4 | Client uses `useQueryStates` not `router.push` | 4 | 8 | 0 |
| 5 | No `useSearchParams()` for nuqs-managed params | 0 | 8 | 0 |
| 6 | `history: "replace"` | 4 | 0 | 0 |
| 7 | `shallow: false` for server-driven | 2 | 0 | 2 |
| 8 | Server uses `loadXxxSearchParams()` | All | 0 | 0 |
| 9 | Async `searchParams` typing | All | 0 | 0 |
| 10 | `NuqsAdapter` in providers | 1 | 0 | 0 |

## Priority Fixes

### P0 — Analytics Custom Parser Migration
Replace `parseAsCommaSeparatedArray` with `parseAsArrayOf(parseAsString)` across:
- `client/lib/search-params/analytics.ts`
- `client/hooks/use-analytics-params.ts`
- All 10 analytics pages that inherit from `analyticsSearchParams`

This is a URL format change (`?cohortIds=a,b` -> `?cohortIds=a&cohortIds=b`) that requires updating any bookmarked/shared links.

### P1 — List Page Client Components
Migrate these from `router.push()` + `URLSearchParams` to `useQueryStates`:
- `Personas.tsx` (list)
- `Scenarios.tsx` (list)
- `Simulations.tsx` (list)
- `Cohorts.tsx` (list)

### P2 — Shared Components
Migrate these from manual URL management to nuqs:
- `SimulationHistory.tsx`
- `Activity.tsx`
- `SaveToolbar.tsx`
- `AnalyticsFilters.tsx`

### P3 — Eliminate Duplicate Parsers
Consolidate `analyticsParamsClient` in `use-analytics-params.ts` to import from `lib/search-params/analytics.ts` instead of redefining.
