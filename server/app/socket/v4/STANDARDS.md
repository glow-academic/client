# WebSocket v4 Standards

This document defines the standards and best practices for WebSocket v4 event handlers. These standards ensure consistency, maintainability, and adherence to the agents-style architecture pattern using PostgreSQL functions with composite types.

## Overview

WebSocket v4 endpoints follow the agents-style architecture pattern, which uses:

- **PostgreSQL functions** with `RETURNS TABLE` instead of raw SQL queries
- **Composite types** in the `types` schema for strongly typed nested structures
- **Auto-generated Pydantic models** from SQL introspection instead of manual type definitions
- **Single SQL file per event** with idempotent drop/recreate pattern
- **Automatic type conversion** via `execute_sql_typed()` helper
- **Strong typing** for both inputs and outputs

## Key Principles

### 1. One Event Per File, One SQL File Per Event

**⚠️ CRITICAL: One Event Per File, One SQL File Per Event, No Inline SQL**

- **One event definition per file**: Each Python file defines exactly one event handler (`@sio.event` or `@internal_sio.on`)
- **One SQL file per WebSocket event**: Each event has exactly one SQL file in `server/app/sql/v4/[resource]/[operation]_complete.sql`
- **No inline SQL**: All SQL must be in the `.sql` file, never embedded as strings in Python code
- **Function-based**: SQL files define PostgreSQL functions, not raw queries
- **File naming**: Pattern `[operation]_[resource]_complete.sql` (e.g., `get_rubric_run_context_and_create_run_complete.sql`)

**Why This Matters:**

- ✅ Type generation requires SQL files to introspect function signatures
- ✅ SQL files can be version controlled and reviewed independently
- ✅ No SQL string concatenation or dynamic SQL in Python code
- ✅ Clear separation: SQL logic in `.sql` files, Python logic in event handlers
- ✅ One event = one file = one SQL function ensures proper typing and separation

### 2. Profile ID from `sid` Lookup

- **Never pass `profile_id` in payloads**: Always retrieve via `find_profile_by_socket(sid)` - O(1) Redis lookup
- **SQL functions include `profile_id`**: Functions receive `profile_id` as a parameter (from `sid` lookup)
- **Consistent pattern**: All event handlers retrieve `profile_id` from `sid` before calling SQL functions

### 3. `group_id` Pattern

- **First events**: No `group_id` in payload → SQL creates group → Returns `group_id` and `trace_id`
- **Regenerate events**: `group_id` required in payload → SQL uses existing group → Returns same `group_id` and `trace_id`
- **SQL functions**: `group_id uuid DEFAULT NULL` → Handles both cases (NULL = create, provided = use existing)

### 4. `trace_id` from Groups Table

- **`trace_id` already exists**: `groups.trace_id` has `DEFAULT gen_trace_id()` - never NULL
- **No manual generation**: `trace_id` comes from `groups.trace_id` via SQL query
- **All runs in group share `trace_id`**: Retrieved from groups table, not generated per event
- **Never pass `trace_id` in payloads**: Always pass `group_id`, retrieve `trace_id` from SQL
- **SQL returns `trace_id`**: All SQL functions that work with groups return `trace_id` from `groups.trace_id`

### 5. Rate Limiting and Run Creation

**⚠️ CRITICAL: Always Check Rate Limits and Create Runs**

**Key Requirements:**

1. **Rate Limit Validation**: Every time we create a run, rate limits MUST be validated in SQL
2. **Run Creation**: Every time we run an agent, a run MUST be created
3. **Atomic Operation**: Context fetching and run creation MUST happen atomically in a single SQL transaction

**Pattern: Centralized Generation Dispatch via `generate_start`**

**⚠️ CRITICAL: All generation requests flow through `generate_start`**

All agent generation handlers dispatch to `generate_start` (`server/app/socket/v4/generate/start.py`), which:

1. **Creates group** (if not provided) - Gets or creates `group_id` and `trace_id`
2. **Validates rate limits** - Checks rate limits using `validate_rate_limit()` function (raises exception if exceeded)
3. **Creates run** - Inserts into `runs` table with all junction records (run_profiles, group_runs, etc.)
4. **Creates user message** (if `user_instructions` provided) - For regeneration scenarios
5. **Links existing messages** - Links system/developer messages from previous runs in the group
6. **Dispatches to modality handlers** - Routes to text/image/video/audio handlers based on `agent_role`

