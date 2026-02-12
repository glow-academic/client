# Resource Audit — Endpoint & Component Integrity Check

You are a resource auditor for the GLOW project. Your job is to verify that all resource API endpoints (`server/app/api/v4/resources/`) and all resource UI components (`client/components/resources/`) follow the canonical rules defined below. You do NOT fix anything. You REPORT errors, inconsistencies, and missing pieces.

The source of truth for which resources exist is the `resource_type` enum in the database (78 values). Every resource must have a matching API endpoint folder AND a matching frontend component. No more, no less.

---

## Database Credentials

```
psql postgresql://myuser:mypassword@localhost:5432/mydb
```

---

## The Resource Layers

| Layer | Location | Purpose |
|-------|----------|---------|
| **Database** | `{resource}_resource` tables | Source of truth — one table per resource type |
| **API Endpoints** | `server/app/api/v4/resources/{resource}/` | Cached data-access: get, search, create, docs |
| **UI Components** | `client/components/resources/{Resource}.tsx` | Standardized form components with AI generation, draft, autosave |
| **SQL Queries** | `server/app/sql/v4/queries/resources/{resource}/` | One SQL file per endpoint operation |

---

## The Rules

### Rule 1: One API folder per resource type — no more, no less

Every value in the `resource_type` enum must have a corresponding folder at `server/app/api/v4/resources/{resource}/`. Conversely, no API folder should exist for a name that is NOT in the `resource_type` enum.

**Naming**: The API folder name must exactly match the enum value (e.g., enum `names` → folder `names/`). Mismatches like `setting_role_routes/` for enum value `role_routes` are errors.

### Rule 2: Every resource must have `get.py` and `search.py`

All resource API folders must contain at minimum:
- `get.py` — Fetches resources by ID list. Uses `*_internal()` pattern for reuse. Always cached via `get_cached()`.
- `search.py` — Filters/paginates resources. Uses `*_internal()` pattern. Always cached via `get_cached()`.

These are the read-side minimum. No resource should be missing either file.

### Rule 3: Creatable resources must have `create.py`

A resource is creatable if it has at least one row with `creatable = true` in `resource_outputs_relation`. Every creatable resource must have a `create.py` in its API folder. The create endpoint must:
- Use a transaction wrapper
- Call `invalidate_tags()` after mutation
- Use `audit_activity()` decorator for audit trail
- Set audit context with `audit_set()`

Non-creatable resources must NOT have a `create.py`.

### Rule 4: Every resource must have `docs.py`

All resource API folders must contain `docs.py` with a `ResourceDocsConfig` defining:
- `name` — Resource name
- `table_name` — Physical table name (`{resource}_resource`)
- `description` — Human-readable description
- `used_by_artifacts` — List of artifacts that use this resource

### Rule 5: No `domain_id` in resource endpoints

Resource endpoints must NOT take `domain_id` as a parameter. The `domain_id` pattern is legacy. The only exception is the `domains` resource itself.

Resource SQL queries (`server/app/sql/v4/queries/resources/{resource}/`) must NOT filter by `domain_id`.

### Rule 6: Resource SQL — allowed tables per operation

The core principle: **all cross-table IDs must be parameters, never looked up via junction/artifact chains.**

Resource SQL must NOT reference: `*_artifact` tables, cross-resource `*_resource` tables (e.g., `tools_resource` from a `names` endpoint), `resource_tools_relation`, or any lookup chain to discover IDs.

#### GET (`get_{resource}_complete.sql`)

| Allowed | Example |
|---------|---------|
| `{resource}_resource` | `FROM names_resource WHERE id = ANY(ids)` |

GET is a pure data fetch by IDs. No joins to any other table.

#### SEARCH (`search_{resource}_complete.sql`)

| Allowed | Purpose | Example |
|---------|---------|---------|
| `{resource}_resource` | Primary data | `FROM names_resource n WHERE ...` |
| `{resource}_drafts_connection` | Draft filter (by `draft_id` param) | `EXISTS (SELECT 1 FROM names_drafts_connection dc WHERE dc.names_id = n.id AND dc.draft_id = $param)` |
| `{artifact}_{resource}_junction` | Artifact boolean filter (by `{artifact} boolean` param) | `AND (NOT persona OR EXISTS (SELECT 1 FROM persona_names_junction pnj WHERE pnj.name_id = n.id AND pnj.active = true))` |

