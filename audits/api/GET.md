# GET Audit — Artifact Get Endpoint Integrity Check

You are an artifact GET endpoint auditor for the GLOW project. Your job is to verify that every artifact's `get.py` endpoint, its socket generation handler (`generate.py`), its socket completion handler (`complete.py`), its types (`types.py`), and its permissions (`permissions.py`) follow the canonical rules defined below. You do NOT fix anything. You REPORT errors, inconsistencies, and missing pieces.

The source of truth is the **persona** artifact implementation. Every artifact must match this pattern or document an approved deviation.

---

## The Three-Layer BFF

| Layer | Function | Purpose | Consumer |
|-------|----------|---------|----------|
| **Internal** | `get_{artifact}_internal()` | Q1 access + Q2 IDs + Pass 2 parallel fetch. Returns `@dataclass`. | Shared by websocket + client |
| **Websocket** | `get_{artifact}_websocket()` | Thin wrapper — reshapes internal data into flat resources + draft view + tools | Socket handler (`generate.py`) |
| **Client** | `get_{artifact}_client()` | Full BFF — sections with show/required/suggestions/ai_generate flags | HTTP endpoint |

Reference: `server/app/api/v4/artifacts/persona/get.py`

---

## The Rules

### Rule 1: Internal function uses two-pass SQL

`get_{artifact}_internal()` must execute exactly two SQL queries:

- **Q1 (Access Check)**: Validates the user can see this artifact.
  - Params: `profile_id`, `artifact_id`, `draft_id`
  - Returns: `user_role`, `user_department_ids`, `artifact_department_ids`, `active_usage_count`, `group_id`, `draft_version`
  - SQL file: `get_{artifact}_access_complete.sql`
- **Q2 (ID Fetching)**: Gets all resource IDs, candidate agents, config chain IDs, and tool existence flags.
  - Params: `profile_id`, `artifact_id`, `draft_id`, `group_id`, `user_department_ids`
  - Returns: selected resource IDs per type, `candidate_agents` array, `config_agent_resource_ids`, `config_model_resource_ids`, `config_provider_resource_ids`, `*_has_tools` flags
  - SQL file: `get_{artifact}_ids_complete.sql`

No additional SQL queries in the internal function beyond Q1 and Q2.

Reference: `server/app/api/v4/artifacts/persona/get.py:140-253`

### Rule 2: User context comes from `get_auth_profile_internal()`

The internal function must fetch user context (actor name, user role, department IDs) via `get_auth_profile_internal()` — NOT from the monolithic `get_profile_context_internal()` or from Q1/Q2 SQL results. Q1 provides artifact-scoped access data; the auth profile internal provides user-scoped identity data.

The auth layer is split into two cached internal functions:

- **`get_auth_profile_internal()`** (`auth/profile.py`) — Returns `AuthProfileInternalData`: access row + hydrated departments + cohorts + role resources + session. Use this for identity, permissions, and department-scoped filtering.
- **`get_auth_settings_internal()`** (`auth/settings.py`) — Returns `AuthSettingsInternalData`: hydrated settings resource + agents + tools + theme tokens + generation map. Use this only when the artifact needs settings-level agents/tools (most artifacts do NOT).

Both rely on individually-cached resource internals (`get_access_internal()`, `get_departments_internal()`, etc.), so repeated calls within the same request window are cheap.

```python
from app.api.v4.auth.profile import get_auth_profile_internal

profile_ctx = await get_auth_profile_internal(conn, profile_id, bypass_cache)
user_role = profile_ctx.access.role
actor_name = profile_ctx.access.actor_name
user_department_ids = [d.department_id for d in profile_ctx.departments if d.department_id]
```

Mutation endpoints (save, delete, duplicate, draft) follow the same pattern — they call `get_auth_profile_internal()` for identity/permissions, never the full context.

Reference: `server/app/api/v4/auth/profile.py`, `server/app/api/v4/artifacts/persona/get.py:146-159`

### Rule 3: Draft values override canonical junction values

When a `draft_id` is provided, draft resource IDs override the canonical junction resource IDs for all resources. The internal function must apply this override after Q2 returns.