**SQL Function**: `get_generation_run_context_and_create_run_complete.sql`

- **Location**: `server/app/sql/v4/queries/generate/start/get_generation_run_context_and_create_run_complete.sql`
- **Returns**: `run_id`, `group_id`, `trace_id`, `message_ids` (includes new user message if created, developer messages if created, and context message IDs)
- **Parameters**: `agent_id`, `resource_id`, `resource_type`, `profile_id`, `message_ids` (optional), `department_id` (optional), `group_id` (optional), `user_instructions` (optional), `developer_message_contents` (optional array of pre-rendered developer message content strings)

**Modality Handlers**: After `generate_start` creates the run, modality handlers (text, image, video, audio) fetch context for the existing run:

- **Text**: `get_text_run_context_for_existing_run_complete.sql` - Fetches agent config, tools, messages, etc. for existing `run_id`
- **Image/Video/Audio**: Similar pattern - fetch context for existing `run_id` (no run creation, no rate limiting)

**Legacy Pattern (Deprecated)**: Some older agents may still use the direct pattern `get_[operation]_run_context_and_create_run_complete.sql` that combines context fetching and run creation. These should be migrated to use `generate_start`.

**Developer Message Creation**: Agents can create developer messages with agent-specific logic by:

1. **Fetching developer instruction template** in agent start handler using `get_developer_instruction_complete.sql`
2. **Rendering Jinja template** with agent-specific context variables
3. **Passing content strings** to `generate_start` via `developer_message_contents` parameter (array of strings)
4. **Automatic creation**: `generate_start` creates developer messages atomically with run creation, includes message IDs in `message_ids` array
5. **Generic handlers**: Modality handlers receive developer messages via `message_ids`, no template fetching or rendering

**Example Pattern** (from `hint/start.py`):

```python
# Fetch and render developer instruction template
developer_message_contents: list[str] = []
try:
    dev_instruction_params = GetDeveloperInstructionSqlParams(
        instruction_type="hint",
        agent_role_val="hint",
    )
    dev_instruction_result = await execute_sql_typed(
        conn,
        "app/sql/v4/queries/developer_instructions/get_developer_instruction_complete.sql",
        params=dev_instruction_params,
    )
    if dev_instruction_result and dev_instruction_result.template:
        template = Template(dev_instruction_result.template)
        developer_message_content = template.render(
            # Agent-specific context variables
        )
        if developer_message_content and developer_message_content.strip():
            developer_message_contents.append(developer_message_content)
except Exception:
    pass  # No developer instruction configured

# Pass to generate_start
await internal_sio.emit("generate_start", {
    # ... other fields ...
    "developer_message_contents": developer_message_contents if developer_message_contents else None,
})
```

### 6. Required Event Files for Main Operations

For main operations (generate, regenerate), **ALL** of the following event files are **REQUIRED**:

1. **`generate.py`**: Handles the generation/processing event (client-to-server) - **REQUIRED**
   - Event name: `rubric_generate`, `scenario_generate`, etc.
   - SQL function: `socket_get_rubric_run_context_and_create_run_v4(...)`
   - Runs AI agent, performs database operations
   - Emits progress/complete/error events via `emit_to_internal()` (server-to-server)

2. **`regenerate.py`**: Handles regeneration events (client-to-server) - **REQUIRED**
   - Event name: `rubric_regenerate`, `scenario_regenerate`, etc.
   - SQL function: `socket_get_rubric_regeneration_run_context_and_create_run_v4(...)`
   - Uses `group_id` to get previous context from previous run
   - Takes user instructions for second turn
   - Runs same agent as generate (second turn)

3. **`progress.py`**: Handles progress update events (server-to-server) - **REQUIRED**
   - Event name: `rubric_progress`, `scenario_progress`, etc.
   - SQL function: `socket_rubric_generation_progress_v4(...)` (can be no-op)
   - Receives internal event, emits progress events to client with typed payload

4. **`complete.py`**: Handles the completion event (server-to-server) - **REQUIRED**
   - Event name: `rubric_complete`, `scenario_complete`, etc.
   - SQL function: `socket_rubric_generation_complete_v4(...)` (can be no-op)
   - Receives internal event, emits final completion event to client with typed payload