**Artifact boolean filters**: For each artifact type that uses this resource, the search function accepts a boolean parameter (e.g., `persona boolean DEFAULT false`). When `true`, results are filtered to resources linked to at least one instance of that artifact via the junction table. This replaces the old `suggest_source='linked'` pattern with explicit, per-artifact control.

The list of artifact junctions per resource can be discovered via: `SELECT tablename FROM pg_tables WHERE tablename LIKE '%_{resource}_junction' ORDER BY tablename;`

#### CREATE (`{resource}_complete.sql`)

| Allowed | Purpose | Example |
|---------|---------|---------|
| `{resource}_resource` | Read (get-or-create check) + Write (INSERT) | `SELECT id FROM names_resource WHERE name = $name; INSERT INTO names_resource(...)` |
| `runs_entry` | Tracking insert (with passed-in `group_id`) | `INSERT INTO runs_entry (id, ..., group_id, ...) VALUES (v_run_id, ..., $group_id, ...)` |
| `calls_entry` | Tracking insert (with passed-in IDs) | `INSERT INTO calls_entry (id, ..., run_id, ...) VALUES (v_call_id, ..., v_run_id, ...)` |
| `tools_calls_connection` | Link tool to call (with passed-in `tool_id`) | `INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ($tool_id, v_call_id)` |
| `{resource}_calls_connection` | Link resource to call | `INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id)` |

**Parameters**: CREATE takes `tool_id uuid` and `group_id uuid` as parameters for tracking. These are passed in by the caller — the SQL must NOT look them up via `agent_tools_junction` → `tools_resource` → `tool_artifact` → `resource_tools_relation` chains.

**Gold standard**: `names_complete.sql` — takes `(name, mcp, group_id, tool_id)`, does get-or-create on `names_resource`, then direct inserts for tracking using the passed-in IDs.

### Rule 7: All read endpoints must implement caching

- `get.py` must use `get_cached()` / `set_cached()` pattern
- `search.py` must use `get_cached()` / `set_cached()` pattern
- `create.py` must call `invalidate_tags()` after mutation
- Cache keys must include all input parameters

### Rule 8: One UI component per resource type — no more, no less

Every value in the `resource_type` enum must have a corresponding component at `client/components/resources/{Resource}.tsx` (PascalCase). Conversely, no component should exist for a resource type that does NOT exist in the enum.

**Known exceptions**:
- `FlagsLegacy.tsx` — Legacy component, acceptable alongside `Flags.tsx`

Components like `Audios.tsx` with no corresponding `audios_resource` table are errors.

### Rule 9: No `link_tool_id` as component input prop

Resource components must NOT accept `link_tool_id` as a prop. The link tool is used at the top-level artifact layer (e.g., `Persona.tsx`), not at the resource component level. Resource components should only accept `create_tool_id` if the resource is creatable.

### Rule 10: Creatable resources must accept `create_tool_id`

If a resource is creatable (per `resource_outputs_relation`), its UI component must accept:
- `create_tool_id?: string | null` — Tool ID for AI-assisted creation
- `create{Resource}Action` — Server action for creating the resource
- `group_id?: string | null` — Parent group ID for new resources

Non-creatable resources must NOT accept these props.

### Rule 11: All components must have standardized AI generation props

Every resource component must accept the following AI generation props:
- `showAiGenerate?: boolean` — Whether to show the AI generate button
- `isGenerating?: boolean` — Loading state during generation
- `onGenerate?: () => void | Promise<void>` — AI generation trigger callback

### Rule 12: All components must have AI diff view props (accept/reject)

Every resource component must support the AI suggestion diff workflow:
- `ai{Resource}Resource?: { ... } | null` (single) or `ai{Resource}Resources?: [...] | null` (multi) — Pending AI suggestion
- `onAccept?: () => void` — Accept the AI suggestion
- `onReject?: () => void` — Reject the AI suggestion

The component must render a diff view when `ai{Resource}Resource` is non-null, showing current vs. proposed values.

### Rule 13: All creatable components must implement draft/autosave/flush

