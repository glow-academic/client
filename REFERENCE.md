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
server/app/api/v4/artifacts/persona/get.py
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
server/app/socket/v4/artifacts/persona/generate.py
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

Reference: `server/app/socket/v4/artifacts/persona/complete.py`

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

Reference: `server/app/api/v4/artifacts/persona/permissions.py`

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

Reference: `server/app/sql/v4/views/config/mv_config.sql`, `server/app/api/v4/views/config/`

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
- Scenario resource workflow: deactivate old active resource link(s), create/link the new resource, then set the new link active
- Draft workflow: update links with optimistic versioning (`expected_version`)
- Tool-call tracking: create one `runs_entry` per save/draft mutation and create `calls_entry + tool_calls_junction` rows for each non-null `create_tool_id` / `link_tool_id`
- Frontend request contract should always send nested action objects for all sections to avoid manual per-field parsing drift

### Scenario Parity Rules (Persona-Style)

Use these as hard rules when implementing or refactoring Scenario:

- API response is section-first (`names`, `descriptions`, `flags`, etc.) so frontend code reads `s.<section>.<field>` instead of flattening dozens of one-off props.
- Frontend keeps a compact `stable{Artifact}DataFields` shape that stores section objects directly; avoid manually re-mapping every section field into new top-level aliases.
- Frontend render code uses `const s = stable{Artifact}DataFields` and passes section data directly (`s.names.resource`, `s.parameters.current`, etc.) to reduce line count and drift.
- Websocket `get_{artifact}_websocket()` returns only top-level `group_id`, `views`, `resources`, and `resource_agent_ids`.
- Websocket payload never returns top-level `current` or nested `resources.current`.
- Websocket resource payload always includes selected artifact resources plus hydrated config resources: `agents`, `models`, `providers`, `tools`.
- Do not expose `agent_id` (or `*_agent_id`) to frontend contracts; route agent selection internally via `resource_agent_ids`.
- Migration is hard-cut: remove legacy/dual-shape response types instead of supporting old + new formats indefinitely.
- Save/draft endpoints accept nested section action objects with `resource_id(s)`, `create_tool_id`, and `link_tool_id` (no manual flat parameter parsing).
- Save/draft SQL creates run/call/tool-call linkage for non-null tool IDs and applies resource workflow semantics (deactivate old active link, create/link new, set new active).
- Generation UI must use `StepCardAiButton` and section `show_ai_generate` flags; no custom ad-hoc button logic per step.

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

### Socket Handler (`socket/v4/artifacts/{artifact}/generate.py`)

- [ ] Client emits `resource_types: list[str]` — NOT domain_ids or agent_type
- [ ] Calls `get_{artifact}_websocket()` to get pre-fetched resources
- [ ] Resolves `agent_id` from `result.resource_agent_ids[resource_type]`
- [ ] Extracts LLM config from `result.resources.agents/models/providers` — no SQL hops
- [ ] Uses lean prepare SQL (mutations only: create group/run/config) — NOT multi-step context SQL
- [ ] Fetches tools/prompts/instructions from agent resource fields in parallel
- [ ] Injects `views.config` (from `get_config_internal`) and `views.draft_{artifact}` into Jinja context
- [ ] Jinja builder returns `response.resources.model_dump()` — flat dict, no `current` nesting
- [ ] Persists messages to DB before emitting to `generate_artifact`
- [ ] No legacy `agent_type` string routing

### Completion Handler (`socket/v4/artifacts/{artifact}/complete.py`)

- [ ] Filters by `artifact_type`
- [ ] Dispatches by `event_type` (text_complete, run_complete, tool_call_complete)
- [ ] Hydrates resources via `get_*_internal()` — not raw SQL
- [ ] Emits `{artifact}_generation_complete` with full resource objects

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
- [ ] Uses `useDraftLifecycle` for autosave
- [ ] Uses `useFlushRegistry` for resource creation
- [ ] Save/draft sends nested resource actions with tool IDs
- [ ] Does not consume `*_agent_id` fields
- [ ] Uses `*_show_ai_generate` flags for AI button visibility
- [ ] Avoids legacy domain/group identifiers in UI contracts