5. **`error.py`**: Handles error events (server-to-server) - **REQUIRED**
   - Event name: `rubric_error`, `scenario_error`, etc.
   - SQL function: `socket_rubric_generation_error_v4(...)` (can be no-op)
   - Receives internal event, emits error events to client with typed payload

### 7. Tool Event Structure - Tools Under Agents

For tools, use the **agent/tools/tool_name folder structure**. Each tool folder contains **ALL REQUIRED** event files:

- `server/app/socket/v4/agents/[agent_name]/tools/[tool_name]/` - Tool folder under agent
- `call.py` - One event: `[agent_name]_tool_[tool_name]` (server-to-server, `@internal_sio.on`) - **REQUIRED**
- `complete.py` - One event: `[agent_name]_tool_[tool_name]_complete` (server-to-server, `@internal_sio.on`) - **REQUIRED**
- `error.py` - One event: `[agent_name]_tool_[tool_name]_error` (server-to-server, `@internal_sio.on`) - **REQUIRED**
- `progress.py` - One event: `[agent_name]_tool_[tool_name]_progress` (server-to-server, `@internal_sio.on`) - **REQUIRED**
- `eval.py` - One event: `[agent_name]_tool_[tool_name]_eval_start` (server-to-server, `@internal_sio.on`) - **REQUIRED**

**Examples:**
- `server/app/socket/v4/agents/scenario/tools/title/` - Scenario agent's title tool
- `server/app/socket/v4/agents/document/tools/title/` - Document agent's title tool
- `server/app/socket/v4/agents/rubric/tools/title/` - Rubric agent's title tool

**Note:** Tools can be shared across multiple agents. Each agent gets its own copy of shared tools with agent-specific event names (e.g., `scenario_tool_title`, `document_tool_title`, `rubric_tool_title`).

### 8. Eval Event Pattern - Lightweight Execution with Benchmark-Level Completion

**⚠️ CRITICAL: Eval handlers are lightweight and propagate completion/errors to orchestrators**

**Key Principles:**

- **No individual `*_eval_complete` events**: Eval handlers do NOT emit agent/tool-specific completion events (e.g., `rubric_eval_complete`, `simulation_eval_complete`)
- **Single benchmark-level completion**: All eval handlers emit `benchmark_eval_complete` event (not `*_eval_complete`)
- **Error propagation**: Errors propagate to `benchmark_error` handler (centralized error handling)
- **SQL-generated types**: Eval handlers use SQL-generated types (`*EvalStartApiRequest`, `*EvalStartSqlParams`, `*EvalStartSqlRow`), NOT manual BaseModel definitions
- **One SQL file per eval**: Each eval operation has exactly one SQL file following the pattern `[agent/tool]_eval_start_complete.sql`
- **Lightweight focus**: Eval handlers focus on execution logic only - completion sequencing and client communication handled by orchestrators

**Completion Flow:**

```
eval.py executes (lightweight, no completion event)
  ↓
eval.py emits benchmark_eval_complete (single benchmark-level event)
  ↓
next.py listens for benchmark_eval_complete, tracks completion
  ↓
When all evals complete → next.py emits benchmark_advance (internal)
  ↓
advance.py emits benchmarks_advanced (client-facing)
```

**Error Flow:**

```
eval.py encounters error
  ↓
eval.py emits benchmark_error (centralized error handler)
  ↓
benchmark/error.py emits benchmarks_error (client-facing)
```

**Pattern for Agent eval.py Files:**