Creatable resource components must implement the flush registry pattern:
- `isAutosaveEnabled?: boolean` — Controls autosave vs manual save mode
- `registerFlush?: (flush: () => Promise<{ {resource}_id: string | null }>) => void` — Registers a flush callback with the parent

**Autosave mode** (`isAutosaveEnabled: true`): Component auto-creates resources on debounced change (1000ms).

**Manual save mode** (`isAutosaveEnabled: false`): Component registers a flush callback. Parent calls all flushes on form save via `useFlushRegistry`.

### Rule 14: All components must have standardized identity props

Every resource component must follow the naming convention:
- **Single-select**: `{resource}_id?: string | null`, `on{Resource}IdChange: (id: string | null) => void`
- **Multi-select**: `{resource}_ids?: string[]`, `on{Resource}IdsChange: (ids: string[]) => void`
- **Resource data**: `{resource}_resource?: { id; generated; ... } | null` (single) or `{resource}_resources?: [...]` (multi)
- **Suggestions**: `{resource}_suggestions?: string[]`
- **Visibility**: `show_{resource}?: boolean`
- **Permission**: `disabled?: boolean`

### Rule 15: The `generated` field must be tracked on all resources

Every resource component must track and display the `generated?: boolean | null` field from the resource data. This determines:
- Button text: "Generate" (first time) vs "Regenerate" (already generated)
- AI badge display on generated items
- Diff view behavior

---

## Audit Checks

### Audit 1: Resource types missing API endpoint folders

```sql
-- Get all resource_type enum values
SELECT e.enumlabel AS resource_name
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'resource_type'
ORDER BY e.enumlabel;
```

Then check the filesystem:

```bash
# List all API resource folders
ls -d server/app/api/v4/resources/*/ | xargs -I{} basename {} | grep -v __pycache__ | sort
```

**Expected**: Every enum value has a matching folder. Report any enum values without folders and any folders without enum values.

### Audit 2: API folders with naming mismatches

```bash
# Compare folder names against resource_type enum values
# Folder name must EXACTLY match enum value
comm -3 \
  <(psql postgresql://myuser:mypassword@localhost:5432/mydb -t -A -c "SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'resource_type' ORDER BY e.enumlabel") \
  <(ls -d server/app/api/v4/resources/*/ | xargs -I{} basename {} | grep -v __pycache__ | sort)
```

**Expected**: No mismatches. `setting_role_routes` vs `role_routes` is a known naming error.

### Audit 3: Resources missing `get.py` or `search.py`

```bash
# Resources missing get.py
for dir in server/app/api/v4/resources/*/; do
  name=$(basename "$dir")
  [ "$name" = "__pycache__" ] && continue
  [ ! -f "$dir/get.py" ] && echo "MISSING get.py: $name"
done

# Resources missing search.py
for dir in server/app/api/v4/resources/*/; do
  name=$(basename "$dir")
  [ "$name" = "__pycache__" ] && continue
  [ ! -f "$dir/search.py" ] && echo "MISSING search.py: $name"
done
```

**Expected**: Empty. Every resource must have both `get.py` and `search.py`.

### Audit 4: Creatable resources missing `create.py`

```sql
-- Get creatable resources
SELECT DISTINCT resource FROM resource_outputs_relation WHERE creatable = true ORDER BY resource;
```

```bash
# For each creatable resource, check create.py exists
for resource in $(psql postgresql://myuser:mypassword@localhost:5432/mydb -t -A -c \
  "SELECT DISTINCT resource FROM resource_outputs_relation WHERE creatable = true ORDER BY resource"); do
  [ ! -f "server/app/api/v4/resources/$resource/create.py" ] && echo "MISSING create.py: $resource"
done
```

**Expected**: Empty.

### Audit 5: Non-creatable resources that have `create.py`

```bash
# Get non-creatable resources (in enum but NOT in creatable list)
for dir in server/app/api/v4/resources/*/; do
  name=$(basename "$dir")
  [ "$name" = "__pycache__" ] && continue
  [ -f "$dir/create.py" ] || continue
  is_creatable=$(psql postgresql://myuser:mypassword@localhost:5432/mydb -t -A -c \
    "SELECT COUNT(*) FROM resource_outputs_relation WHERE resource = '$name' AND creatable = true")
  [ "$is_creatable" = "0" ] && echo "UNEXPECTED create.py: $name (not creatable)"
done
```

