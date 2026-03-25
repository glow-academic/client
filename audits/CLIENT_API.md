# Client API Audit — API Call Type Safety Check

You are a client API type safety auditor for the GLOW project. Your job is to verify that all client-side API calls use the auto-generated OpenAPI types (`InputOf` / `OutputOf`) instead of hand-crafted types. You do NOT fix anything. You REPORT errors, inconsistencies, and violations.

The source of truth for API types is the OpenAPI schema generated via `make openapi-gen` and consumed through:
- `client/lib/api/schema.ts` — auto-generated OpenAPI types
- `client/lib/api/types.ts` — `InputOf<Path, Method>` and `OutputOf<Path, Method>` type helpers
- `client/lib/api/client.ts` — typed `api.post()` / `api.get()` client

Run each audit step in order. For each step, inspect the files and compare against the rules. Collect all errors into a final report at the end.

---

## The Type Flow

```
server/openapi.json
    ↓ make gen-client-types
client/lib/api/schema.ts (paths, components)
    ↓ import
client/lib/api/types.ts (InputOf, OutputOf, PathKey)
    ↓ import
client/app/(main)/**/page.tsx (type aliases + server actions)
```

Every client-side API call must derive its input and output types from this chain. No hand-crafted types that duplicate the OpenAPI schema.

---

## The Layers

| Layer | Location | Purpose |
|-------|----------|---------|
| **Schema** | `client/lib/api/schema.ts` | Auto-generated OpenAPI types (never hand-edit) |
| **Type Helpers** | `client/lib/api/types.ts` | `InputOf` / `OutputOf` extraction from schema |
| **API Client** | `client/lib/api/client.ts` | Typed `api.post()` / `api.get()` with generic constraints |
| **Page Actions** | `client/app/(main)/**/page.tsx` | Server actions with `InputOf` / `OutputOf` type aliases |
| **Components** | `client/components/**/*.tsx` | Consume typed data from pages (no direct API calls) |

---

## The Correct Pattern

Every page that makes API calls should follow this structure:

```typescript
import { InputOf, OutputOf } from "@/lib/api/types";
import { api } from "@/lib/api/client";

// 1. Type aliases derived from OpenAPI
type ListOut = OutputOf<"/api/v5/artifacts/agents/list", "post">;
type DuplicateIn = InputOf<"/api/v5/artifacts/agents/duplicate", "post">;
type DuplicateOut = OutputOf<"/api/v5/artifacts/agents/duplicate", "post">;

// 2. Server actions using derived types
async function duplicateAgent(input: DuplicateIn): Promise<DuplicateOut> {
  "use server";
  return api.post("/artifacts/agents/duplicate", input);
}
```

Reference: `client/app/(main)/intelligence/agents/page.tsx`

---

## The Rules

### Rule 1: Every page must use `InputOf` / `OutputOf` for API types

Every `page.tsx` file that makes API calls must define type aliases using `InputOf<Path, Method>` and `OutputOf<Path, Method>`. Types must NOT be hand-crafted interfaces or type literals that duplicate the OpenAPI contract.

**Correct:**
```typescript
type AgentsListOut = OutputOf<"/api/v5/artifacts/agents/list", "post">;
```

**Incorrect:**
```typescript
interface AgentsListOut {
  items: { id: string; name: string; ... }[];
  total: number;
}
```

### Rule 2: No `as any` on API paths or responses

The typed `api.post()` client constrains the path parameter to valid OpenAPI paths. Using `as any` on the path string or the response bypasses the entire type safety chain.

**Incorrect:**
```typescript
await api.post("/resources/provider_keys" as any, { body: { ... } });
return result as { provider_keys_id?: string | null };
```

**Correct:** If the path doesn't typecheck, the endpoint is missing from the OpenAPI schema. Fix the schema, don't bypass types.

### Rule 3: No raw `fetch()` calls that bypass the typed API client

All API calls from page files and component files must go through the typed `api` client (`client/lib/api/client.ts`). Raw `fetch()` calls bypass type checking entirely.