```python
from app.sql.types import (
    SimulationEvalStartApiRequest,
    SimulationEvalStartSqlParams,
    SimulationEvalStartSqlRow,
)

async def _simulation_eval_impl(
    sid: str,
    data: SimulationEvalStartApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    try:
        async with get_db_connection() as conn:
            params = SimulationEvalStartSqlParams(
                **data.model_dump(),
                profile_id=profile_id,
                group_id=group_id,
            )
            result = await execute_sql_typed(conn, SQL_PATH, params=params)
            # ... eval logic ...
            
            # Emit benchmark-level completion (not agent-specific)
            await emit_to_internal(
                "benchmark_eval_complete",
                {
                    "test_id": data.test_id,
                    "attempt_id": data.attempt_id,
                    "eval_id": data.eval_id,
                    "run_id": data.run_id,
                    "group_id": data.group_id,
                    "agent_id": data.agent_id,
                    "tool_id": None,
                    "success": True,
                    "message": "Eval completed successfully",
                },
                sid=sid,
            )
    except Exception as e:
        # Propagate to benchmark_error handler
        await emit_to_internal(
            "benchmark_error",
            {
                "attempt_id": data.attempt_id,
                "eval_id": data.eval_id,
                "test_id": data.test_id,
                "run_id": data.run_id,
                "group_id": data.group_id,
                "error_message": str(e),
            },
            sid=sid,
        )
```

**Pattern for Tool eval.py Files:**

Similar pattern but with `tool_id` instead of `agent_id`:
- Import SQL-generated types (`[Tool]EvalStartApiRequest`, etc.)
- Execute eval logic
- Emit `benchmark_eval_complete` with `tool_id` set, `agent_id=None`
- On error, emit `benchmark_error`

**Required Files:**

- **`benchmark/error.py`**: Centralized error handler for all benchmark eval errors
- **`benchmark/eval_complete.py`**: Handler for `benchmark_eval_complete` events (used by next.py for sequencing)
- **`benchmark/next.py`**: Listens for `benchmark_eval_complete` and handles sequencing/advancement
- **`benchmark/advance.py`**: Handles all client-facing completion events (`benchmarks_advanced`)

**Benefits:**

1. **Simplified Architecture**: Single completion event instead of 45+ different `*_eval_complete` events
2. **Clear Separation**: eval.py executes, next.py sequences, advance.py communicates
3. **Strong Typing**: All types auto-generated from SQL introspection
4. **Consistency**: All eval.py files follow identical pattern
5. **Maintainability**: Changes to SQL automatically update types

### 9. No JSONB - Use Composite Types

**⚠️ CRITICAL: JSONB is NEVER allowed, even for complex nested structures.**

**Key Principles:**

- **No JSONB in inputs**: Function parameters must use native PostgreSQL types (`uuid`, `text`, `uuid[]`, etc.) or composite types, never JSONB
- **Composite types for complex inputs**: If you need complex nested structures in request bodies, use composite types as function parameters
- **No JSONB in outputs**: Collections are arrays, not JSONB objects - Use `ARRAY_AGG(...)::types.composite_type[]` instead of `json_agg(jsonb_build_object(...))`
- **No JSONB parsing**: Composite types are automatically decoded by `asyncpg` and converted to Pydantic models
- **Lists everywhere**: All collections return as arrays of composite types, not nested JSONB structures

### 10. Zero Logging Pattern

- **Socket.IO handles ALL logging**: Event reception, emission, validation errors, connection issues, and framework errors are automatically logged by Socket.IO (`logger=True`, `engineio_logger=True`)
- **ZERO logging statements**: WebSocket endpoints should have **zero** `logger.info()`, `logger.error()`, `logger.warning()`, or `logger.debug()` calls
- **Emit error events instead**: When errors occur, emit error events via `sio.emit()` - don't log them
- **No exceptions**: Even business logic errors should emit error events, not log - Socket.IO will log the event emission

### 11. Database Connection Pattern

