# WebSocket Event Standards

## Overview

This document defines the standards and best practices for WebSocket event handlers in the server codebase. These standards ensure consistency, maintainability, and adherence to the single unit of work principle.

## Core Principles

### 1. Single Unit of Work

**Each websocket event must do exactly one thing.** Database operations should be separated into dedicated events.

**Pattern:**
- One event = one database operation (one SQL file)
- Complex operations chain multiple events via `internal_sio.emit()`
- Direct function calls between events are allowed when return values are needed, but events should also be registered for consistency

### 2. Atomic Context + Run Creation

**All AI operations must atomically get context and create run in a single SQL transaction.**

**Pattern:**
- Use SQL files like `get_[operation]_run_context_and_create_run.sql`
- These files validate rate limits and create runs atomically
- If run creation fails, entire transaction rolls back
- Rate limit validation happens in SQL, not Python

**Example:**
```python
# Good: Atomic context + run creation
sql = load_sql("sql/v3/agents/get_simulation_run_context_and_create_run.sql")
context_row = await conn.fetchrow(sql, str(chat_id_uuid))
model_run_id = uuid.UUID(context_row["run_id"])

# Bad: Separate context fetch and run creation
context_row = await conn.fetchrow("sql/v3/agents/get_simulation_run_context.sql", ...)
run_id = await _simulation_run_create_impl(...)
```

### 3. Standardized log_run Event Usage

**All AI operations must emit `log_run` event after completion.**

**Pattern:**
- Emit `log_run` via `internal_sio.emit()` after AI agent completes
- Include all required fields: `runId`, `operationType`, `inputTextTokens`, `outputTextTokens`, `systemPrompt`, `inputItems`, `assistantOutput`, `departmentId`
- This is async and non-blocking - failures are logged but don't break the event flow

**Example:**
```python
usage = result.context_wrapper.usage
assistant_output = getattr(result, "final_output", None) or ""
await internal_sio.emit(
    "log_run",
    {
        "runId": str(model_run_id),
        "operationType": "scenario",  # or "simulation", "document", etc.
        "inputTextTokens": usage.input_tokens,
        "outputTextTokens": usage.output_tokens,
        "systemPrompt": context["system_prompt"],
        "inputItems": input_items,
        "assistantOutput": assistant_output,
        "departmentId": str(department_id),
    },
)
```

### 4. No Inline SQL

**All SQL queries must be in separate .sql files.**

**Pattern:**
- Use `load_sql()` helper to load SQL files
- SQL files follow naming convention: `[operation]_[resource]_complete.sql` or `get_[resource]_[field].sql`
- One SQL file per database operation
- Exceptions: Complex CTE queries that are part of larger operations (documented with comments)

**Example:**
```python
# Good: SQL in separate file
sql = load_sql("sql/v3/departments/get_department_title.sql")
dept_row = await conn.fetchrow(sql, department_id)

# Bad: Inline SQL
dept_row = await conn.fetchrow("SELECT title FROM departments WHERE id = $1", department_id)
```

### 5. Event Chaining

**When an event needs to perform multiple operations, chain them via internal events.**

**Pattern:**
- Emit internal events for each database operation: `internal_sio.emit("event_name", {...})`
- Register handlers with `@internal_sio.on("event_name")`
- Export `_impl` functions for direct calls when return values are needed
- Prefer emitting events when possible for better decoupling

**Example:**
```python
# Good: Emit internal event for database operation
await internal_sio.emit(
    "scenario_tool_document",
    {
        "sid": sid,
        "trace_id": trace_id,
        "parent_document_id": parent_document_id,
        # ... other fields
    },
)

# Also good: Direct call when return value needed
run_id_str = await _simulation_run_create_impl(
    department_id, model_id, persona_id, profile_id, agent_id, sid
)
```

## SQL File Naming Convention

**Pattern:** `[operation]_[resource]_complete.sql`

**Examples:**
- `get_scenario_run_context_and_create_run.sql` - Atomic context + run creation
- `create_model_run_complete.sql` - Create run with all junctions
- `get_department_title.sql` - Simple get query
- `update_message_created_at.sql` - Update operation
- `mark_chat_completed.sql` - Update operation (mark as completed)

**Exceptions:**
- Some routes use multiple queries (e.g., `generate_questions.py`, `generate_outline.py`) - these are exceptions and should be documented with comments

## Common Patterns

### AI Operation Flow

1. **Get context + create run atomically** (SQL handles both in single transaction)
2. **Run AI agent** (`Runner.run()` or `Runner.run_streamed()`)
3. **Emit `log_run` event** via `internal_sio.emit("log_run", ...)` for token/pricing logging
4. **Emit completion event**

**Example:** `scenarios/generate.py`, `documents/generate.py`, `hints/generate.py`

### Database Operation Flow

1. **Event receives payload** (via `@sio.event` or `@internal_sio.on`)
2. **Performs single database operation** (one SQL file)
3. **Returns result or emits completion event** if needed

**Example:** `simulation_message_create`, `simulation_group_link`, `simulation_hints_create`

### Event Chaining

**When an event needs to perform multiple operations:**

1. Get context/validate input
2. Emit internal events for each database operation
3. Call `_impl` functions directly when return values are needed
4. Continue with remaining logic

**Example:** `simulation_text_send` chains:
- `simulation_run_create` (creates run)
- `simulation_group_link` (links run to group)
- `simulation_messages_link` (links system/developer messages)
- `simulation_message_create` (creates user message)
- Runs AI agent
- Emits `log_run` (logs tokens/pricing)

## Activity Logging

**Standard pattern:**
- AI operations: Activity logging handled by `log_run` event
- Other events: Call `log_websocket_activity()` directly (but consistently)
- Always wrap in try/except to avoid breaking event flow

## File Organization

**WebSocket events:**
- `server/app/socket/v3/[resource]/[operation].py` - Event handlers
- `server/sql/v3/[resource]/[operation]_complete.sql` - SQL files (one per event)
- Internal events: Use `@internal_sio.on()` decorator
- Client events: Use `@sio.event()` decorator

## Common Violations to Avoid

1. **Multiple database operations in one event** - Split into separate events
2. **Missing log_run** - All AI operations using `Runner.run()` must emit `log_run`
3. **Direct SQL in event handler** - Use SQL files via `load_sql()`
4. **Mixing concerns** - Keep event handlers focused on one operation