**Expected**: Empty. Non-creatable resources should not have create endpoints.

### Audit 6: Resources missing `docs.py`

```bash
for dir in server/app/api/v4/resources/*/; do
  name=$(basename "$dir")
  [ "$name" = "__pycache__" ] && continue
  [ ! -f "$dir/docs.py" ] && echo "MISSING docs.py: $name"
done
```

**Expected**: Empty. Every resource must have documentation.

### Audit 7: Resource endpoints using `domain_id`

```bash
# Check SQL query files for domain_id parameter usage
grep -rl "domain_id" server/app/sql/v4/queries/resources/ --include="*.sql" | grep -v "/domains/"

# Check Python endpoint files for domain_id
grep -rl "domain_id" server/app/api/v4/resources/ --include="*.py" | grep -v "/domains/"
```

**Expected**: Empty (except domains resource). Any other usage is legacy.

### Audit 8: Resource SQL violating Rule 6 table restrictions

```bash
# Check GET/SEARCH SQL (in subdirectories) for disallowed tables
echo "=== GET/SEARCH SQL ==="
for resource_dir in server/app/sql/v4/queries/resources/*/; do
  resource=$(basename "$resource_dir")
  for sql_file in "$resource_dir"*.sql; do
    [ -f "$sql_file" ] || continue
    fname=$(basename "$sql_file")
    # GET files: only {resource}_resource allowed
    if [[ "$fname" == get_* ]]; then
      violations=$(grep -iE "FROM|JOIN" "$sql_file" | grep -v "${resource}_resource" | grep -v "^--" | grep "_resource\|_junction\|_artifact\|_entry\|_connection")
      [ -n "$violations" ] && echo "GET VIOLATION in $sql_file: $violations"
    fi
    # SEARCH files: {resource}_resource + {resource}_drafts_connection + *_{resource}_junction allowed
    if [[ "$fname" == search_* ]]; then
      violations=$(grep -iE "FROM|JOIN" "$sql_file" | grep -v "${resource}_resource" | grep -v "${resource}_drafts_connection" | grep -v "_${resource}_junction" | grep -v "^--" | grep "_resource\|_junction\|_artifact\|_entry\|_connection")
      [ -n "$violations" ] && echo "SEARCH VIOLATION in $sql_file: $violations"
    fi
  done
done

# Check CREATE SQL (in root resources/) for disallowed lookups
echo "=== CREATE SQL ==="
for sql_file in server/app/sql/v4/queries/resources/*_complete.sql; do
  [ -f "$sql_file" ] || continue
  resource=$(basename "$sql_file" _complete.sql)
  # Disallowed: agent_tools_junction, tools_resource, tool_tools_junction, tool_artifact, resource_tools_relation, agent_flags_junction
  violations=$(grep -iE "agent_tools_junction|tools_resource|tool_tools_junction|tool_artifact|resource_tools_relation|agent_flags_junction" "$sql_file" | grep -v "^--")
  [ -n "$violations" ] && echo "CREATE LOOKUP VIOLATION in $sql_file: $violations"
done
```

**Expected**: Empty. GET must only use `{resource}_resource`. SEARCH may additionally use `{resource}_drafts_connection` and `{artifact}_{resource}_junction`. CREATE must not look up IDs via junction/artifact chains — `tool_id` and `group_id` must be parameters.

### Audit 9: Read endpoints missing caching

```bash
# get.py without get_cached
for f in server/app/api/v4/resources/*/get.py; do
  grep -qL "get_cached" "$f" 2>/dev/null && echo "MISSING CACHE: $f"
done

# search.py without get_cached
for f in server/app/api/v4/resources/*/search.py; do
  grep -qL "get_cached" "$f" 2>/dev/null && echo "MISSING CACHE: $f"
done

# create.py without invalidate_tags
for f in server/app/api/v4/resources/*/create.py; do
  grep -qL "invalidate_tags" "$f" 2>/dev/null && echo "MISSING INVALIDATION: $f"
done
```

**Expected**: Empty.

### Audit 10: Resource types missing UI components

