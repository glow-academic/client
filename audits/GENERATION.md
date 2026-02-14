# Generation Architecture — Multi-Agent Token Factory Design

You are a generation architecture guide for the GLOW project. Your job is to understand and enforce the principles governing how artifact generation works: the separation between domain handlers and the token factory, the multi-agent model, and how runs, agents, and config entries relate.

---

## The Two-Layer Design

Generation is split into two layers with a strict boundary:

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Domain Handlers** | `server/app/socket/v4/artifacts/{domain}/generate.py` | Business logic: validation, agent resolution, run creation, message building, config hydration. Emits `generate_artifact` events. |
| **Token Factory** | `server/app/socket/v4/artifacts/generate.py` | Pure AI: receives a single `GenerateArtifactPayload`, streams model outputs, executes tools, emits progress/complete/error events. No database mutations. No domain knowledge. |

The token factory is domain-agnostic. It does not know about personas, simulations, or any specific resource type. It receives pre-rendered messages, a fully resolved `llm_config`, and optional tools. It streams tokens and emits socket events.

Domain handlers are the orchestrators. They know which agents exist, which resource types map to which agents, how to build Jinja contexts, and when to create runs. They prepare everything the token factory needs and emit one or more `generate_artifact` events.

---

## The Config Chain

### Database Tables

```
config_entry                    — Thin grouping entity (id, timestamps, active)
    ↓ config_agents_connection
agents_resource                 — Agent config (temperature, reasoning, tool_ids, prompt_id, instruction_ids, voice, quality)
    ↓ agents_resource.model_id
models_resource                 — Model config (name, value, provider_id, endpoint, key)
    ↓ models_resource.provider_id
providers_resource              — Provider config (name, value, endpoint, key)
```

### Materialized View

```
mv_config                      — Pre-joined denormalized view
    config_id   → config_entry.id
    agents_id   → agents_resource.id
    models_id   → models_resource.id
    providers_id → providers_resource.id
    tool_ids    → uuid[] (from agent)
```

A single `mv_config` row is the fully resolved triple: agent + model + provider. No manual chaining required.

---

## The Run Model

A **run** (`runs_entry`) represents one logical generation request — "the user clicked generate." A run has:

- One `run_id` (the encapsulating unit)
- One `group_id` (ties related runs across regenerations)
- One or more `generate_artifact` calls (one per agent)

All agents in the same generation request share the **same `run_id`**. The run is the persistence boundary — it records what happened, which agents participated, and what was produced. Multiple `generate_artifact` calls with the same `run_id` means multiple agents contributed to the same logical generation.

---

## Multi-Agent Generation

### The Problem

Each domain has a `resource_agent_ids` mapping: `{ resource_type: agent_id }`. Different resource types can be assigned to different agents. For example:

```
resource_agent_ids = {
    "names": agent_A,
    "descriptions": agent_A,
    "icons": agent_B,
    "instructions": agent_C,
}
```

### The Principle

**Change the input, not the function.** The token factory (`generate.py`) stays a single-agent-per-call function. Multi-agent orchestration lives in the domain handler.

### The Pattern

Domain handlers (e.g., `persona/generate.py`, `simulation/generate.py`) follow this flow:

1. **Shared setup** (runs once):
   - Validate `resource_types` and `draft_id`
   - Fetch domain data via `get_{domain}_websocket()`
   - Check rate limits
   - Build base Jinja context

2. **Group resource types by agent**:
   ```
   resource_agent_ids = { "names": A, "descriptions": A, "icons": B }
   requested = ["names", "descriptions", "icons"]

   → grouped:
     agent_A → ["names", "descriptions"]
     agent_B → ["icons"]
   ```

3. **Create one run** (shared across all agents):
   - One `run_id`, one `group_id`
   - The run is the logical unit that encapsulates the entire generation request

