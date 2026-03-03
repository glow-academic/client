# Gold Standard: Artifact Endpoint Architecture

This document describes the correct patterns established by the **persona** artifact. Any artifact endpoint that deviates from these patterns should be refactored to match. An agent can use this document from scratch to identify and fix deviations.

---

## 1. Inputs & Derivation Chain

Everything derives from exactly **two inputs**: `profile_id` (from `X-Profile-Id` header) and `artifact_id` / `draft_id` (from the request body).

```
profile_id
  → profile_profiles_junction → user_department_ids
  → user_department_ids → departments_resource → setting_ids
  → setting_ids → settings_resource → agent_ids (config chain)

agent_ids (from agents_resource via config chain)
  → agents_resource.model_id → models_resource.provider_id → providers_resource
  → agents_resource.tool_ids → tools_resource
  → agents_resource.prompt_id → prompts_resource
  → agents_resource.instruction_ids → instructions_resource

draft_id
  → mv_draft_{artifact} → selected resource IDs (overrides canonical during editing)

artifact_id
  → {artifact}_*_junction → canonical resource IDs (source of truth when saved)
```

There is a **single `group_id`** per artifact — from the draft if it exists, otherwise from the access check result. No per-resource group_ids.

---

## 2. Three-Layer BFF Pattern

Every artifact has exactly three presentation functions that share one internal function:

| Layer | Function | Purpose | Consumer |
|-------|----------|---------|----------|
| Internal | `get_{artifact}_internal()` | Q1 access + Q2 IDs + Pass 2 parallel fetch. Returns dataclass. | Shared |
| Websocket | `get_{artifact}_websocket()` | Thin wrapper — reshapes internal data into flat resources + draft view + tools | Socket handler |
| Client | `get_{artifact}_client()` | Full BFF — sections with show/required/suggestions/ai_generate flags | HTTP endpoint |

### Reference: Persona Implementation

```
server/app/v5/api/main/persona/get.py
  get_persona_internal()    — lines 114-788
  get_persona_websocket()   — lines 791-879
  get_persona_client()      — lines 882-983
```

### What the internal function does

1. **Fetch draft view** if draft_id provided (`get_draft_{artifact}_internal()`)
2. **Query 1 (Q1)**: Access check — validates user can see this artifact
   - Params: `profile_id`, `artifact_id`, `draft_id`
   - Returns: `user_role`, `user_department_ids`, `persona_department_ids`, `active_scenario_count`
   - Validates: artifact exists, user has access
   - Reference: `get.py:140-212`
3. **Query 2 (Q2)**: ID fetching — gets all resource IDs + candidate agents + config chain
   - Params: `profile_id`, `artifact_id`, `draft_id`, `group_id`, `user_department_ids`
   - Returns: selected IDs, candidate agents, config chain resource IDs, tools existence flags
   - Reference: `get.py:200-253`
4. **Draft override**: Draft values override canonical junction values for all resources
   - Reference: `get.py:226-248`
5. **Agent scoring in Python**: `select_agents_for_artifact()` picks best agent per resource
   - Reference: `get.py:261-273`
6. **Tool IDs maps**: Extracts `create_tool_id` and `link_tool_id` per resource from selected agents
   - Reference: `get.py:275-290`
7. **Pass 2**: Parallel fetch via `asyncio.gather()` — each resource type gets its own pool connection
   - Fetches selected + suggestions for each resource, plus config agents/models/providers
   - Reference: `get.py:344-580`
8. **Flag enrichment**: Raw flags → `{Artifact}FlagConfig` with key, label, icon, show, required
   - Reference: `get.py:671-685`
9. **Returns**: `{Artifact}InternalData` dataclass with all computed values
   - Reference: `get.py:759-788`

---

## 3. Websocket Response (get_{artifact}_websocket)

The websocket function is a **thin wrapper** around `get_{artifact}_internal()`. It does NOT duplicate any SQL queries or resource fetching.

### What it does

1. Call `get_{artifact}_internal()` — shared Q1 + Q2 + Pass 2
2. Fetch draft view separately (convenience for Jinja templates, NOT source of truth for IDs)
3. Hydrate tools from selected config agents' `tool_ids` (dedupe across all agents) via `get_tools_internal()`
4. Extract selected resources from `data.resources_payload.current` (internal-only source)
5. Get enriched flags for selected flag(s) by matching `flag_option_id`
6. Return flat response

Reference: `get.py:791-879`

### Response Type Structure

```python
class {Artifact}WebsocketViews(BaseModel):
    draft_{artifact}: Draft{Artifact}ViewItem | None = None

class {Artifact}WebsocketResources(BaseModel):
    # Per-artifact resources (selected only, from current bucket)
    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    # ... all artifact-specific resources ...
    flags: list[{Artifact}FlagConfig] | None = None  # enriched, not raw

    # Config resources (from denormalized chain via Q2)
    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None

class Get{Artifact}WebsocketResponse(BaseModel):
    views: {Artifact}WebsocketViews | None = None
    resources: {Artifact}WebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None  # resource_type → agent_id
    group_id: UUID | None = None
```

Reference: `types.py:158-196`

### Key: `resource_agent_ids`

This is a `dict[str, UUID | None]` mapping **resource type strings** (e.g., `"names"`, `"descriptions"`) to agent UUIDs. This is what the socket handler uses to look up which agent handles which resource. There are no domain_ids.

### Hard Migration Rule (No Legacy Fields)

Websocket response contracts must be hard-migrated to the new pattern:
- Keep: `group_id`, `views`, `resources`, `resource_agent_ids`
- Remove: legacy `*_domain_id` fields
- Remove: legacy `domains` arrays
- Remove: top-level `current` and nested `resources.current` in websocket contracts
- Do not expose backend routing internals to clients if only socket handlers need them

---

## 4. Socket Handler (generate.py)

The generation socket handler follows this exact flow. The client emits **`resource_types: list[str]`** (e.g., `["names", "descriptions"]`) — NOT domain_ids.

### Reference Flow

```
server/app/v5/socket/artifacts/persona/generate.py
  _persona_generate_impl()  — lines 92-527
```

### Step-by-step

**Step 1: Validate inputs** (lines 110-156)
- `resource_types` must be provided and valid
- `draft_id` must be provided
- Validate against `{ARTIFACT}_RESOURCE_TYPES` constant

**Step 2: Fetch artifact data** (lines 158-163)
```python
result = await get_{artifact}_websocket(
    profile_id=profile_id,
    {artifact}_id=data.{artifact}_id,
    draft_id=data.draft_id,
)
```

**Step 3: Resolve agent_id from resource_agent_ids** (lines 165-186)
```python
resource_agent_ids = result.resource_agent_ids or {}
agent_id: UUID | None = None
for rt in resource_types:
    aid = resource_agent_ids.get(rt)
    if aid is not None:
        agent_id = aid
        break
```

**Step 4: Extract LLM config from pre-fetched resources** (lines 188-264)
```python
config_agents = result.resources.agents or []
config_models = result.resources.models or []
config_providers = result.resources.providers or []

agent_resource = config_agents[0] if config_agents else None
model_resource = config_models[0] if config_models else None
provider_resource = config_providers[0] if config_providers else None

model_name = model_resource.value if hasattr(model_resource, "value") else model_resource.name
base_url = model_resource.endpoint if hasattr(model_resource, "endpoint") else ""
api_key = model_resource.key if hasattr(model_resource, "key") else ""
temperature = agent_resource.temperature
reasoning = agent_resource.reasoning
voice = agent_resource.voice
quality = agent_resource.quality
provider_name = provider_resource.value or provider_resource.name or ""
```

No SQL hops needed — all config is pre-fetched by `get_{artifact}_internal()` via the config chain in Q2.

**Step 5: Rate limit check** (lines 283-315)
```python
context_params = Get{Artifact}GenerationContextSqlParams(p_profile_id=profile_id)
context_row = await execute_sql_typed(conn, SQL_PATH_CONTEXT, params=context_params)
# Check requests_per_day vs runs_today
```

**Step 6: Parallel fetch tools + prompts + instructions** (lines 320-373)
```python
async def fetch_tools():
    tools_params = GetAgentToolsSqlParams(p_agent_id=agent_id, p_resource_types=resource_types)
    tools_row = await execute_sql_typed(c, SQL_PATH_AGENT_TOOLS, params=tools_params)
    return tools_row.tools if tools_row else []

async def fetch_system_prompt():
    prompt_id = agent_resource.prompt_id
    prompts = await get_prompts_internal(c, [prompt_id])
    return prompts[0].system_prompt if prompts else ""

async def fetch_developer_instructions():
    instruction_ids = agent_resource.instruction_ids or []
    instructions = await get_instructions_internal(c, instruction_ids)
    return [inst.template for inst in instructions if inst.template]

(tools, system_prompt, developer_instruction_templates) = await asyncio.gather(...)
```