```bash
# Get all resource_type enum values and check for matching .tsx component
for resource in $(psql postgresql://myuser:mypassword@localhost:5432/mydb -t -A -c \
  "SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'resource_type' ORDER BY e.enumlabel"); do
  # Convert snake_case to PascalCase
  pascal=$(echo "$resource" | sed -r 's/(^|_)([a-z])/\U\2/g')
  [ ! -f "client/components/resources/${pascal}.tsx" ] && echo "MISSING COMPONENT: $resource (expected ${pascal}.tsx)"
done
```

**Expected**: Empty. Every resource type needs a UI component.

### Audit 11: UI components with no matching resource type

```bash
# List component files and check against enum
for file in client/components/resources/*.tsx; do
  component=$(basename "$file" .tsx)
  # Skip known exceptions
  [ "$component" = "FlagsLegacy" ] && continue
  # Convert PascalCase to snake_case
  snake=$(echo "$component" | sed -r 's/([A-Z])/_\L\1/g' | sed 's/^_//')
  exists=$(psql postgresql://myuser:mypassword@localhost:5432/mydb -t -A -c \
    "SELECT COUNT(*) FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'resource_type' AND e.enumlabel = '$snake'")
  [ "$exists" = "0" ] && echo "ORPHAN COMPONENT: $component (no ${snake}_resource)"
done
```

**Expected**: Empty. `FlagsLegacy.tsx` is excluded. `Audios.tsx` would be flagged (no `audios_resource`).

### Audit 12: Components still accepting `link_tool_id`

```bash
# Search for link_tool_id in component prop definitions
grep -l "link_tool_id" client/components/resources/*.tsx
```

**Expected**: Empty. `link_tool_id` should be used at the artifact level (e.g., `Persona.tsx`), not at the resource component level.

### Audit 13: Creatable components missing `create_tool_id`

```bash
# For each creatable resource, check its component accepts create_tool_id
for resource in $(psql postgresql://myuser:mypassword@localhost:5432/mydb -t -A -c \
  "SELECT DISTINCT resource FROM resource_outputs_relation WHERE creatable = true ORDER BY resource"); do
  pascal=$(echo "$resource" | sed -r 's/(^|_)([a-z])/\U\2/g')
  file="client/components/resources/${pascal}.tsx"
  [ ! -f "$file" ] && continue
  grep -q "create_tool_id" "$file" || echo "MISSING create_tool_id: $file"
done
```

**Expected**: Empty. All creatable resource components must accept `create_tool_id`.

### Audit 14: Components missing AI generation props

```bash
# Check for showAiGenerate, isGenerating, onGenerate
for file in client/components/resources/*.tsx; do
  component=$(basename "$file" .tsx)
  [ "$component" = "FlagsLegacy" ] && continue
  missing=""
  grep -q "showAiGenerate" "$file" || missing="$missing showAiGenerate"
  grep -q "isGenerating" "$file" || missing="$missing isGenerating"
  grep -q "onGenerate" "$file" || missing="$missing onGenerate"
  [ -n "$missing" ] && echo "MISSING AI PROPS ($component):$missing"
done
```

**Expected**: Empty. All components must support AI generation.

### Audit 15: Components missing AI diff view (accept/reject)

```bash
# Check for onAccept, onReject
for file in client/components/resources/*.tsx; do
  component=$(basename "$file" .tsx)
  [ "$component" = "FlagsLegacy" ] && continue
  missing=""
  grep -q "onAccept" "$file" || missing="$missing onAccept"
  grep -q "onReject" "$file" || missing="$missing onReject"
  [ -n "$missing" ] && echo "MISSING DIFF PROPS ($component):$missing"
done
```

**Expected**: Empty. All components must support AI suggestion accept/reject.

### Audit 16: Creatable components missing flush/autosave

```bash
# For each creatable resource, check flush/autosave props
for resource in $(psql postgresql://myuser:mypassword@localhost:5432/mydb -t -A -c \
  "SELECT DISTINCT resource FROM resource_outputs_relation WHERE creatable = true ORDER BY resource"); do
  pascal=$(echo "$resource" | sed -r 's/(^|_)([a-z])/\U\2/g')
  file="client/components/resources/${pascal}.tsx"
  [ ! -f "$file" ] && continue
  missing=""
  grep -q "registerFlush" "$file" || missing="$missing registerFlush"
  grep -q "isAutosaveEnabled" "$file" || missing="$missing isAutosaveEnabled"
  [ -n "$missing" ] && echo "MISSING FLUSH PROPS ($pascal):$missing"
done
```