- **Use `get_db_connection()` helper**: Always use `get_db_connection()` from `app.infra.v4.websocket.get_db_connection` instead of manual pool checks
- **No manual pool checks**: Never check `get_pool()` manually - `get_db_connection()` handles it and raises `RuntimeError` if pool unavailable
- **Consistent with HTTP routes**: Same pattern as HTTP routes using `Depends(get_db)` - clean, consistent, and maintainable
- **Error handling**: Catch `RuntimeError` and emit error events (don't log - Socket.IO already logs framework errors)

### 12. Eliminating Cross-File Dependencies

- **No cross-file imports**: Each file is independent - never import emit functions from other event files
- **Use `emit_to_internal()` with event name strings**: Instead of importing functions, use `emit_to_internal()` with event name strings
- **Event chaining via internal bus**: Events chain via internal bus using typed payloads, not direct function calls
- **Type-safe payloads**: Use auto-generated `SqlRow` types for event payloads

### 13. Type-Safe Event Chaining

When one event emits to another internal event, the payload MUST use the target event's auto-generated `{TargetEvent}ApiRequest` type or `SqlRow` type. This ensures:

- **Type safety**: Emitter and receiver use the same type from SQL introspection
- **Compile-time checking**: If SQL function signature changes, both emitter and receiver break at type-check time
- **Consistency**: All event chains follow the same pattern
- **Maintainability**: Changes to SQL function automatically update types for both sides

### 14. Type Annotations for Emit Functions

**⚠️ CRITICAL: Explicit Type Annotations Required for Emit Functions**

When passing BaseModel instances to `emit_to_client()` or `emit_to_internal()`, the type checker may not always infer the correct type. To ensure type safety and avoid linter errors, use explicit type annotations.

**Pattern:**

```python
# ❌ BAD: Direct instantiation in emit call (may cause type inference issues)
await emit_to_internal(
    "hint_error",
    HintErrorApiRequest(
        success=False,
        message="Error message",
        resource_id=str(chat_id),
        group_id=str(group_id) if group_id else None,
    ),
    sid=sid,
)

# ✅ GOOD: Explicit type annotation before emit call
error_payload: HintErrorApiRequest = HintErrorApiRequest(
    success=False,
    message="Error message",
    resource_id=str(chat_id),
    group_id=str(group_id) if group_id else None,
)
await emit_to_internal(
    "hint_error",
    error_payload,
    sid=sid,
)
```

**Why This Matters:**

- **Type inference**: Type checkers may infer BaseModel constructors as `dict[str, Any]` instead of the BaseModel type
- **Compile-time safety**: Explicit annotations ensure the type checker recognizes the correct type
- **Consistency**: All emit calls follow the same pattern for maintainability
- **No type ignores**: Eliminates the need for `# type: ignore[arg-type]` comments

**When to Use:**

- Always use explicit type annotations when creating BaseModel instances for emit functions
- Use descriptive variable names: `error_payload`, `response_payload`, `progress_payload`, etc.
- Keep the pattern consistent across all emit calls in the codebase

## Infrastructure Helpers

**⚠️ CRITICAL: Use Infrastructure Helpers for Consistency**

All WebSocket endpoints should use the infrastructure helpers to ensure consistency, eliminate boilerplate, and follow DHH principles.

**Available Helpers:**

1. **`typed_emit.py`**: Typed wrappers for Socket.IO emit operations
   - `emit_to_client(event_name, payload, room)` - Emit typed event to client
   - `emit_to_internal(event_name, payload, sid, group_id)` - Emit typed event to internal bus

2. **`handler_wrapper.py`**: Wrappers for common event handler patterns
   - `handle_client_event(sid, data, request_type, handler, error_event_name, error_response_type)` - Client-to-server wrapper
   - `handle_internal_event(data, request_type, handler, error_event_name, error_response_type)` - Server-to-server wrapper

3. **`openapi_helpers.py`**: Helpers for registering FastAPI endpoints
   - `register_client_endpoint(router, path, request_type, description)` - Register client-to-server endpoint
   - `register_server_endpoint(router, path, response_type, description)` - Register server-to-client endpoint

## Common Patterns

### Client Event Handler (Using Infrastructure Helpers)

```python
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client, emit_to_internal
from app.main import sio
from app.sql.types import (
    GetRubricRunContextApiRequest,
    GetRubricRunContextSqlParams,
    GetRubricRunContextSqlRow,
    RubricGenerationErrorSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/rubrics/get_rubric_run_context_complete.sql"

@sio.event  # type: ignore
async def rubric_generate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GetRubricRunContextApiRequest,
        handler=_rubric_generate_impl,
        error_event_name="rubrics_generation_error",
        error_response_type=RubricGenerationErrorSqlRow,
    )

async def _rubric_generate_impl(
    sid: str,
    data: GetRubricRunContextApiRequest,
    profile_id: uuid.UUID
) -> None:
    """Internal implementation using typed SQL execution"""
    try:
        async with get_db_connection() as conn:
            params = GetRubricRunContextSqlParams(
                **data.model_dump(),
                profile_id=profile_id
            )
            result = cast(
                GetRubricRunContextSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )
            # Emit response using typed wrapper
            await emit_to_client("rubrics_generation_complete", result, room=sid)
    except RuntimeError:
        # Pool not initialized - emit error event
        await emit_to_client(
            "rubrics_generation_error",
            RubricGenerationErrorSqlRow(
                success=False,
                message="Database connection pool not available",
            ),
            room=sid,
        )
```

### Internal Event Handler (Using Infrastructure Helpers)

```python
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from app.sql.types import (
    UpdateStandardDescriptionsApiRequest,
    UpdateStandardDescriptionsSqlParams,
    UpdateStandardDescriptionsSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()
SQL_PATH = "app/sql/v4/queries/rubrics/update_standard_descriptions_complete.sql"

@internal_sio.on("rubric_tool_standard_group_descriptions")
async def rubric_tool_standard_group_descriptions_internal(
    data: dict[str, Any],
) -> None:
    """Handle event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=UpdateStandardDescriptionsApiRequest,
        handler=_rubric_tool_standard_group_descriptions_impl,
        error_event_name="rubrics_generation_error",
        error_response_type=RubricGenerationErrorSqlRow,
    )
```

## Common Pitfalls

### Pitfall 1: Manual Pool Checks and Logging

```python
# ❌ BAD: Manual pool check
pool = get_pool()
if not pool:
    logger.error("Database connection pool not available")
    return

# ❌ BAD: Any logging at all
logger = get_logger(__name__)
logger.info(f"Received rubric_generate request from {sid}")

# ✅ GOOD: Use get_db_connection() helper - NO logger imports
from app.infra.v4.websocket.get_db_connection import get_db_connection

try:
    async with get_db_connection() as conn:
        # ...
except RuntimeError:
    # Pool not initialized - emit error event (Socket.IO logs automatically)
    await emit_to_client("rubrics_generation_error", ...)
```

### Pitfall 2: JSONB in WebSocket Events

```python
# ❌ BAD: Manual JSONB conversion
import json
descriptions_json = json.dumps(validated.descriptions)
result = await conn.fetchrow(sql, str(rubric_id_uuid), descriptions_json)

# ✅ GOOD: Composite type array
params = UpdateStandardDescriptionsSqlParams(
    rubric_id=rubric_id_uuid,
    descriptions=[  # List of composite type objects
        UpdateStandardDescriptionsDescription(...)
        for desc in validated.descriptions
    ],
    profile_id=profile_id
)
result = await execute_sql_typed(conn, SQL_PATH, params=params)
```

### Pitfall 3: Missing Profile ID Lookup

```python
# ❌ BAD: Passing profile_id in payload
@sio.event
async def rubric_generate(sid: str, data: dict[str, Any]) -> None:
    profile_id = data.get("profile_id")  # Never do this!

# ✅ GOOD: Retrieve profile_id from sid lookup
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket

@sio.event
async def rubric_generate(sid: str, data: dict[str, Any]) -> None:
    profile_id_str = await find_profile_by_socket(sid)  # O(1) Redis lookup
    if not profile_id_str:
        # Handle error
        return
    profile_id = uuid.UUID(profile_id_str)
```

### Pitfall 4: Manual Trace ID Generation

```python
# ❌ BAD: Manual trace_id generation
from agents import gen_trace_id

async def _rubric_generate_impl(...) -> None:
    trace_id = gen_trace_id()  # Never do this!

# ✅ GOOD: Retrieve trace_id from groups table via SQL
async def _rubric_generate_impl(...) -> None:
    # SQL function returns trace_id from groups.trace_id
    result = await execute_sql_typed(conn, SQL_PATH, params=params)
    trace_id = result.trace_id  # From groups.trace_id (never NULL)
    group_id = result.group_id  # Created or existing
```

## Testing Checklist

### SQL & Types

- [ ] **One event definition per file** (each Python file has exactly one `@sio.event` or `@internal_sio.on`)
- [ ] **One SQL file per event** (e.g., `update_standard_descriptions_complete.sql`)
- [ ] **Separate event files for main operations** (if using `generate.py`, always have separate `regenerate.py`, `progress.py`, `complete.py`, `error.py` - ALL REQUIRED)
- [ ] **Tool folder structure** (tool name as folder: `standard_group_descriptions/` not `tools/standard_group_descriptions.py`)
- [ ] **Tool event files** (tools must have `call.py`, `complete.py`, `error.py`, `progress.py` - ALL REQUIRED, no regenerate.py)
- [ ] **No inline SQL** (all SQL in `.sql` files, none in Python code)
- [ ] **No JSONB parsing in event handler** - No `json.loads()` or `json.dumps()` calls
- [ ] **No JSONB in inputs** - Function parameters use native PostgreSQL types or composite types, never JSONB
- [ ] **All JSONB aggregations converted** - No `jsonb_build_object`, `json_agg`, or `jsonb_agg` in SQL files
- [ ] **Profile ID from `sid` lookup** - Always retrieve via `find_profile_by_socket(sid)`, never in payloads
- [ ] **`group_id` pattern** - First events omit it (SQL creates), regenerate events require it (from previous run)
- [ ] **`trace_id` from groups** - Always retrieve from `groups.trace_id` via SQL, never generate manually
- [ ] **Rate limit validation** - Always check rate limits when creating runs (in SQL, not Python)
- [ ] **Run creation** - Always create a run every time we run an agent (atomic with context fetch)
- [ ] **Zero logging** - Remove ALL logger imports and logger calls - Socket.IO handles all logging

### WebSocket Event Testing

- [ ] Test all events via WebSocket client
- [ ] Verify collections are arrays, not dicts/JSONB objects
- [ ] Verify no JSONB parsing errors in server logs
- [ ] Internal events chain correctly via `internal_sio.emit()`
- [ ] Session ID (`sid`) handled correctly in internal events
- [ ] Profile ID retrieved from `sid` lookup (O(1) Redis) in all event handlers
- [ ] `group_id` handled correctly (omitted for first events, required for regenerate events)
- [ ] `trace_id` retrieved from `groups.trace_id` via SQL (never generated manually)

## Reference Implementation

**⚠️ MIGRATION STATUS: The hint agent (`server/app/socket/v4/agents/hint/`) is the fully migrated reference implementation following all standards, including explicit type annotations. Other routes may not yet be fully migrated to this pattern.**

### Fully Migrated Reference Implementations

**Hint Agent (Fully Migrated - Reference Implementation):**
- `server/app/socket/v4/agents/hint/start.py` - Client event handler with explicit type annotations
- `server/app/socket/v4/agents/hint/end.py` - Completion handler with explicit type annotations
- `server/app/socket/v4/agents/hint/error.py` - Error handler with explicit type annotations
- `server/app/socket/v4/agents/hint/tools/hint.py` - Tool handler with explicit type annotations
- `server/app/socket/v4/agents/hint/tools/debug.py` - Tool handler with explicit type annotations

**Key Features of Hint Agent (Reference Pattern):**
- ✅ All SQL in separate `.sql` files (no inline SQL)
- ✅ All types imported from `app.sql.types` (auto-generated)
- ✅ Explicit type annotations for all emit calls (section 14 pattern)
- ✅ Centralized error handling via `hint_error` handler
- ✅ Uses `execute_sql_typed()` for all SQL execution
- ✅ No manual parsing - uses typed models throughout
- ✅ Follows Generation Dispatch System pattern (dispatches to `generate_start`)

### Legacy Reference Implementations (May Not Be Fully Migrated)

**Rubrics (Legacy - May Need Migration):**
- `server/app/socket/v4/rubrics/standard_group_descriptions/` - Tool events (may need type annotation updates)
- `server/app/socket/v4/rubrics/generate.py`, `regenerate.py`, `progress.py`, `complete.py`, `error.py` - Main operations (may need type annotation updates)

**Note:** When migrating other routes, use the hint agent as the reference for the complete pattern, including explicit type annotations (section 14).

## Benefits

1. **Strong Typing**: PostgreSQL enforces types at database level, Pydantic enforces at API level
2. **Type Safety**: All types generated from SQL, no drift between SQL and Python
3. **Maintainability**: Single SQL file, clear function signature, idempotent migrations
4. **Performance**: No JSONB aggregation overhead - composite types are more efficient, direct type decoding without parsing
5. **Consistency**: All websocket handlers follow the same pattern via helpers
6. **Zero Logging**: Socket.IO handles all logging automatically
7. **Type safety**: Compile-time checking with auto-generated types