**Step 7: Prepare generation — mutations only SQL** (lines 375-410)
```python
prepare_params = Prepare{Artifact}GenerationSqlParams(
    p_profile_id=profile_id,
    p_group_id=existing_group_id,
    p_agents_resource_id=agent_resource.id,
    p_models_resource_id=model_resource.id,
    p_providers_resource_id=provider_resource.id,
)
prepare_row = await execute_sql_typed(conn, SQL_PATH_PREPARE, params=prepare_params)
# Returns: run_id, group_id, trace_id, config_id
```

This is a **single lean SQL call** that only does mutations (create group if needed, create run, create config entry). It does NOT fetch context — all context comes from the pre-fetched resources in Step 4.

**Step 8: Build Jinja context + inject views** (lines 411-436)
```python
jinja_context = _build_{artifact}_jinja_context(result, resource_types)
# → returns result.resources.model_dump()  (flat dict, all selected resources as top-level keys)

# Fetch config view after prepare creates config_id
config_view_items = await get_config_internal(conn, config_id, bypass_cache=True)
config_view = config_view_items[0].model_dump(mode="json") if config_view_items else {}

# Draft view from websocket response
draft_view = result.views.draft_{artifact}.model_dump(mode="json") if result.views else {}

jinja_context["views"] = {
    "config": config_view,
    "draft_{artifact}": draft_view,
}
```

Templates access resources directly: `{{ names[0].name }}`, `{{ agents[0].temperature }}`. Views via `{{ views.config.tool_ids }}`, `{{ views.draft_{artifact}.name_ids }}`.

**Step 9: Render developer instructions** (lines 438-442)
```python
rendered_developer_messages = render_developer_instructions(
    templates=developer_instruction_templates,
    jinja_context=jinja_context,
)
```

**Step 10: Build + persist messages** (lines 444-483)
- System prompt → messages list + SQL insert
- Developer instructions → messages list + SQL insert
- User instructions → messages list + SQL insert
- Uses `create_message_with_text_complete.sql` for each

**Step 11: Emit to generate_artifact handler** (lines 485-512)
```python
await internal_sio.emit("generate_artifact", {
    "sid": sid,
    "artifact_type": "{artifact}",
    "resource_type": resource_types[0],
    "run_id": str(run_id),
    "group_id": str(group_id),
    "messages": messages,
    "llm_config": {
        "model": model_name, "api_key": api_key, "base_url": base_url,
        "temperature": temperature, "reasoning": reasoning, "provider": provider_name,
        "voice": voice, "quality": quality, "tool_choice": "required",
    },
    "tools": convert_tools_to_dict(tools),
    "metadata": {"trace_id": trace_id},
    "eval_mode": False,
})
```

### Jinja Context Builder

```python
def _build_{artifact}_jinja_context(response, resource_types):
    """Resources as top-level variables. Views injected separately after prepare."""
    if response.resources:
        return response.resources.model_dump()
    return {}
```

Reference: `generate.py:78-89`

---

## 5. Completion Handler (complete.py)

Reference: `server/app/v5/socket/artifacts/persona/complete.py`

### Flow

1. Filter by `artifact_type` (line 45-48)
2. Dispatch by `event_type` (lines 64-76):
   - `text_complete` → save assistant message
   - `run_complete` → save token counts
   - `tool_call_complete` / `tool_result` → resource hydration
3. Extract `resource_id` from tool result (lines 78-111)
4. Fetch full resource object via `get_*_internal()` (lines 128-157)
5. Emit `{artifact}_generation_complete` to client with hydrated resource

### Resource Hydration Pattern

```python
if resource_type == "names":
    items = await get_names_internal(conn, [resource_id])
    event.name_resource = items[0] if items else None
elif resource_type == "descriptions":
    items = await get_descriptions_internal(conn, [resource_id])
    event.description_resource = items[0] if items else None
# ... repeat for all resources
```

---

## 6. Save & Draft Endpoints — Nested Resource Actions

### Resource Action Types

```python
class {Artifact}ResourceAction(BaseModel):
    """Single-select resource with tool call tracking."""
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None  # Set if resource was just created (flush)
    link_tool_id: UUID | None = None    # Set if selection changed from previous

class {Artifact}MultiResourceAction(BaseModel):
    """Multi-select resource with tool call tracking."""
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None
```

Reference: `types.py:341-354`

### Save Request

All resources are required (use empty action if unchanged):
```python
class Save{Artifact}ApiRequest(BaseModel):
    input_{artifact}_id: UUID | None = None
    group_id: UUID
    names: {Artifact}ResourceAction
    descriptions: {Artifact}ResourceAction
    # ... all single-select resources ...
    departments: {Artifact}MultiResourceAction
    # ... all multi-select resources ...
```

Reference: `types.py:360-374`

Save endpoints should be nested-action first. Do not make `draft_id` the primary save contract for migrated artifacts. If an artifact still uses draft-backed SQL internally, resolve/create the draft inside server save logic.

### Draft Patch Request

All resources are optional (None means "don't update this resource"):
```python
class PatchPersonaDraftApiRequest(BaseModel):
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    expected_version: int = 0
    names: {Artifact}ResourceAction | None = None
    descriptions: {Artifact}ResourceAction | None = None
    # ... etc ...
```

Reference: `types.py:477-543`

### SQL Tuple Serialization

```python
def to_tuple(self) -> tuple:
    def single(a: {Artifact}ResourceAction) -> tuple:
        return (a.resource_id, a.create_tool_id, a.link_tool_id)

    def multi(a: {Artifact}MultiResourceAction) -> tuple:
        return (a.resource_ids, a.create_tool_id, a.link_tool_id)

    return (
        self.profile_id,
        self.input_{artifact}_id,
        self.group_id,
        single(self.names),
        single(self.descriptions),
        # ... single-select ...
        multi(self.departments),
        # ... multi-select ...
    )
```

Reference: `types.py:408-431`

---

## 7. Permissions & Constants

Reference: `server/app/v5/api/main/persona/permissions.py`

### Resource Set Constants

```python
{ARTIFACT}_RESOURCES: set[str] = {
    "names", "descriptions", ...  # All resources for this artifact
}
{ARTIFACT}_BASIC_RESOURCES: set[str] = {"names", "descriptions", "flags", "departments"}
{ARTIFACT}_CONTENT_RESOURCES: set[str] = {"instructions", "examples"}
{ARTIFACT}_PARAMETERS_RESOURCES: set[str] = {"parameters", "parameter_fields"}
```

Reference: `permissions.py:366-383`

### Key Functions

- `compute_show_ai_generate(agent_ids, resource)` — True if agent exists for resource (line 389-391)
- `derive_flag_key_and_label(name)` — Strips artifact prefix: `"persona_active"` → `("active", "Active")` (line 394-402)
- `compute_can_edit(user_role, departments, active_count)` — Business logic (line 29-50)
- `has_access(user_role, user_departments, artifact_departments)` — Access check (line 8-26)

---

## 8. Config View (mv_config)

The materialized view `mv_config` provides inference configuration for generation.

Reference: `server/app/v5/sql/views/config/mv_config.sql`, `server/app/v5/api/views/config/`

### Fields

```python
class ConfigViewItem(BaseModel):
    config_id: UUID
    agents_id: UUID | None = None
    models_id: UUID | None = None
    providers_id: UUID | None = None
    tool_ids: list[UUID] | None = None  # From agents_resource join
    created_at: datetime | None = None
```

Reference: `views/config/types.py:9-20`

### Internal Fetch

```python
async def get_config_internal(conn, config_id, bypass_cache=False) -> list[ConfigViewItem]:
```

Reference: `views/config/get.py:27-82`

Used after `prepare_{artifact}_generation` returns `config_id`. Fetched with `bypass_cache=True` since the config was just created.

---

## 9. Frontend Patterns

### Top-Level Constants

```typescript
const {ARTIFACT}_RESOURCES = ["names", "descriptions", ...] as const;

const STEP_RESOURCES: Record<string, ResourceType[]> = {
  basic: ["names", "descriptions", "flags", "departments"],
  content: ["instructions", "examples"],
  parameters: ["parameters", "parameter_fields"],
};

// Only resources that can be CREATED (not link-only)
const FLUSH_KEYS = ["names", "descriptions", "instructions", ...];
```

### Client emits `resource_types` (not domain_ids)