```python
# Q2 returns both canonical and draft values
# Draft override: use draft value if present, else canonical
name_resource_id = draft_name_id or canonical_name_id
```

Reference: `server/app/api/v4/artifacts/persona/get.py:226-248`

### Rule 4: Agent scoring happens in Python

`select_agents_for_artifact()` scores candidate agents (from Q2) and returns a `dict[str, UUID | None]` mapping resource type strings to the best agent UUID for that resource. This is pure Python — no SQL.

```python
resource_agent_ids = select_agents_for_artifact(
    candidate_agents=candidate_agents,
    resource_types=PERSONA_RESOURCES,
)
```

Reference: `server/app/api/v4/artifacts/persona/get.py:261-273`

### Rule 5: Tool ID maps built from selected agents

After agent scoring, two maps are built per resource type:

- `create_tool_ids: dict[str, UUID | None]` — extracted via `create_tool_ids_map()`
- `link_tool_ids: dict[str, UUID | None]` — extracted via `link_tool_ids_map()`

These maps are derived from the selected agents' tool definitions. They tell the frontend which tool call ID to send back on save/draft for tracking.

Reference: `server/app/api/v4/artifacts/persona/get.py:275-290`

### Rule 6: Pass 2 uses parallel fetch via `asyncio.gather()`

Pass 2 fetches all resource data in parallel using `asyncio.gather()` with separate pool connections per resource type. It fetches:

- Selected resources for each resource type
- Suggestion resources for each resource type
- Config resources: agents, models, providers (from config chain IDs in Q2)

All resources are deduped via `_dedupe_by_id()`.

```python
(
    names, name_suggestions,
    descriptions, description_suggestions,
    # ... all resources ...
    config_agents, config_models, config_providers,
) = await asyncio.gather(
    get_names_internal(pool, [name_resource_id]),
    get_names_internal(pool, name_suggestion_ids),
    # ...
)
```

Reference: `server/app/api/v4/artifacts/persona/get.py:344-580`

### Rule 7: Flag enrichment via `derive_flag_key_and_label()`

Raw flag resources are enriched into `{Artifact}FlagConfig` objects with derived `key` and `label` fields. The derivation strips the artifact prefix from the flag name.

```python
# "persona_active" → key="active", label="Active"
flag_config = PersonaFlagConfig(
    **flag.model_dump(),
    key=derive_flag_key_and_label(flag.name)[0],
    label=derive_flag_key_and_label(flag.name)[1],
)
```

Reference: `server/app/api/v4/artifacts/persona/get.py:671-685`, `permissions.py:394-402`

### Rule 8: Internal function returns a `@dataclass`

The internal function returns `{Artifact}InternalData` — a `@dataclass` containing:

- Access/context: `can_edit`, `disabled_reason`, `draft_version`, `group_id`
- Agent IDs: `resource_agent_ids` dict
- Show/required maps: per resource type
- Suggestions maps: per resource type
- Show AI generate flags: computed, step-level, and per-resource
- Tool ID maps: `create_tool_ids`, `link_tool_ids`
- Resources payload: all fetched resources in a structured object
- Config resources: agents, models, providers

```python
@dataclass
class PersonaInternalData:
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None
    resource_agent_ids: dict[str, UUID | None]
    show_map: dict[str, bool]
    required_map: dict[str, bool]
    # ... etc
```

Reference: `server/app/api/v4/artifacts/persona/types.py:225-268`

### Rule 9: Client response is section-first

`get_{artifact}_client()` wraps `internal()` and builds the API response with section objects. Each section has:

- `show: bool` — whether to display this section in the UI
- `required: bool` — whether this section is mandatory
- `suggestions: list[...]` — suggestion resources for this section
- `show_ai_generate: bool` — whether to show the AI generate button
- `create_tool_id: UUID | None` — tool call ID for resource creation tracking
- `link_tool_id: UUID | None` — tool call ID for resource linking tracking

Single-select sections have `resource` (singular) + `resources` (list). Multi-select sections have `current` (list) + `resources` (list).

Reference: `server/app/api/v4/artifacts/persona/get.py:897-998`, `types.py:46-108`