**Exception:** Route Handlers in `client/app/api/` (Next.js API routes) may use `fetch()` for server-to-server proxy calls, since these are internal infrastructure, not client-facing API consumers.

### Rule 4: No `@ts-ignore` or `@ts-nocheck` on files with API calls

Files that contain API calls must not suppress TypeScript errors. Type errors indicate contract drift between the OpenAPI schema and the client code.

### Rule 5: Server action return types must use `OutputOf`

Every `async function` server action that calls `api.post()` or `api.get()` must declare its return type as `Promise<OutputOf<Path, Method>>` (or a type alias thereof). Hand-crafted return types drift from the schema.

**Correct:**
```typescript
async function getAgentsList(body: AgentsListBody): Promise<AgentsListOut> {
  "use server";
  return api.post("/artifacts/agents/list", { body });
}
```

**Incorrect:**
```typescript
async function getAgentsList(body: any): Promise<{ items: any[]; total: number }> {
  "use server";
  return api.post("/artifacts/agents/list", { body });
}
```

### Rule 6: Server action input types must use `InputOf`

Every server action input parameter must be typed using `InputOf<Path, Method>` (or a derived sub-type like extracting just the `body` field). Hand-crafted input types drift from the schema.

### Rule 7: No hand-crafted types that duplicate OpenAPI types

Files must not define `type` or `interface` declarations that replicate the shape of an OpenAPI request or response. If a type is needed for a subset of the response, it should be derived from `OutputOf` using TypeScript utility types (e.g., `Pick`, indexed access).

**Correct:**
```typescript
type AgentsListOut = OutputOf<"/api/v5/artifacts/agents/list", "post">;
type AgentItem = AgentsListOut["items"][number];
```

**Incorrect:**
```typescript
interface AgentItem {
  id: string;
  name: string;
  description: string;
  // ... manually transcribed from API response
}
```

---

## Audit Checks

### Audit 1: Pages missing `InputOf` or `OutputOf` imports

```bash
# Find all page.tsx files that import from api/client but don't import InputOf/OutputOf
for file in $(grep -rl "from.*@/lib/api/client" client/app/\(main\)/ --include="*.tsx"); do
  grep -qE "InputOf|OutputOf" "$file" || echo "MISSING InputOf/OutputOf: $file"
done
```

**Expected**: Empty. Every page that uses the API client should also import type helpers.

### Audit 2: `as any` on API client calls

```bash
# Find 'as any' near api.post/api.get calls
grep -rn "api\.\(post\|get\|put\|patch\|delete\).*as any" client/app/ --include="*.tsx"
grep -rn "as any.*api\.\(post\|get\|put\|patch\|delete\)" client/app/ --include="*.tsx"

# Find 'as any' on path strings passed to API client
grep -rn '"\/[a-z].*" as any' client/app/ --include="*.tsx"
```

**Expected**: Empty. No type assertions on API calls.

### Audit 3: `as any` on API response usage

```bash
# Find 'as any' or 'as {' type assertions on API return values
grep -rn "return.*as any" client/app/ --include="*.tsx" | grep -v "node_modules"
grep -rn "return.*as {" client/app/ --include="*.tsx" | grep -v "node_modules"

# Find result variables cast with 'as any'
grep -rn "result as any\|response as any\|data as any" client/app/ --include="*.tsx"
```

**Expected**: Empty. API responses should flow through without type casting.

### Audit 4: Raw `fetch()` calls in page/component files

```bash
# Find fetch() in page files (should use api client instead)
grep -rn "\bfetch(" client/app/\(main\)/ --include="*.tsx"
grep -rn "\bfetch(" client/components/ --include="*.tsx"

# Exclude: client/app/api/ (Route Handlers are allowed to use fetch)
```

**Expected**: Empty. All API calls should go through the typed client.

### Audit 5: `@ts-ignore` or `@ts-nocheck` in files with API calls

```bash
# Find ts-ignore/ts-nocheck in files that also use the api client
for file in $(grep -rl "api\.\(post\|get\|put\|patch\|delete\)" client/app/ --include="*.tsx"); do
  grep -n "@ts-ignore\|@ts-nocheck\|@ts-expect-error" "$file" && echo "  ^ in: $file"
done
```