4. **For each unique agent** (can run concurrently via `asyncio.gather`):
   - Resolve agent/model/provider config (from pre-fetched resources or `mv_config`)
   - Validate the config triple exists and has an API key
   - Fetch tools (scoped to that agent's resource types), prompt, and instructions
   - Build and persist messages (all under the same `run_id`)
   - Emit `generate_artifact` with that agent's `llm_config`, `tools`, and `resource_types`

5. **The token factory handles each call independently**:
   - Each `generate_artifact` call is one agent, one agentic loop, one stream of events
   - Events are tagged with `run_id`, `group_id`, and `resource_type` for client-side correlation

---

## The Rules

### Rule 1: The token factory is single-agent-per-call

`generate.py` receives one `GenerateArtifactPayload` with one `llm_config` and one set of tools. It never resolves agents, models, or providers. It never creates runs. It never knows how many agents are involved.

### Rule 2: Domain handlers own multi-agent orchestration

All logic for grouping resource types by agent, resolving config chains, and deciding how many `generate_artifact` calls to make lives in the domain handler (`{domain}/generate.py`).

### Rule 3: One run per generation request

A single user action ("generate") produces one `run_id`. All agents contributing to that generation share the same `run_id`. The run is the persistence and traceability boundary.

### Rule 4: Group ID ties regenerations together

The `group_id` connects runs across regeneration cycles. If the user regenerates, a new `run_id` is created but the `group_id` persists.

### Rule 5: Agent resolution uses `resource_agent_ids`

Each domain's websocket response provides `resource_agent_ids: dict[str, UUID | None]` — a mapping from resource type to agent ID. Domain handlers group the requested `resource_types` by their assigned agent and emit one `generate_artifact` per unique agent.

### Rule 6: Config resolution uses the pre-fetched resources or `mv_config`

The websocket response pre-fetches `resources.agents`, `resources.models`, and `resources.providers`. Domain handlers resolve the agent → model → provider chain from these lists. Alternatively, `mv_config` provides the pre-joined triple directly.

### Rule 7: No agent collapsing

Domain handlers must NOT collapse multiple agents into one. If `resource_agent_ids` maps different resource types to different agents, each agent gets its own `generate_artifact` call. The previous pattern of picking "the first agent that matches" is incorrect.

### Rule 8: Concurrent agent execution is preferred

When multiple agents need to run for the same generation request, domain handlers should use `asyncio.gather` (or equivalent) to prepare and emit their `generate_artifact` calls concurrently. Each call is independent after the shared setup.

### Rule 9: Messages are persisted per agent under the shared run

Each agent may have different system prompts, developer instructions, and tools. Messages are built and persisted per agent, but all under the same `run_id`. The message history for a run reflects all agents that contributed.

### Rule 10: The client correlates by `run_id` + `resource_type`

The client receives multiple streams of events for a multi-agent generation. It correlates them using `run_id` (same generation) and `resource_type` (which agent produced what). The `group_id` is for cross-regeneration correlation.

### Rule 11: Resource events flow through per-resource socket handlers

The token factory emits internal events (`generate_call_start`, `generate_call_progress`, `generate_call_complete`, `generate_call_error`) on the internal socket bus. The resource dispatcher (`server/app/socket/v4/resources/dispatcher.py`) routes these events by `resource_type` to per-resource handler modules:

```
server/app/socket/v4/resources/{resource}/
  __init__.py     — OpenAPI POST endpoints for schema generation
  types.py        — Per-resource Pydantic event models
  start.py        — handle_start() → emits {resource}_generation_started
  progress.py     — handle_progress() → emits {resource}_generation_progress
  complete.py     — handle_complete() → hydrates via get_*_internal(), emits {resource}_generation_complete
  error.py        — handle_error() → emits {resource}_generation_error
```

Each handler emits a typed, per-resource client-facing event. Complete handlers hydrate resources via `get_*_internal()` and include typed fields (not raw dicts). Start/progress/error handlers emit base event types with resource_type-specific event names.

The dispatcher is the only file that registers `@internal_sio.on` listeners for resource events. Per-resource handlers are plain async functions, not socket listeners.

### Rule 12: The `save` flag controls artifact persistence on completion

`GenerateArtifactPayload` includes `save: bool = True`. Domain handlers set this based on the client's intent:

- `save=True` (default): After all agents complete, the completion handler auto-saves the artifact (e.g., creates a new persona). Used when generating from the list page.
- `save=False`: Generation runs but does not persist the artifact. Used when generating from the edit/get page where the user will manually save.

The `save` flag is threaded through: client payload → domain handler → `generate_artifact` emit → `run_complete` event → completion handler.

---

## File Locations

```
server/app/socket/v4/artifacts/generate.py              — Token factory (DO NOT add domain logic here)
server/app/socket/v4/artifacts/{domain}/generate.py      — Domain handlers (orchestration lives here)
server/app/socket/v4/artifacts/{domain}/complete.py      — Artifact completion handler (run_complete, text_complete)
server/app/socket/v4/artifacts/{domain}/progress.py      — Artifact progress handler (percentage tracking)
server/app/socket/v4/artifacts/{domain}/types.py         — Domain-specific payload types
server/app/socket/v4/artifacts/types.py                  — Shared event types (error, progress, complete)
server/app/socket/v4/resources/dispatcher.py             — Resource event dispatcher (routes by resource_type)
server/app/socket/v4/resources/{resource}/               — Per-resource handlers (start, progress, complete, error)
server/app/api/v4/artifacts/{domain}/get.py              — get_{domain}_websocket() (pre-fetches resources)
server/app/api/v4/artifacts/{domain}/types.py            — Websocket response types (resource_agent_ids, resources)
```

---

## GenerateArtifactPayload Shape

The token factory receives this payload per agent call:

```python
class GenerateArtifactPayload(BaseModel):
    sid: str | None = None
    run_id: str                           # Shared across all agents in the same generation
    group_id: str | None = None           # Shared across regenerations
    modality: str = "text"
    artifact_type: str | None = None      # e.g., "persona", "simulation"
    resource_type: str | None = None      # Primary resource type for this agent
    resource_types: list[str] | None = None  # All resource types this agent handles
    resource_id: str | None = None
    messages: list[dict[str, Any]]        # Pre-rendered messages (system, developer, user)
    llm_config: ModelConfig               # Fully resolved model config for this agent
    tools: list[dict[str, Any]] | None    # Tools available to this agent
    tool_timeout_seconds: float = 60.0
    save: bool = True                     # Whether to auto-save artifact on completion
```

Each field is fully resolved before reaching the token factory. No IDs to look up, no chains to resolve, no domain logic to apply.

---

## Important Notes

1. **The token factory is a dumb pipe.** It converts `GenerateArtifactPayload` into LLM API calls and socket events. Any intelligence about which agents to use, how to group resources, or how to build messages belongs in the domain handler.
2. **`mv_config` is the fast path.** When you need the full agent/model/provider triple, query `mv_config` instead of joining through three connection tables manually.
3. **`resource_agent_ids` is the source of truth** for which agent handles which resource type. It comes from the domain's websocket response and reflects the department/setting configuration.
4. **The agentic loop in the token factory** (up to 10 iterations of tool calling) is per-agent, not per-generation. Each `generate_artifact` call gets its own independent agentic loop.
5. **Rate limiting is checked once** during shared setup, before any agent-specific work begins. It applies to the generation request as a whole, not per-agent.
6. **Error isolation**: If one agent's `generate_artifact` call fails, other agents' calls are unaffected. The token factory emits `generate_error` for the failed agent; the others continue streaming.