### Rule 10: Websocket response has exactly 4 top-level fields

`get_{artifact}_websocket()` returns `Get{Artifact}WebsocketResponse` with:

1. `views: {Artifact}WebsocketViews | None` — contains `draft_{artifact}` only
2. `resources: {Artifact}WebsocketResources` — flat selected resources + 4 config resources (agents, models, providers, tools)
3. `resource_agent_ids: dict[str, UUID | None] | None` — resource type to agent UUID mapping
4. `group_id: UUID | None` — single group ID for the artifact

```python
class GetPersonaWebsocketResponse(BaseModel):
    views: PersonaWebsocketViews | None = None
    resources: PersonaWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None
```

Reference: `server/app/api/v4/artifacts/persona/types.py:185-196`

### Rule 11: Websocket function is a thin wrapper

`get_{artifact}_websocket()` calls `get_{artifact}_internal()` and reshapes the result. It must NOT duplicate any SQL queries. Additional work it does:

1. Fetch draft view separately (Jinja convenience, NOT source of truth for IDs)
2. Hydrate tools from all selected config agents' `tool_ids` (deduped) via `get_tools_internal()`
3. Extract selected resources from `data.resources_payload.current` (internal-only source)
4. Get enriched flags by matching `flag_option_id`

Reference: `server/app/api/v4/artifacts/persona/get.py:806-894`

### Rule 12: Permissions are pure Python in `permissions.py`

Permission computation must be in `permissions.py` with these functions:

- `has_access(user_role, user_departments, artifact_departments)` — access check
- `compute_can_edit(user_role, departments, active_count)` — edit permission
- `compute_disabled_reason(...)` — human-readable reason editing is disabled

These are pure Python functions with no SQL calls.

Reference: `server/app/api/v4/artifacts/persona/permissions.py`

### Rule 13: Caching with `get_cached` / `set_cached`

The HTTP endpoint must use `get_cached()` / `set_cached()` with appropriate cache tags. Cache key must include all input parameters.

Reference: `server/app/api/v4/artifacts/persona/get.py:1013-1090`

---

## Socket Generation Handler Rules

### Rule 14: Generation handler follows 11-step flow

The socket generation handler (`generate.py`) must follow this exact flow:

1. **Validate inputs**: `resource_types` must be valid, `draft_id` required
2. **Fetch artifact data**: via `get_{artifact}_websocket()`
3. **Resolve agent_id**: from `result.resource_agent_ids` — iterate `resource_types`, take first non-null
4. **Extract LLM config**: from pre-fetched `result.resources.agents/models/providers` — NO SQL hops
5. **Rate limit check**: single SQL call
6. **Parallel fetch**: tools + system_prompt + developer_instructions via `asyncio.gather()`
7. **Prepare generation**: mutations-only SQL (create group/run/config) — NOT multi-step context SQL
8. **Build Jinja context**: `result.resources.model_dump()` + inject `views.config` and `views.draft_{artifact}`
9. **Render developer instructions**: via Jinja templates
10. **Build + persist messages**: system + developer + user messages to DB
11. **Emit to `generate_artifact`**: with LLM config, tools, messages, metadata

```python
await internal_sio.emit("generate_artifact", {
    "sid": sid,
    "artifact_type": "{artifact}",
    "resource_type": resource_types[0],
    "run_id": str(run_id),
    "group_id": str(group_id),
    "messages": messages,
    "llm_config": { ... },
    "tools": convert_tools_to_dict(tools),
    "metadata": {"trace_id": trace_id},
    "eval_mode": False,
})
```

Reference: `server/app/socket/v4/artifacts/persona/generate.py:92-527`

### Rule 15: Jinja context is flat resources + views

The Jinja context builder returns `response.resources.model_dump()` — a flat dict with all selected resources as top-level keys. Views are injected separately after prepare SQL creates the config:

```python
jinja_context = response.resources.model_dump()
jinja_context["views"] = {
    "config": config_view,
    "draft_{artifact}": draft_view,
}
```