```typescript
socket.emit("{artifact}_generate", {
  {artifact}_id: formState.{artifact}_id,
  draft_id: draftId,
  resource_types: ["names", "descriptions"],    // Resource type strings
  user_instructions: userInstructions || null,
});
```

The server uses `resource_agent_ids` (returned in the HTTP GET response) to resolve which agent handles each resource type. The client never deals with agent IDs or domain IDs for generation.

### No `agent_id` In Frontend Contracts

The frontend must not receive or depend on per-resource `agent_id` fields.
- Step/button enablement must use server-computed `*_show_ai_generate` booleans
- Generation routing always sends `resource_types`
- Socket handler resolves agent IDs server-side via `resource_agent_ids`
- Remove legacy `basic_agent_id` / `content_agent_id` UI dependencies

### API Response Shape: Section-First

Follow Persona-style section payloads in API responses instead of flat, manual per-field contracts:
- Use resource section objects with common metadata (`show`, `required`, `suggestions`, `show_ai_generate`, `create_tool_id`, `link_tool_id`)
- Keep frontend parsing minimal by consuming section objects directly
- Avoid expanding new artifacts with flat `*_agent_id`, `*_domain_id`, or per-resource `*_group_id` fields
- Prefer shared base section types in artifact-level types modules (or a shared artifact common module), not `app/sql/types.py`
- Keep SQL-generated models in `app/sql/types.py` for SQL function contracts only; keep BFF presentation sections in artifact `types.py`
- Enriched resource payloads returned to frontend must not include per-item `agent_id` fields (example: `FlagConfig` should expose `key/label/flag_option_id/show/required/show_ai_generate` context, not routing internals)

### Hard Migration Rule (No Legacy Dual-Shape)

When migrating an artifact to section-first contracts:
- Do a hard cut to section objects in API + frontend consumption
- Remove legacy flat response fields instead of supporting both shapes indefinitely
- Update websocket routing and completion payloads to align with the same resource-type model
- Document the migration in this reference as part of the same PR

### Step-Level AI Buttons

```tsx
<StepCardAiButton
  stepId="basic"
  resourceTypes={STEP_RESOURCES["basic"]}
  canRegenerate={canRegenerate}
  isGenerating={isGenerating}
  onOpenModal={handleOpenStepCardModal}
/>
```

### Draft Autosave via `useDraftLifecycle`

Hook manages debounced autosave (1s). Sends the full form state on every change. Uses `expected_version` for optimistic concurrency control.

### Flush Registry

Only **creatable** resources get flush callbacks. Link-only resources (departments, personas, documents) are never flushed — they already exist, you just select them.

```typescript
const FLUSH_KEYS = ["names", "descriptions", "problem_statements", ...];
const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
  useFlushRegistry<FlushResult>(FLUSH_KEYS);
```

### Create vs Link Tool IDs

The HTTP GET response includes `create_tool_id` and `link_tool_id` per resource section. Only creatable resources have `create_tool_id` set. The frontend passes these back on save/draft patch for tool call tracking.

### Save/Draft SQL Workflow (Persona Standard)

Save/draft SQL should follow Persona-style workflow semantics:
- **Save junction pattern** (deactivate-then-upsert): `SET active = false` on old junction rows, then `INSERT ... ON CONFLICT SET active = true` for new resources
- **Draft connection pattern** (delete-then-insert): `DELETE FROM *_drafts_connection WHERE draft_id = ...`, then `INSERT INTO *_drafts_connection ...` — drafts always replace all connections
- Draft workflow: update links with optimistic versioning (`expected_version`)
- Tool-call tracking: create one `runs_entry` per save/draft mutation and create `calls_entry + tool_calls_junction + *_calls_connection` rows for each non-null `create_tool_id` / `link_tool_id`. **Both save and draft SQL must do this.** Draft tool tracking is conditional on `v_group_id IS NOT NULL` (since a brand-new draft may not have a group yet).
- Frontend request contract should always send nested action objects for all sections to avoid manual per-field parsing drift

### SQL Gotchas

**PostgreSQL reserved words**: If a resource name is a reserved word (e.g., `values`), quote it in function parameters (`"values" types.model_resource_action DEFAULT NULL`) and in all composite access expressions (`("values").resource_id`, `("values").create_tool_id`, `("values").link_tool_id`). Failure to quote causes cryptic syntax errors.

**Shared composite types between save and draft SQL**: Both `save_{artifact}_complete.sql` and `patch_{artifact}_draft_complete.sql` define the same composite types (`types.{artifact}_resource_action`, `types.{artifact}_multi_resource_action`). Each file's `DROP TYPE IF EXISTS ... CASCADE` will cascade-drop functions from the other file. This is by design for JIT compilation — each SQL file is self-contained and re-creates its dependencies. However, when manually applying both files to a database for testing, apply save last (or re-apply whichever was dropped).

**External call ID naming convention**: Tool tracking uses `'{artifact}_{operation}_create_{resource}_' || v_call_id::text` for `external_call_id` values, e.g., `'model_save_create_names_' || v_call_id::text` or `'model_draft_link_descriptions_' || v_call_id::text`.

### Scenario Parity Rules (Persona-Style)

Use these as hard rules when implementing or refactoring Scenario:

- API response is section-first (`names`, `descriptions`, `flags`, etc.) so frontend code reads `s.<section>.<field>` instead of flattening dozens of one-off props.
- Frontend keeps a compact `stable{Artifact}DataFields` shape that stores section objects directly; avoid manually re-mapping every section field into new top-level aliases.
- Frontend render code uses `const s = stable{Artifact}DataFields` and passes section data directly (`s.names.resource`, `s.parameters.current`, etc.) to reduce line count and drift.
- Frontend should not rely on transitional `adapt{Artifact}Data()` compatibility shims after migration; consume section fields directly.
- Avoid `// @ts-nocheck` in migrated artifact components; if types drift, fix the contract rather than suppressing type checks.
- Websocket `get_{artifact}_websocket()` returns only top-level `group_id`, `views`, `resources`, and `resource_agent_ids`.
- Websocket payload never returns top-level `current` or nested `resources.current`.
- Websocket resource payload always includes selected artifact resources plus hydrated config resources: `agents`, `models`, `providers`, `tools`.
- Websocket/API section models should use concrete generated resource types (`QGet*V4Item`) instead of `Any`/`dict` placeholders so frontend contracts stay strict.
- Generation handlers should follow Persona-style step helpers even when using shared start/text SQL (`get_generation_run_context_and_create_run` + `get_text_run_context_for_existing_run`) instead of artifact-specific prepare SQL.
- Generation handlers should fail fast on missing config resources (`agents/models/providers`) using websocket-hydrated resources before emitting `generate_artifact`.
- Do not expose `agent_id` (or `*_agent_id`) to frontend contracts; route agent selection internally via `resource_agent_ids`.
- Migration is hard-cut: remove legacy/dual-shape response types instead of supporting old + new formats indefinitely.
- Save/draft endpoints accept nested section action objects with `resource_id(s)`, `create_tool_id`, and `link_tool_id` (no manual flat parameter parsing).
- Save/draft SQL creates run/call/tool-call linkage for non-null tool IDs and applies resource workflow semantics (deactivate old active link, create/link new, set new active).
- Generation UI must use `StepCardAiButton` and section `show_ai_generate` flags; no custom ad-hoc button logic per step.
- If SQL signature is still legacy flat IDs during transition, flatten nested actions in server `from_request()` (single compatibility point) and keep the external API contract section-action based.
- For simulation `scenario_personas` call-linking, use `personas_calls_connection` by resolving `scenario_personas_resource.persona_id` (there is no dedicated `scenario_personas_calls_connection` table).

### Cohort Parity Rules (Persona-Style)

- Cohort API is section-first: `names`, `descriptions`, `flags`, `departments`, `simulations`, `simulation_positions`.
- Frontend reads section data directly (`s.names.resource`, `s.departments.current`, `s.simulations.resources`) and avoids flat legacy field parsing.
- Cohort websocket `get_cohort_websocket()` returns only `group_id`, `views`, `resource_agent_ids`, and flat selected `resources` (+ `agents/models/providers/tools`).
- Cohort generation emits `resource_types` only; no `domain_ids`, `agent_type`, or other client-side routing internals.
- Cohort step AI buttons should use `StepCardAiButton` wired to section `show_ai_generate` flags.
- Cohort contracts should not expose top-level `current` or `*_domain_id` / `*_agent_id` response fields.
- Cohort save/draft endpoints use nested resource action payloads (`names`, `descriptions`, `flags`, `departments`, `simulations`, `simulation_positions`) with `resource_id(s)`, `create_tool_id`, and `link_tool_id`.
- Cohort save SQL must apply workflow semantics on update (deactivate previous active junction links, insert/link new resources, set new links active).
- Cohort save/draft SQL must create `runs_entry` + `calls_entry` + `tool_calls_junction` records for non-null tool IDs and link calls into resource call tables (`names_calls_connection`, `descriptions_calls_connection`, `flags_calls_connection`, `departments_calls_connection`, `simulations_calls_connection`, `simulation_positions_calls_connection`).