**Expected**: Empty.

### Audit 6: Server actions with hand-crafted return types

```bash
# Find server action functions with inline return types (not type aliases)
# Pattern: ): Promise<{ ... }> { (inline object type instead of alias)
grep -rn "): Promise<{" client/app/\(main\)/ --include="*.tsx"
```

**Expected**: Empty. All server actions should use OutputOf-derived type aliases.

### Audit 7: Server actions with `any` typed parameters

```bash
# Find server actions with 'any' in parameter types
grep -rn "async function.*input: any\|body: any\|params: any" client/app/\(main\)/ --include="*.tsx"
```

**Expected**: Empty. All parameters should use InputOf-derived types.

### Audit 8: Hand-crafted interfaces that look like API types

```bash
# Find interface/type declarations that contain common API response fields
# These may be hand-crafted duplicates of OpenAPI types
grep -rn "^\(export \)\?\(interface\|type\) .*\(Response\|Request\|Payload\|ApiResult\)" \
  client/app/\(main\)/ --include="*.tsx" | grep -v "InputOf\|OutputOf"
```

**Expected**: Empty or justified. Manual response/request types suggest schema bypass.

### Audit 9: `eslint-disable` comments suppressing type errors near API calls

```bash
# Find eslint-disable comments near API usage
grep -rn "eslint-disable.*no-explicit-any\|eslint-disable.*no-unsafe" client/app/\(main\)/ --include="*.tsx"
```

**Expected**: Empty. Suppressed type warnings near API calls indicate contract drift.

### Audit 10: Pages with API calls but no OpenAPI type imports

```bash
# Find pages that call api.post/api.get but don't import from types.ts
for file in $(grep -rl "api\.post\|api\.get\|api\.put\|api\.patch\|api\.delete" \
  client/app/\(main\)/ --include="*.tsx"); do
  grep -q "from.*@/lib/api/types" "$file" || echo "NO TYPE IMPORT: $file"
done
```

**Expected**: Empty. Every file making API calls should import type helpers.

---

## Running the Audit

### Prerequisites

```bash
# Ensure OpenAPI schema is current
make openapi-gen
make gen-client-types
```

### Execution

Run each audit check from the project root. For filesystem checks, use the bash commands above.

---

## Report Format

For each audit that returns results, report:

```
AUDIT {N}: {Title}
RULE VIOLATED: Rule {N}
ITEMS FOUND: {count}
DETAILS:
  - {file}:{line}: {description of violation}
  - ...
```

For audits that return no results:

```
AUDIT {N}: {Title} — PASS
```

End with a summary:

```
SUMMARY
=======
Total audits: 10
Passed: {N}
Failed: {N}

TYPE SAFETY COVERAGE
====================
Pages with API calls: {N}
Pages using InputOf/OutputOf: {N}
Pages with type bypasses (as any): {N}
Pages with raw fetch(): {N}
Pages with hand-crafted API types: {N}

KNOWN EXCEPTIONS
================
- client/app/api/* (Route Handlers — allowed to use fetch())
- {list any other approved exceptions}
```

---

## Important Notes

1. **Do NOT fix anything**. This is a read-only audit. Report only.
2. **The OpenAPI schema is the source of truth** for all API types. `client/lib/api/schema.ts` is auto-generated and must never be hand-edited.
3. **`InputOf` / `OutputOf` are the only approved type extraction patterns.** Any other mechanism (manual interfaces, `any`, type assertions) is a violation.
4. **Known exceptions**:
   - `client/app/api/` Route Handlers may use `fetch()` for server-to-server proxy calls
   - Components in `client/components/` receive typed props from pages — they don't make API calls directly and are not audited for InputOf/OutputOf usage
5. **Type bypasses indicate schema gaps.** When `as any` is found, the root cause is usually a missing or mismatched endpoint in the OpenAPI spec. The fix is to update the server endpoint and regenerate types, not to add type assertions.
6. **Run this after any OpenAPI schema change** to catch regressions where client types drift from the server contract.