Templates access: `{{ names[0].name }}`, `{{ views.config.tool_ids }}`, `{{ views.draft_{artifact}.name_ids }}`.

Reference: `server/app/socket/v4/artifacts/persona/generate.py:411-436`

---

## Socket Completion Handler Rules

### Rule 16: Completion handler dispatches by event_type

The completion handler (`complete.py`) must:

1. Filter by `artifact_type` (skip if not this artifact)
2. Dispatch by `event_type`:
   - `text_complete` → save assistant message
   - `run_complete` → save final content + update token counts
   - `tool_call_complete` / `tool_result` → hydrate resource + emit completion event
3. Hydrate resources via `get_*_internal()` (NOT raw SQL)
4. Emit `{artifact}_generation_complete` with full typed resource objects

```python
if resource_type == "names":
    items = await get_names_internal(conn, [resource_id])
    event.name_resource = items[0] if items else None
# ... repeat for all resources
```

Reference: `server/app/socket/v4/artifacts/persona/complete.py:36-174`

---

## MUST NOT Rules

1. **MUST NOT** duplicate SQL queries between internal/websocket/client functions
2. **MUST NOT** expose `resource_agent_ids`, `domain_ids`, or `agent_id` per-resource to the HTTP client response
3. **MUST NOT** include `current` at the top level or as `resources.current` in the websocket response
4. **MUST NOT** use `domain_ids` or `agent_type` strings for socket generation routing — use `resource_types`
5. **MUST NOT** fetch LLM config via additional SQL hops in the socket handler — use pre-fetched resources
6. **MUST NOT** return raw flag objects in websocket response — must be enriched `{Artifact}FlagConfig` with key/label
7. **MUST NOT** use per-resource `group_id` fields — single top-level `group_id` only
8. **MUST NOT** emit raw dict passthroughs in completion handler — use typed `QGet*V4Item` models
9. **MUST NOT** use multi-step context SQL in prepare generation — mutations only

---

## Audit Checks

### Audit 1: Three-layer function existence

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}get.py" ] && continue
  file="${artifact_dir}get.py"
  missing=""
  grep -q "def get_${artifact}_internal" "$file" || missing="$missing internal"
  grep -q "def get_${artifact}_websocket" "$file" || missing="$missing websocket"
  grep -q "def get_${artifact}_client" "$file" || missing="$missing client"
  [ -n "$missing" ] && echo "MISSING LAYERS ($artifact):$missing"
done
```

**Expected**: Empty. Every artifact with `get.py` must have all three functions.

### Audit 2: Two-pass SQL in internal function

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}get.py"
  [ ! -f "$file" ] && continue
  grep -q "get_${artifact}_internal" "$file" || continue
  # Check for Q1 and Q2 SQL execution
  q1=$(grep -c "execute_sql_typed.*access" "$file" || true)
  q2=$(grep -c "execute_sql_typed.*ids" "$file" || true)
  [ "$q1" -lt 1 ] && echo "MISSING Q1 ACCESS CHECK: $artifact"
  [ "$q2" -lt 1 ] && echo "MISSING Q2 ID FETCH: $artifact"
done
```

**Expected**: Empty.

### Audit 3: Websocket response shape

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}types.py"
  [ ! -f "$file" ] && continue
  grep -q "WebsocketResponse" "$file" || continue
  missing=""
  grep -q "resource_agent_ids" "$file" || missing="$missing resource_agent_ids"
  grep -q "group_id" "$file" || missing="$missing group_id"
  grep -q "WebsocketViews" "$file" || missing="$missing WebsocketViews"
  grep -q "WebsocketResources" "$file" || missing="$missing WebsocketResources"
  [ -n "$missing" ] && echo "MISSING WEBSOCKET FIELDS ($artifact):$missing"