---

## 10. Checklist: How to Audit an Artifact Endpoint

For any artifact endpoint, check each of these against the gold standard:

### Types (`artifacts/{artifact}/types.py`)

- [ ] Has `{Artifact}WebsocketViews` with optional `draft_{artifact}` field
- [ ] Has `{Artifact}WebsocketResources` with flat selected resources + 4 config resources (agents, models, providers, tools)
- [ ] `Get{Artifact}WebsocketResponse` has: `views | None`, `resources`, `resource_agent_ids: dict[str, UUID | None]`, `group_id`
- [ ] No per-resource `*_domain_id` fields on websocket response
- [ ] No per-resource `*_group_id` fields — single top-level `group_id`
- [ ] Has `{Artifact}ResourceAction(resource_id, create_tool_id, link_tool_id)` and `{Artifact}MultiResourceAction`
- [ ] `Save{Artifact}ApiRequest` uses nested resource actions (not flat IDs)
- [ ] `PatchDraftRequest` uses optional nested resource actions
- [ ] Has `to_tuple()` that serializes `(resource_id, create_tool_id, link_tool_id)` per resource

### Get Endpoint (`artifacts/{artifact}/get.py`)

- [ ] `get_{artifact}_internal()` does Q1 → Q2 → draft override → agent scoring → parallel fetch
- [ ] `get_{artifact}_websocket()` wraps `internal()`, does NOT duplicate SQL queries
- [ ] Websocket function fetches draft view separately (convenience for Jinja, not source of truth)
- [ ] Websocket function hydrates tools from all selected `config_agent_resources[*].tool_ids` (deduped)
- [ ] Websocket function extracts selected resources from `data.resources_payload.current`
- [ ] Websocket function gets enriched flags (not raw) by matching `flag_option_id`
- [ ] Websocket response never returns top-level `current` or nested `resources.current`
- [ ] `get_{artifact}_client()` wraps `internal()` and builds sections with `_section_common()` helper

### Socket Handler (`socket/v5/artifacts/{artifact}/generate.py`)

- [ ] Client emits `resource_types: list[str]` — NOT domain_ids or agent_type
- [ ] Calls `get_{artifact}_websocket()` to get pre-fetched resources
- [ ] Resolves `agent_id` from `result.resource_agent_ids[resource_type]`
- [ ] Extracts LLM config from `result.resources.agents/models/providers` — no SQL hops
- [ ] If shared text-context SQL is used, still validate websocket config resources first and use SQL context only as runtime payload source/fallback
- [ ] Uses lean prepare SQL (mutations only: create group/run/config) — NOT multi-step context SQL
- [ ] Fetches tools/prompts/instructions from agent resource fields in parallel
- [ ] Injects `views.config` (from `get_config_internal`) and `views.draft_{artifact}` into Jinja context
- [ ] Jinja builder returns `response.resources.model_dump()` — flat dict, no `current` nesting
- [ ] Persists messages to DB before emitting to `generate_artifact`
- [ ] No legacy `agent_type` string routing

### Completion Handler (`socket/v5/artifacts/{artifact}/complete.py`)

- [ ] Filters by `artifact_type`
- [ ] Dispatches by `event_type` (text_complete, run_complete, tool_call_complete)
- [ ] Hydrates resources via `get_*_internal()` — not raw SQL
- [ ] Emits `{artifact}_generation_complete` with full resource objects
- [ ] Completion payloads validate scenario/tool-result objects into typed `QGet*V4Item` models before emitting (no raw dict passthrough)

### Permissions (`artifacts/{artifact}/permissions.py`)

- [ ] Defines `{ARTIFACT}_RESOURCES` set constant
- [ ] Defines step-level resource groups (BASIC, CONTENT, PARAMETERS)
- [ ] `compute_show_ai_generate()` checks agent_ids dict
- [ ] `derive_flag_key_and_label()` strips artifact prefix

### SQL

- [ ] Q2 (`get_{artifact}_ids_complete.sql`) returns `config_agent_resource_ids`, `config_model_resource_ids`, `config_provider_resource_ids`
- [ ] Q2 returns `candidate_agents` array for Python-side scoring
- [ ] Prepare SQL (`prepare_{artifact}_generation_complete.sql`) is mutations-only
- [ ] Save SQL accepts `(resource_id, create_tool_id, link_tool_id)` composites
- [ ] Draft SQL accepts optional `(resource_id, create_tool_id, link_tool_id)` composites
- [ ] Save SQL applies resource workflow semantics (deactivate old, create/link new, activate new)
- [ ] Save/draft SQL creates `runs_entry` + `calls_entry` + `tool_calls_junction` from tool IDs
- [ ] Save/draft SQL links each resource call into `*_calls_connection` tables (not only `tool_calls_junction`)

### Frontend

- [ ] Top-level `STEP_RESOURCES` constant maps step → resource types
- [ ] `FLUSH_KEYS` only includes creatable resources
- [ ] Emits `resource_types` on generation (not domain_ids/agent_type)
- [ ] Uses `StepCardAiButton` per step
- [ ] Uses `const s = stable{Artifact}DataFields` pattern for rendering (avoid repetitive manual mapping in JSX)
- [ ] No `adapt{Artifact}Data()` compatibility shim in migrated components; form state derives directly from `s.<section>.current/resource`
- [ ] Uses `useDraftLifecycle` for autosave
- [ ] Uses `useFlushRegistry` for resource creation
- [ ] Save/draft sends nested resource actions with tool IDs
- [ ] Does not consume `*_agent_id` fields
- [ ] Uses `*_show_ai_generate` flags for AI button visibility
- [ ] Avoids legacy domain/group identifiers in UI contracts

## Profile Migration Notes

The profile artifact should follow the same contract rules as persona/scenario:

- API `get` response is section-first:
  - `names`, `emails`, `request_limits`, `flags`, `departments`, `cohorts`
  - each section carries `show`, `required`, `suggestions`, `show_ai_generate`, `create_tool_id`, `link_tool_id`
  - no legacy flat fields like `name_resource`, `name_domain_id`, `name_agent_id`, `resources.current`, or top-level `current`
- Websocket `get_profile_websocket` returns only:
  - `group_id`
  - `views.draft_profile`
  - flat selected `resources`
  - config resources in `resources`: `agents`, `models`, `providers`, `tools`
  - `resource_agent_ids`
  - no `domain_ids`/`domains` routing payload
- `profile_generate` websocket payload uses `resource_types` (not `domain_ids` or `agent_type`)
- Profile step-level AI controls should use shared `StepCardAiButton` (same as persona/scenario pattern), not repeated inline tooltip/button blocks
- Save endpoint follows persona-style nested actions:
  - request body includes `input_profile_id`, `group_id`, `role`, and section actions (`names`, `flags`, `request_limits`, `departments`, `emails`, `cohorts`)
  - do not require `draft_id` as the primary save contract
  - server may patch/create draft internally before final save SQL
- Client save action should be fully typed:
  - `InputOf<"/api/v5/artifacts/profiles/save", "post">`
  - `OutputOf<"/api/v5/artifacts/profiles/save", "post">`
  - do not use temporary unsafe wrappers once schema is regenerated
- Draft endpoint must use nested resource actions (persona-style):
  - request body sections: `names`, `flags`, `request_limits`, `departments`, `emails`, `cohorts`
  - each section uses `{ resource_id|resource_ids, create_tool_id, link_tool_id }`
  - include `group_id` and `expected_version`
- Profile draft SQL (`patch_profile_draft_complete.sql`) should:
  - accept `types.profile_resource_action` and `types.profile_multi_resource_action`
  - extract resource IDs from composites (no flat ID params)
  - create `runs_entry` + `calls_entry` + `tool_calls_junction` when tool IDs are provided
  - link each resource call in corresponding `*_calls_connection` tables