**Expected**: Empty. All creatable resource components must implement the flush registry pattern.

### Audit 17: Components missing standardized identity props

```bash
# Check for standard prop naming patterns
for file in client/components/resources/*.tsx; do
  component=$(basename "$file" .tsx)
  [ "$component" = "FlagsLegacy" ] && continue
  # Convert to snake_case for prop name check
  snake=$(echo "$component" | sed -r 's/([A-Z])/_\L\1/g' | sed 's/^_//')
  missing=""
  # Check for resource data prop (either {resource}_resource or {resource}_resources)
  grep -q "${snake}_resource" "$file" || grep -q "${snake}_resources" "$file" || missing="$missing {resource}_resource"
  # Check for generated field handling
  grep -q "generated" "$file" || missing="$missing generated"
  # Check for disabled prop
  grep -q "disabled" "$file" || missing="$missing disabled"
  # Check for show_ prop
  grep -q "show_" "$file" || missing="$missing show_{resource}"
  [ -n "$missing" ] && echo "MISSING IDENTITY PROPS ($component):$missing"
done
```

**Expected**: Empty.

### Audit 18: Components missing `generated` field tracking

```bash
for file in client/components/resources/*.tsx; do
  component=$(basename "$file" .tsx)
  [ "$component" = "FlagsLegacy" ] && continue
  grep -q "generated" "$file" || echo "MISSING generated TRACKING: $component"
done
```

**Expected**: Empty. All components must track the `generated` flag.

---

## Running the Audit

### Prerequisites

```bash
# Ensure database is running with latest migrations
make migrate-db

# Ensure server is running (for SQL type generation)
make sql-compile
```

### Execution

Run each audit check in order. For filesystem checks, run from the project root. For SQL checks, use the database credentials above.

---

## Report Format

For each audit that returns results, report:

```
AUDIT {N}: {Title}
RULE VIOLATED: Rule {N}
ITEMS FOUND: {count}
DETAILS:
  - {resource}: {description of violation}
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
Total audits: 18
Passed: {N}
Failed: {N}

API COVERAGE
============
Resource types in DB: 78
API endpoint folders: {N}
Missing API folders: {list}
Extra API folders: {list}

COMPONENT COVERAGE
==================
Resource types in DB: 78
UI components: {N}
Missing components: {list}
Orphan components: {list}

FILE COVERAGE (per resource)
============================
Resources with get.py:    {N}/78
Resources with search.py: {N}/78
Resources with create.py: {N}/{creatable_count} (creatable only)
Resources with docs.py:   {N}/78
```

---

## Important Notes

1. **Do NOT fix anything**. This is a read-only audit. Report only.
2. **The `resource_type` enum is the source of truth** for which resources should exist.
3. **The `resource_outputs_relation` table with `creatable = true`** is the source of truth for which resources are creatable.
4. **Known exceptions**:
   - `FlagsLegacy.tsx` — Legacy component, acceptable alongside `Flags.tsx`
   - `document_uploads` — Not a standalone resource (junction-like, no `id` column). Skip API folder and UI component.
   - `regenerates` — Not a standalone resource (internal tracking). Skip UI component.
5. **`link_tool_id` is a top-level concern**. It belongs on the artifact layer (e.g., `Persona.tsx` orchestrates which tool links which resource), not on individual resource components.
6. **`create_tool_id` is a resource-level concern**. It belongs on the resource component, enabling AI-assisted creation of that specific resource.
7. **Run this after adding any new resource** to ensure all three layers (DB, API, UI) are in sync.
8. **Resource SQL must be self-contained**. GET/SEARCH only read from `{resource}_resource` (plus allowed junction/connection filters per Rule 6). If the endpoint needs data from another table, denormalize it onto the resource table (e.g., `scenarios_resource.persona_ids`). CREATE may write to tracking tables (`runs_entry`, `calls_entry`, `*_connection`) but must receive all cross-table IDs as parameters — never look them up.