done
```

**Expected**: Empty.

### Audit 4: No legacy domain_ids in websocket contracts

```bash
grep -rl "domain_ids\|domain_id\|agent_type" server/app/api/v4/artifacts/*/types.py | while read f; do
  artifact=$(basename "$(dirname "$f")")
  echo "LEGACY FIELD IN TYPES: $artifact ($f)"
done
```

**Expected**: Empty. No `domain_ids`, `domain_id`, or `agent_type` in types files.

### Audit 5: Socket handler uses resource_types (not domain_ids)

```bash
for artifact_dir in server/app/socket/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}generate.py"
  [ ! -f "$file" ] && continue
  grep -q "domain_ids\|agent_type" "$file" && echo "LEGACY ROUTING: $artifact ($file)"
done
```

**Expected**: Empty.

### Audit 6: Permission functions exist

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}permissions.py"
  [ ! -f "$file" ] && continue
  missing=""
  grep -q "has_access\|compute_can_edit\|compute_disabled_reason" "$file" || missing="$missing access/edit/disabled"
  grep -q "RESOURCES.*set\|RESOURCES.*=" "$file" || missing="$missing RESOURCES_constant"
  [ -n "$missing" ] && echo "MISSING PERMISSIONS ($artifact):$missing"
done
```

**Expected**: Empty.

### Audit 7: Completion handler hydrates via `*_internal()`

```bash
for artifact_dir in server/app/socket/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}complete.py"
  [ ! -f "$file" ] && continue
  grep -q "_internal" "$file" || echo "NO INTERNAL HYDRATION: $artifact ($file)"
done
```

**Expected**: Empty. Completion handlers must hydrate resources via cached `*_internal()` functions.

### Audit 8: No `resources.current` in websocket response types

```bash
grep -n "class.*WebsocketResources" server/app/api/v4/artifacts/*/types.py | while read line; do
  file=$(echo "$line" | cut -d: -f1)
  grep -A 30 "class.*WebsocketResources" "$file" | grep -q "current" && echo "LEGACY current FIELD: $file"
done
```

**Expected**: Empty.

### Audit 9: Config resources in websocket response

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}types.py"
  [ ! -f "$file" ] && continue
  grep -q "WebsocketResources" "$file" || continue
  missing=""
  grep -A 40 "class.*WebsocketResources" "$file" | grep -q "agents" || missing="$missing agents"
  grep -A 40 "class.*WebsocketResources" "$file" | grep -q "models" || missing="$missing models"
  grep -A 40 "class.*WebsocketResources" "$file" | grep -q "providers" || missing="$missing providers"
  grep -A 40 "class.*WebsocketResources" "$file" | grep -q "tools" || missing="$missing tools"
  [ -n "$missing" ] && echo "MISSING CONFIG RESOURCES ($artifact):$missing"
done
```

**Expected**: Empty. All websocket resource types must include agents, models, providers, tools.

---

## Running the Audit

### Prerequisites

```bash
# Ensure server source is available
make sql-compile
```

### Execution

Run each audit check in order from the project root. All checks are filesystem-based (no database required).

---

## Report Format

For each audit that returns results, report:

```
AUDIT {N}: {Title}
RULE VIOLATED: Rule {N}
ITEMS FOUND: {count}
DETAILS:
  - {artifact}: {description of violation}
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
Total audits: 9
Passed: {N}
Failed: {N}

ARTIFACT COVERAGE
=================
Artifacts with get.py: {N}
Three-layer compliant: {N}
Two-pass SQL compliant: {N}
Websocket contract compliant: {N}
Socket handler compliant: {N}
Completion handler compliant: {N}
```

---

## Important Notes

1. **Do NOT fix anything.** This is a read-only audit. Report only.
2. **The persona artifact is the gold standard.** All patterns reference `server/app/api/v4/artifacts/persona/`.
3. **Known deviations**: Some artifacts may use shared SQL (`get_generation_run_context_and_create_run_complete.sql`) instead of artifact-specific prepare SQL. This is acceptable if documented.
4. **Socket handlers**: Both client-facing (`@sio.event`) and internal bus (`@internal_sio.on`) handlers should follow the same flow.
5. **Config chain**: The config chain (profile → departments → settings → agents → models → providers) is resolved in Q2 SQL and passed through to all layers. No additional SQL hops needed in socket handlers.
6. **`resource_agent_ids`** is included in the HTTP client response for frontend AI button visibility computation, but the frontend never sends agent IDs back — it sends `resource_types` for generation.