Profile component ownership:
- `client/components/staff/Profile.tsx` is the canonical staff create/edit component and should be kept section-first.
- `client/components/staff/StaffNewEdit.tsx` is redundant and should not be reintroduced.
- `Profile.tsx` should consume section data directly (`names.resource`, `emails.current`, etc.) without compatibility adapters or legacy flat field shims.
- `Profile.tsx` should use the compact draft stack like persona:
  - `useDraftLifecycle` for autosave/version/draft URL sync
  - `useFlushRegistry` for creatable resources (`names`, `emails`, `request_limits`)
  - `buildResourceActions` + `computeEffectiveFormState` + `checkHasResourceIds` for consistent effective state/action derivation

### Document Parity Rules (Persona-Style)

Document artifact has been migrated to gold standard with **8 resources**: `names`, `descriptions`, `flags`, `departments`, `fields`, `uploads`, `images`, `texts`.

Architecture notes:
- API `get` response is section-first: `names`, `descriptions`, `flags`, `departments`, `fields`, `uploads`, `images`, `texts`
- Each section carries `show`, `required`, `suggestions`, `show_ai_generate`, `create_tool_id`, `link_tool_id`
- Websocket `get_document_websocket()` returns `group_id`, `views.draft_document`, flat selected `resources`, `resource_agent_ids`
- `document_generate` websocket payload uses `resource_types` (not `domain_ids` or `agent_type`)
- Save/draft endpoints use nested resource action payloads with `resource_id(s)`, `create_tool_id`, `link_tool_id`
- Multi-select resources: `departments`, `fields`, `uploads`, `images`, `texts` (use `MultiResourceAction`)
- Single-select resources: `names`, `descriptions`, `flags` (use `ResourceAction`)

Known deviations from gold standard (acceptable for now, migration deferred):
- `generate.py` uses shared SQL (`get_generation_run_context_and_create_run_complete.sql` + `get_text_run_context_for_existing_run_complete.sql`) instead of artifact-specific prepare SQL
- `generate.py` does not perform a rate limit check
- `generate.py` does not parallel-fetch tools/prompts/instructions (uses shared SQL context instead)
- `generate.py` does not inject `views.config` into Jinja context
- `generate.py` does not explicitly persist messages to DB before emitting to `generate_artifact`
- These deviations should be addressed when document generation is refactored to match the persona gold standard

Frontend notes:
- `client/components/documents/Document.tsx` is the canonical document create/edit component
- `client/components/documents/DocumentNew.tsx` is deprecated/removed and must not be reintroduced
- `client/components/resources/Texts.tsx` is a textarea-based multi-select component for text content
- `client/components/resources/Images.tsx` is used for image selection
- Frontend `VALID_RESOURCE_TYPES` includes all 8 resource types
- Document uses step-based wizard with AI generation per step
- Draft autosave via `useDraftLifecycle` with `expected_version` concurrency control
- Document frontend parity stack should match persona:
  - `useSaveContext` + `useDraftLifecycle` + `useFlushRegistry`
  - `buildResourceActions` + `computeEffectiveFormState` + `checkHasResourceIds`
  - step headers use shared `StepCardAiButton` + `useGenerationModal` (no ad-hoc step AI button logic)

Resource layer notes:
- Images: full resource layer exists (`get_images_internal`, `search_images_internal`, `QGetImagesV4Item`)
- Texts: full resource layer exists (`get_texts_internal`, `search_texts_internal`, `QGetTextsV4Item`)
- Both use `RETURNS TABLE (items composite[])` with `ARRAY_AGG` + `COALESCE` pattern for asyncpg compatibility
- Both have create endpoints: `POST /api/v5/resources/images`, `POST /api/v5/resources/texts`

### Model Parity Rules (Persona-Style)

Model artifact has been migrated to gold standard with **12 resources**: `names`, `descriptions`, `values`, `providers`, `flags`, `departments`, `modalities`, `temperature_levels`, `pricing`, `reasoning_levels`, `qualities`, `voices`.

Architecture notes:
- API `get` response is section-first: `names`, `descriptions`, `values`, `providers`, `flags`, `departments`, `modalities`, `temperature_levels`, `pricing`, `reasoning_levels`, `qualities`, `voices`
- Each section carries `show`, `required`, `suggestions`, `show_ai_generate`, `create_tool_id`, `link_tool_id`
- Websocket `get_model_websocket()` returns `group_id`, `views.draft_model`, flat selected `resources`, `resource_agent_ids`
- `model_generate` websocket payload uses `resource_types` (not `domain_ids` or `agent_type`)
- Save/draft endpoints use nested resource action payloads with `resource_id(s)`, `create_tool_id`, `link_tool_id`
- Single-select resources: `names`, `descriptions`, `values`, `providers` (use `ModelResourceAction`)
- Multi-select resources: `flags`, `departments`, `modalities`, `temperature_levels`, `pricing`, `reasoning_levels`, `qualities`, `voices` (use `ModelMultiResourceAction`)
- `values` is a PostgreSQL reserved word — quoted as `"values"` in SQL function parameters and composite access expressions
- Step grouping: `basic` (names, descriptions, flags, departments), `provider` (values, providers), `features` (modalities, temperature_levels, pricing, reasoning_levels, qualities, voices)
- Modalities are unified (no separate input/output arrays) — direction is tracked via `is_input` boolean on `modalities_resource`, not via junction table `type` column
- Endpoints and keys were removed from model (moved to provider artifact per migration 406)
- Handcrafted types in `server/app/v5/api/main/model/types.py`
- Permissions in `server/app/v5/api/main/model/permissions.py`

Known deviations from gold standard (acceptable for now, migration deferred):
- `generate.py` uses shared SQL (`get_generation_run_context_and_create_run_complete.sql` + `get_text_run_context_for_existing_run_complete.sql`) instead of artifact-specific prepare SQL
- Mutation endpoints (delete/duplicate) still use auto-generated SQL types

### Provider Parity Rules (Persona-Style)

Provider artifact is hard-migrated to section-first parity with **7 resources**:
`names`, `descriptions`, `flags`, `departments`, `values`, `endpoints`, `keys`.

Architecture notes:
- API `get` response is section-first: `names`, `descriptions`, `flags`, `departments`, `values`, `endpoints`, `keys`
- Each section carries: `show`, `required`, `suggestions`, `show_ai_generate`, `create_tool_id`, `link_tool_id`
- Remove legacy provider contract fields:
  - no `*_domain_id`
  - no `domains`
  - no top-level `current`
  - no nested `resources.current`
- Websocket `get_provider_websocket()` returns only:
  - `views.draft_provider`
  - selected `resources` + hydrated config resources (`agents`, `models`, `providers`, `tools`)
  - `resource_agent_ids`
  - `group_id`
- `provider_generate` payload uses `resource_types` (never `domain_ids`)
- Provider keys are never AI-generated:
  - `keys.show_ai_generate` is false
  - socket rejects `resource_types` that include `keys`
- Save/draft payloads are flat provider action payloads for now (`name_id`, `description_id`, `active_flag_id`, `department_ids`, `value_id`, `endpoint_id`, `key_id`) and must not include legacy `regenerates`.
- SQL workflow requirements for provider save/draft:
  - `value_id` is required
  - update path deactivates/replaces old provider-resource links and writes fresh active links
  - provider integrations are persisted through `provider_endpoints_junction` and `provider_keys_junction`
  - draft persistence uses `endpoints_drafts_connection` and `keys_drafts_connection`
- `regenerates` is removed from provider API/socket/frontend contracts (hard cut, no legacy backfill).

Frontend notes:
- `client/components/providers/Provider.tsx` is canonical and uses parity stack:
  - `useDraftLifecycle` + `useFlushRegistry` + `useArtifactGeneration` + `useGenerationModal`
  - step-level AI actions use `StepCardAiButton`
- Provider frontend reads sections directly (`s.names`, `s.descriptions`, etc.) and does not parse legacy payload shapes.
- Provider page server actions should include resource creation actions for creatable resources used in flush (`names`, `descriptions`, `values`).

### Tool Parity Rules (Persona-Style)

Tool artifact is hard-migrated to section-first parity with **5 resources**:
`names`, `descriptions`, `flags`, `args`, `args_outputs`.

Contract and routing rules:
- API `get` response is section-first and should not expose legacy flat routing/internal fields:
  - no `*_domain_id`, no `domain_data`, no `domains`
  - no top-level `current`, no nested `resources.current` in external contracts
- Websocket `get_tool_websocket()` returns only:
  - `views.draft_tool`
  - selected `resources` + hydrated config resources (`agents`, `models`, `providers`, `tools`)
  - `resource_agent_ids`
  - `group_id`
- `tool_generate` websocket payload uses `resource_types` (never `domain_ids`)
- Socket generation resolves agent routing internally from `resource_agent_ids`, not client-provided routing IDs
- Frontend does not read or depend on per-resource `agent_id` fields

Save/draft parity rules:
- Save/draft request contracts use nested section actions:
  - single: `names`, `descriptions`, `flags` (`resource_id`, `create_tool_id`, `link_tool_id`)
  - multi: `args`, `args_outputs` (`resource_ids`, `create_tool_id`, `link_tool_id`)
- Save SQL workflow should be update-safe:
  - deactivate existing single-select active links, then upsert selected active links
  - replace multi links (`args`, `args_outputs`) for update path
- Draft SQL workflow should use draft-connection replacement:
  - delete then insert all `*_drafts_connection` rows for current draft version
- Save/draft SQL must create tool-call lineage for non-null tool IDs:
  - one `runs_entry` per mutation
  - `calls_entry` + `tool_calls_junction`
  - resource call links: `names_calls_connection`, `descriptions_calls_connection`, `flags_calls_connection`, `args_calls_connection`, `args_outputs_calls_connection`

Frontend parity rules:
- `Tool.tsx` should consume section data directly via compact section alias (`s.<section>...`)
- Step AI controls use shared `StepCardAiButton` + generation modal hooks (no ad-hoc legacy button wiring)
- Draft/save flow uses nested section actions and should not send legacy flat IDs (`name_id`, `args_ids`, etc.) as external API contract

### Agent Parity Rules (Persona-Style)

Agent artifact follows hard-cut section-first contracts with **11 resources**:
`names`, `descriptions`, `models`, `prompts`, `instructions`, `flags`, `departments`, `tools`, `temperature_levels`, `reasoning_levels`, `voices`.

Contract rules:
- API `get` response is section-first; do not expose flat legacy `*_resource`, `*_domain_id`, `*_agent_id`, or nested `resources.current`.
- Websocket `get_agent_websocket()` returns only: `group_id`, `views.draft_agent`, flat selected `resources`, and `resource_agent_ids`.
- `agent_generate` payload uses `resource_types` only; never `domain_ids` or `agent_type`.
- `agent_generation_complete` payload returns hydrated resource objects (not IDs) such as `name_resource`, `description_resource`, `model_resource`, `prompt_resource`, `instructions_resource`, `flag_resource`, `temperature_level_resource`, `reasoning_level_resource`, plus `department_resources` / `tool_resources` / `voice_resources`.
- Frontend AI visibility uses section `show_ai_generate`; never backend routing fields.
- Save/draft request contracts use nested section actions with `resource_id/resource_ids`, `create_tool_id`, `link_tool_id`.
- If SQL signatures are still flat during transition, flatten nested section actions in server route handlers (single compatibility point) while preserving nested external API contracts.

Frontend rules:
- `client/components/agents/Agent.tsx` should read section data via `s.<section>.*` (or a single normalization layer) and avoid direct legacy field coupling.
- Step-level generation controls should use shared `StepCardAiButton` (no repeated custom tooltip/button blocks per step).
- Draft/save flow should use persona-style hooks/utilities: `useDraftLifecycle`, `useFlushRegistry`, and `buildResourceActions` / `computeEffectiveFormState` / `checkHasResourceIds`.
- Agent generation should ensure a draft exists before emitting `agent_generate` (flush resources + patch draft first when needed).
- Agent pages should only send contract fields supported by artifact GET (`agent_id`, `draft_id`) and remove legacy search/body extras.
- Remove invalid create endpoints from agent pages (`reasoning_levels`, `temperature_levels` are non-creatable resources).

### Parameter Parity Rules (Persona-Style)

Parameter artifact is now treated as section-first, with no legacy domain routing fields.

Architecture notes:
- API `get` response must be section-first: `names`, `descriptions`, `flags`, `departments`, `fields`
- Each section carries: `show`, `required`, `suggestions`, `show_ai_generate`, `create_tool_id`, `link_tool_id`
- Websocket `get_parameter_websocket()` must return: `group_id`, `views.draft_parameter`, flat selected `resources`, and `resource_agent_ids`
- `parameter_generate` websocket payload must use `resource_types` (never `domain_ids` or `agent_type`)
- Save/draft endpoints must accept nested resource action sections with `resource_id(s)`, `create_tool_id`, `link_tool_id`
- Parameter save/draft SQL signatures are now composite-first (no flat `name_id`, `description_id`, `flag_ids`, `department_ids`, `field_ids` params at SQL boundary)
- Parameter save/draft SQL must create `runs_entry` + `calls_entry` + `tool_calls_junction` rows when tool IDs are provided, then link resource calls through:
  - `names_calls_connection`
  - `descriptions_calls_connection`
  - `flags_calls_connection`
  - `departments_calls_connection`
  - `fields_calls_connection`
- Parameter save SQL uses workflow semantics for `parameter_parameters_junction`: deactivate old active links, create a fresh `parameters_resource`, and link it as active
- Parameter active state is derived from `flags` selections (`parameter_active`), not a standalone `active_flag_id` SQL param
- No top-level legacy fields in parameter contracts (`*_domain_id`, `domains`, flat `name_id/name_resource` response keys)

Frontend notes:
- `client/components/parameters/Parameter.tsx` is the canonical parameter create/edit component
- Use compact parity stack: `useSaveContext` + `useDraftLifecycle` + `useFlushRegistry` + action builders
- Use `StepCardAiButton` + `useGenerationModal` for step-level AI controls
- Keep the switch-based parameter-type UX (simulation/document/persona/scenario/video), but persist through `flags` resource action sections (no legacy flat booleans in save/draft payloads)
- Do not call non-creatable resource create endpoints for `flags`, `departments`, or `fields`

### Department Parity Rules (Persona-Style)

Department artifact should be hard-migrated to section-first parity with **4 resources**: `names`, `descriptions`, `flags`, `settings`.

Architecture notes:
- API `get` response is section-first: `names`, `descriptions`, `flags`, `settings` (no domain-facing fields)
- No legacy top-level or nested legacy containers in contracts:
  - no top-level `current`
  - no `resources.current`
  - no `*_domain_id` / `*_agent_id` fields
- Websocket `get_department_websocket()` returns `views`, `resources`, `resource_agent_ids`, and `group_id`
- `department_generate` websocket payload uses `resource_types` (never `domain_ids`)
- Save/draft endpoints use nested resource action payloads:
  - single: `{ resource_id, create_tool_id, link_tool_id }`
  - multi: `{ resource_ids, create_tool_id, link_tool_id }`
- Save/draft SQL must create `runs_entry` + `calls_entry` + `tool_calls_junction` rows when tool IDs are provided and link resource calls through:
  - `names_calls_connection`
  - `descriptions_calls_connection`
  - `flags_calls_connection`
  - `settings_calls_connection`

Frontend notes:
- `client/components/departments/Department.tsx` is canonical and should remain parity-style
- Use `useSaveContext`, `useDraftLifecycle`, `useFlushRegistry`, and `buildResourceActions`
- Step AI controls use `StepCardAiButton` + `useGenerationModal`
- Department pages and metadata must read section fields directly (e.g., `names.resource`, `descriptions.resource`) and never parse `resources.current`
- Legacy path/contract compatibility adapters should not be reintroduced

### Rubric Parity Rules (Persona-Style)

Rubric artifact is hard-migrated to section-first parity with **8 resources**:
`names`, `descriptions`, `flags`, `departments`, `points`, `pass_points`, `standard_groups`, `standards`.

Architecture notes:
- API `get` response is section-first and must not expose legacy flat keys.
- Remove legacy routing/internal fields from rubric contracts:
  - no top-level `current`
  - no nested `resources.current`
  - no `*_domain_id` / `domains` routing payload
  - no exposed `*_agent_id` frontend routing fields
- Websocket `get_rubric_websocket()` returns:
  - `views.draft_rubric`
  - `resources` (selected resources + hydrated `agents/models/providers/tools`)
  - `resource_agent_ids`
  - `group_id`
- `rubric_generate` payload uses `resource_types` (never `domain_ids`).
- Save/draft external contracts are nested section-action payloads:
  - single: `{ resource_id, create_tool_id, link_tool_id }`
  - multi: `{ resource_ids, create_tool_id, link_tool_id }`
- Save/draft SQL signatures must be composite-action based (no flat legacy IDs in function args).
- Save/draft SQL must create `runs_entry` + `calls_entry` + `tool_calls_junction` when tool IDs are present and link resources through:
  - `names_calls_connection`
  - `descriptions_calls_connection`
  - `flags_calls_connection`
  - `departments_calls_connection`
  - `points_calls_connection`
  - `standard_groups_calls_connection`
  - `standards_calls_connection`
- Rubric socket completion should emit typed `rubric_generation_complete` resource payloads and avoid legacy top-level ID completion payloads (`name_id`, `description_id`, `department_ids`, etc.).

Frontend notes:
- `client/components/rubrics/Rubric.tsx` is canonical and should use parity stack:
  - `useSaveContext` + `useDraftLifecycle` + `useFlushRegistry`
  - `useArtifactGeneration` + `useGenerationModal` + `StepCardAiButton`
  - `buildResourceActions` / `computeEffectiveFormState` / `checkHasResourceIds`
- Rubric pages and metadata should read section fields directly (`names.resource`, `descriptions.resource`), never `resources.current`.
- Do not wire rubric to `/api/v5/resources/departments` create routes; departments in rubric are selected/linked resources only.

### Field Parity Rules (Persona-Style)

Field artifact is hard-migrated to section-first parity with **5 resources**:
`names`, `descriptions`, `flags`, `departments`, `conditional_parameters`.

Architecture notes:
- API `get` response is section-first:
  - `names`, `descriptions`, `flags`, `departments`, `conditional_parameters`
  - each section carries `show`, `required`, `suggestions`, `show_ai_generate`, `create_tool_id`, `link_tool_id`
- Do not expose legacy contract fields:
  - no top-level `current`
  - no nested `resources.current`
  - no `*_domain_id`/`domains`
  - no exposed `agent_id` routing fields
- Websocket `get_field_websocket()` returns only:
  - `views.draft_field`
  - `resources` (selected artifact resources + hydrated `agents/models/providers/tools`)
  - `resource_agent_ids`
  - `group_id`
- `field_generate` payload uses `resource_types` (never `domain_ids`).
- Field save/draft endpoints are nested section-action contracts:
  - single: `{ resource_id, create_tool_id, link_tool_id }`
  - multi: `{ resource_ids, create_tool_id, link_tool_id }`
  - sections: `names`, `descriptions`, `flags`, `departments`, `conditional_parameters`
- Save/draft SQL must remain workflow-style:
  - create call/run/tool_call rows when `create_tool_id`/`link_tool_id` are present
  - deactivate old `field_fields_junction` link, create a fresh `fields_resource`, and link as active
  - deactivate old junctions and insert new active links for names/descriptions/flags/departments/conditional_parameters

Conditional parameter naming rule:
- External/API/websocket/frontend naming is always `conditional_parameters`.
- Internal generation/tooling may still use `parameters` resource enum.
- When needed, map alias internally:
  - outbound generation call: `conditional_parameters -> parameters`
  - inbound socket events: `parameters -> conditional_parameters`
  - candidate-agent tool resource matching should normalize `parameters` to `conditional_parameters` for scoring and tool-id lookup.

Frontend notes:
- `client/components/fields/Field.tsx` is canonical and should use the compact parity stack:
  - `useSaveContext` + `useDraftLifecycle` + `useFlushRegistry`
  - `useArtifactGeneration` + `useGenerationModal` + `StepCardAiButton`
  - `buildResourceActions` / `computeEffectiveFormState` / `checkHasResourceIds`
- Field pages and metadata must read section fields directly (`names.resource`, `descriptions.resource`) and never parse `resources.current`.
- Field search params should use:
  - `descriptionSearch`
  - `conditionalParameterSearch`
  - `conditionalParameterShowSelected`
- Request body keys for artifact get should use:
  - `description_search`
  - `conditional_parameter_search`
  - `conditional_parameter_show_selected`

Audit hygiene:
- Remove unused legacy helper/components that keep domain-based routing patterns alive (e.g., old scenario basic-info/domain-picker components).
- Keep frontend scenario/field type files free of legacy `*_domain_id` fields unless explicitly required by an actively used contract.

### Auth Artifact Parity Rules (Persona-Style)

`/api/v5/auth/*` is a separate auth/session surface and is not part of this migration.
This section applies to artifact auth management (`/api/v5/artifacts/auths/*`, `auth_generate`, and `client/components/auth/Auth.tsx`).

Architecture notes:
- API `get` response is section-first only:
  - `names`, `descriptions`, `flags`, `protocols`, `slugs`, `items`
  - no legacy flat fields, no top-level `current`, no nested `resources.current`, no `*_domain_id`/`*_agent_id`.
- Websocket `get_auth_websocket()` returns only:
  - `views.draft_auth`
  - `resources` (selected auth resources + hydrated `agents/models/providers/tools`)
  - `resource_agent_ids`
  - `group_id`
- `auth_generate` payload must use `resource_types` and requires `draft_id`.
- Agent selection must resolve internally via `resource_agent_ids`; frontend never receives or routes by `agent_id`.

Save/draft contract notes:
- Save/draft endpoint bodies are nested section actions, not flat IDs:
  - single: `{ resource_id, create_tool_id, link_tool_id }`
  - multi: `{ resource_ids, create_tool_id, link_tool_id }`
- Auth save includes `items` action payload:
  - `{ items, create_tool_id, link_tool_id }`
- Internal DB naming remains junction/table based (`auth_items_junction`, `items_resource`) while external API/socket/frontend contracts use `items`.
- Save/draft SQL signatures must accept composite action types and create lineage rows when tool IDs are provided:
  - `runs_entry`
  - `calls_entry`
  - `tool_calls_junction`
  - resource call links (`names/descriptions/flags/protocols/slugs/items_calls_connection`)

Frontend notes:
- `client/components/auth/Auth.tsx` must follow compact parity pattern:
  - `const s = authData`
  - section-first field reads (`s.names.resource`, `s.protocols.current`, etc.)
  - `useSaveContext` + `useDraftLifecycle` + `useFlushRegistry`
  - `buildResourceActions` / `computeEffectiveFormState` / `checkHasResourceIds`
  - `useArtifactGeneration` + `useGenerationModal` + `StepCardAiButton`
- Metadata/pages must read section fields directly (`names.resource`, `descriptions.resource`) and never parse legacy `resources.current`.
- Do not reintroduce legacy compatibility adapters for auth flat payloads.

### Eval Artifact Parity Rules (Persona-Style)

Architecture notes:
- Eval generation routing is resource-first, not domain-first.
- Eval section model is:
  - top-level: `names`, `descriptions`, `active_flags`, `dynamic_flags`, `groups_flags`, `departments`, `rubrics`, `runs`, `groups`
  - scoped-by-target: `run_positions`, `group_positions`, `run_rubrics`, `group_rubrics`
- `rubrics` is the rubric catalog section; assignments remain scoped through `run_rubrics` / `group_rubrics` mappings.
- Hard-cut API GET shape:
  - no legacy flat IDs (`name_id`, `department_ids`, etc.) as transport contract fields
  - no legacy `resources.current` or top-level `current`
  - no `*_domain_id`, `domains`, or domain routing internals
- `get_eval_websocket()` returns only:
  - `views.draft_eval` (optional)
  - selected flat `resources`
  - `resource_agent_ids`
  - `group_id`
- `eval_generate` payload must use `resource_types` and optional `user_instructions`; never `domain_ids`.
- Agent routing resolves server-side via `resource_agent_ids` only.
- Eval save/draft request contracts are nested section-action payloads:
  - single: `{ resource_id, create_tool_id, link_tool_id }`
  - multi: `{ resource_ids, create_tool_id, link_tool_id }`
  - sections: `names`, `descriptions`, `flags`, `departments`, `rubrics`, `runs`, `groups`, `run_positions`, `group_positions`
  - scoped mappings: `run_rubrics[]`, `group_rubrics[]`

Frontend notes:
- Eval generation emits:
  - `eval_id`
  - `draft_id`
  - `resource_types`
  - optional `user_instructions`
- Frontend should consume section fields directly (`s.names.resource`, `s.departments.current`, `s.active_flags.resource`) and avoid long-lived compatibility adapters after migration.
- Do not route eval generation with `*_domain_id` or any domain mapping adapter.

Schema alignment notes:
- Resource tables:
  - `run_positions_resource`
  - `group_positions_resource`
  - `run_rubrics_resource`
  - `group_rubrics_resource`
- Eval junction tables:
  - `eval_run_positions_junction` -> `run_positions_resource`
  - `eval_group_positions_junction` -> `group_positions_resource`
  - `eval_runs_rubrics_junction` -> `run_rubrics_resource`
  - `eval_groups_rubrics_junction` -> `group_rubrics_resource`
- Eval no longer has a direct `agents` resource section; settings retains `agents`.
- Auth socket parity normalization:
  - `auth_generation_complete` emits resource-complete payloads only from `generate_call_complete` tool results.
  - Auth socket `progress`/`error` handlers are scoped to call-based generation events and filtered to valid auth resource types.
  - No auth-specific legacy text/run completion side paths in artifact socket handlers.

### 17-Artifact Audit Snapshot (2026-02-10)

Canonical audit output is tracked in:
- `ARTIFACT_RESOURCE_AUDIT.md`

Current highest-priority parity gaps identified:
- `setting` still uses legacy flat save/draft payloads and mixed legacy response fields.
- `eval` still uses mixed legacy-style response/tool-id fields and manual payload assembly.
- `auth` has `items` in save contract but not draft contract.
- Product-requested parity candidates still pending:
  - rubric typed flags (e.g. simulation/benchmark rubric mode),
  - profile route-resource scope confirmation,
  - setting MCP consistency across get/save/draft/generation.

Execution order for one-pass migration:
1. `setting` + `eval` contract migrations.
2. `auth.items` draft parity.
3. rubric/profile/setting requested parity additions.
4. cleanup simplification for remaining partial-parity artifacts.

### Provider Migration Snapshot (2026-02-10)

- `provider` is now hard-migrated to section-action contracts for both save and draft:
  - `names`, `descriptions`, `flags`, `departments`, `values`, `endpoints`, `keys`
  - action shapes:
    - single: `{ resource_id, create_tool_id, link_tool_id }`
    - multi: `{ resource_ids, create_tool_id, link_tool_id }`
- Frontend `Provider.tsx` now builds save/draft payloads using:
  - `buildResourceActions`
  - `computeEffectiveFormState`
  - `checkHasResourceIds`
- Provider SQL save now records tool-call lineage (`create_tool_id` / `link_tool_id`) into `calls_entry` and `*_calls_connection` tables for all persisted resource sections.

### Settings Migration Snapshot (2026-02-10)

- `setting` save/draft contracts are now section-action based in API + SQL:
  - single: `names`, `descriptions`, `flags`
  - multi: `colors`, `departments`, `profiles`, `auths`, `provider_keys`, `auth_keys`, `roles`, `role_routes`
- Save SQL now persists setting-key junctions directly:
  - `setting_provider_keys_junction`
  - `setting_auth_keys_junction`
  - `setting_role_routes_junction`
- Frontend save/draft payload construction in `Setting.tsx` now emits section-action payloads.
- `Setting.tsx` hard-migration cleanup completed:
  - removed legacy/non-existent fields (`show_providers`, `provider_resources`, `providers_agent_id`, `basic_agent_id`, `general_agent_id`)
  - removed invalid creatable wiring for non-creatable resources (`flags`, `departments`)
  - aligned component props to resource contracts (no `agent_id` props on Names/Descriptions/Colors/Auths/FlagsLegacy/Departments)
  - kept pair-resource hydration through `provider_keys/get` and `auth_keys/get`

### Settings Artifact Resource Contract (Post-Migration)

Persisted settings resources:
- `auths`
- `auth_keys`
- `provider_keys`
- `profiles`
- `roles`
- `role_routes`

Derived/catalog resources:
- `routes` are lookup/catalog data for role-route editors; they are not a direct persisted settings contract resource.

Hard migration rules:
- Do not return direct `providers` or `keys` as settings resources in new contracts.
- Socket generation must route by `resource_agent_ids` using `resource_types`.
- Save/draft payloads should use:
  - `provider_key_ids`
  - `key_ids` (maps to `auth_keys` section action in save/draft payload)
  - `role_route_ids`
- `flags` and `departments` are selection-only/non-creatable in v5 resources:
  - do not call `POST /api/v5/resources/flags`
  - do not call `POST /api/v5/resources/departments`

Settings resource endpoint families (required):
- `provider_keys`
  - `POST /api/v5/resources/provider_keys`
  - `POST /api/v5/resources/provider_keys/get`
  - `POST /api/v5/resources/provider_keys/search`
- `auth_keys`
  - `POST /api/v5/resources/auth_keys`
  - `POST /api/v5/resources/auth_keys/get`
  - `POST /api/v5/resources/auth_keys/search`

Frontend implementation note:
- `auth_keys` creation requires `(auth_id, key_id)` pair semantics.
- `provider_keys` creation requires `(provider_id, key_id)` pair semantics.
- Do not wire `keys` create directly for settings auth-key creation; use dedicated pair-based pickers/actions.
- Settings UI should use dedicated nested resource components:
  - `ProviderKeys.tsx` (provider -> keys)
  - `AuthKeys.tsx` (auth -> keys)
- Pair components should hydrate selected resource IDs via `*/get` endpoints when details are not preloaded, then emit only resource IDs (`provider_key_ids`, `auth_key_ids`) to artifact draft/save payloads.

### Departments/Auth/Rubrics Parity Audit (2026-02-10)

- Department frontend parity fix:
  - `Department.tsx` now treats `settings.current` as non-generated lookup data (no `generated` checks on `QGetSettingsV4Item`).
  - Step-card AI button wiring uses string adapters (`resourceTypes` + `isGenerating`) to match shared `StepCardAiButton` contract.
- Auth + Rubric audit status:
  - Frontend generation routing uses `resource_types`.
  - Server socket generation resolves agents from `resource_agent_ids`.
  - No legacy `domain_id`/`domains` routing usage found in generate flows.
- Regression guard:
  - Keep `current` arrays section-scoped in client contracts (`section.current`), never restore top-level `current`.
  - Avoid passing `*_agent_id` props into resource components; tool routing remains section-driven (`create_tool_id`/`link_tool_id`) and socket-side (`resource_agent_ids`).

---

## 18. Resource-First List Pattern

List endpoints should only touch the artifact's own table + its own junctions + resource tables. No cross-entity artifact tables (e.g., `scenario_artifact`, `field_artifact`).

### Principle

The only artifact table a list SQL touches is `{artifact}_artifact`. Everything else is the artifact's own junctions or resource tables with denormalized data.

### Below-Facing Metadata (artifact's own data)

```
{artifact}_artifact (root)
  → {artifact}_names_junction → names_resource (name)
  → {artifact}_descriptions_junction → descriptions_resource (description)
  → {artifact}_colors_junction → colors_resource (color)
  → {artifact}_icons_junction → icons_resource (icon)
  → {artifact}_flags_junction → flags_resource (active flag)
  → {artifact}_departments_junction → departments_resource (department_ids)
  → {artifact}_parameter_fields_junction → parameter_fields_resource → fields_resource (field data)
```

### Above-Facing Filters (parents that reference this artifact)

Use denormalized arrays on resource tables instead of traversing parent artifact junctions:

```
{artifact}_artifact
  → {artifact}_{artifact}s_junction → {artifact}s_resource (bridge to resource layer)
    → parent_resource WHERE {artifact}s_resource.id = ANY(parent_resource.{artifact}_ids)
```

Example (persona → scenarios):
```
persona_artifact
  → persona_personas_junction → personas_resource
    → scenarios_resource WHERE personas_resource.id = ANY(scenarios_resource.persona_ids)
```

This replaces the old pattern of joining through `scenario_personas_junction` + `scenario_tree_junction` + `scenario_artifact`.

### Filter ID Convention

- Filter IDs are always **resource IDs** (e.g., `scenarios_resource.id`, `fields_resource.id`, `departments_resource.id`), never artifact IDs
- Filter option names come from denormalized `*_resource.name` / `*_resource.description` columns
- This eliminates joins to `{entity}_names_junction` / `{entity}_descriptions_junction` for filter options

### Permission Data

- `active_scenario_count` / `total_scenario_links`: computed from denormalized resource data (e.g., `scenarios_resource.persona_ids`)
- The delete endpoint has its own independent access check SQL — list permission counts are for UI display only

### Denormalization Responsibilities

Save endpoints must keep denormalized arrays in sync:
- When linking/unlinking a persona to a scenario, the scenario save must update `scenarios_resource.persona_ids`
- Migration backfill scripts populate denormalized arrays from junction tables

### Reference Implementation

```
server/app/v5/sql/queries/personas/get_personas_list_complete.sql
```

Tables touched: `persona_artifact`, `persona_*_junction` (7 junctions), `names_resource`, `descriptions_resource`, `colors_resource`, `icons_resource`, `flags_resource`, `departments_resource`, `parameter_fields_resource`, `fields_resource`, `personas_resource`, `scenarios_resource`

Tables NOT touched: `scenario_artifact`, `field_artifact`, `department_artifact`, `view_persona_edit_state`, `scenario_personas_junction`, `scenario_tree_junction`, `field_fields_junction`, `department_departments_junction`, `department_names_junction`
