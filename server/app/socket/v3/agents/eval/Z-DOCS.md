# Eval Agent Documentation

## Purpose

The eval agent manages evaluation attempts and runs. It handles starting eval attempts, processing eval runs, and managing the evaluation workflow for batch processing of scenarios.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `eval_start`** with:
   - `eval_id`: UUID of the eval to start
   - `profile_id`: Optional UUID of the profile
   - `infinite_mode`: Boolean flag for infinite mode (cycles through runs indefinitely)

2. **Server (`eval/start.py`)**:
   - Creates eval_attempt record with `infinite_mode` flag
   - Gets agent_ids from `eval_agents` junction table (replaces old `evals.agent_id`)
   - Emits `evals_started` to client

3. **Client emits `eval_run_start`** with:
   - `attempt_id`: UUID of the eval attempt
   - `run_id`: UUID of the eval run to start
   - `profile_id`: Optional UUID of the profile

4. **Server (`eval/run_start.py`)**:
   - Starts a single eval run (idempotent)
   - Gets agent_id from `eval_agents` junction table (first agent for backward compatibility)
   - Gets rubric_grade_agent_id from `eval_runs_rubric_grade_agents` or `eval_groups_rubric_grade_agents`
   - Checks if run is already completed/in_progress
   - Emits `evals_run_started` to client

5. **Client emits `eval_runs_start_all`** with:
   - `attempt_id`: UUID of the eval attempt
   - `profile_id`: Optional UUID of the profile

6. **Server (`eval/runs_start_all.py`)**:
   - Starts all pending eval runs for an attempt
   - Emits `evals_runs_started_all` to client

7. **Server (`eval/process_next.py`)**:
   - Processes next pending eval run
   - Checks `infinite_mode` from `eval_attempts` table
   - If `infinite_mode=true`, cycles back to first run when all runs completed
   - If `infinite_mode=false`, emits completion event when all runs completed
   - Gets agent_id from `eval_agents` via `get_eval_dynamic_and_agent.sql`
   - Triggers scenario generation for eval run
   - Emits `evals_process_next` to client

8. **Client emits `eval_run_stop`** with:
   - `attempt_id`: UUID of the eval attempt
   - `run_id`: UUID of the eval run to stop
   - `profile_id`: Optional UUID of the profile

9. **Server (`eval/run_stop.py`)**:
   - Stops a single eval run
   - Emits `evals_run_stopped` to client

10. **Client emits `eval_stop`** with:
    - `attempt_id`: UUID of the eval attempt to stop
    - `profile_id`: Optional UUID of the profile

11. **Server (`eval/stop.py`)**:
    - Stops all runs in an eval attempt
    - Emits `evals_stopped` to client

## SQL Files

### `start_eval_attempt_complete.sql`
- Creates eval_attempt record with infinite_mode flag
- Parameters: `eval_id`, `profile_id`, `infinite_mode`
- Returns: `attempt_id`, `eval_id`, `infinite_mode`, `created_at`

### `start_eval_run_complete.sql`
- Starts a single eval run (idempotent)
- Parameters: `attempt_id`, `run_id`, `profile_id`
- Returns: `run_id`, `status`, `started_at`

### `start_all_eval_runs_complete.sql`
- Starts all pending eval runs for an attempt
- Parameters: `attempt_id`, `profile_id`
- Returns: `attempt_id`, `started_count`

### `process_next_eval_run_complete.sql`
- Processes next pending eval run
- Parameters: `attempt_id`, `profile_id`
- Returns: `run_id`, `scenario_id`, `processed`

### `stop_eval_run_complete.sql`
- Stops a single eval run
- Parameters: `attempt_id`, `run_id`, `profile_id`
- Returns: `run_id`, `stopped_at`

### `stop_eval_attempt_complete.sql`
- Stops all runs in an eval attempt
- Parameters: `attempt_id`, `profile_id`
- Returns: `attempt_id`, `stopped_count`

## Key Responsibilities

1. **Attempt Management**: Creates and manages eval attempts with `infinite_mode` support
2. **Run Management**: Starts, stops, and processes individual eval runs
3. **Batch Processing**: Supports starting all runs at once
4. **Workflow Orchestration**: Processes runs sequentially and triggers scenario generation
5. **State Management**: Tracks run status (pending, in_progress, completed, stopped)
6. **Infinite Mode**: Cycles through runs indefinitely when `infinite_mode=true`
7. **Agent Selection**: Uses `eval_agents` junction table for multiple agents per eval (replaces single `evals.agent_id`)

## Agent Selection Pattern

**Migration from single agent to multiple agents:**

- **Old pattern**: `evals.agent_id` (single UUID column)
- **New pattern**: `eval_agents` junction table (many-to-many relationship)

**SQL Pattern**:
```sql
-- Get agent_ids array from junction table
SELECT ARRAY_AGG(ea.agent_id ORDER BY ea.created_at) as agent_ids
FROM eval_agents ea
WHERE ea.eval_id = $1::uuid
```

**Backward Compatibility**: 
- `run_start.py` gets first agent from `eval_agents` for backward compatibility
- Future UI will allow selecting specific agents per group/run

## Infinite Mode Pattern

**Purpose**: Allow eval attempts to cycle through runs indefinitely instead of stopping when all runs complete.

**Implementation**:
- `eval_attempts.infinite_mode` boolean column (defaults to `false`)
- When `infinite_mode=true`, `process_next.py` cycles back to first run when all runs completed
- When `infinite_mode=false`, emits completion event when all runs completed

**SQL Pattern**:
```sql
-- Check infinite_mode from attempt
SELECT infinite_mode FROM eval_attempts WHERE id = $1::uuid

-- In infinite mode, cycle to first run
IF infinite_mode THEN
    next_run_id := all_run_ids[1]; -- Cycle to first
ELSE
    -- Emit completion event
END IF;
```

## Integration Points

- **Scenario Agent**: Triggers scenario generation for eval runs
- **Eval System**: Manages evaluation workflow for batch scenario processing

## File Structure

```
eval/
├── __init__.py          # Event registration
├── Z-DOCS.md           # This file
├── start.py             # Start eval attempt handler
├── stop.py              # Stop eval attempt handler
├── run_start.py         # Start single eval run handler
├── run_stop.py          # Stop single eval run handler
├── runs_start_all.py    # Start all eval runs handler
├── process_next.py      # Process next eval run handler
├── progress.py          # Progress updates
├── complete.py          # Completion handler
└── error.py            # Error handling
```

## Client Events

### `evals_started`
- Emitted by: `start.py`
- Payload: `success`, `attempt_id`, `eval_id`

### `evals_run_started`
- Emitted by: `run_start.py`
- Payload: `success`, `run_id`, `attempt_id`

### `evals_runs_started_all`
- Emitted by: `runs_start_all.py`
- Payload: `success`, `attempt_id`, `started_count`

### `evals_process_next`
- Emitted by: `process_next.py`
- Payload: `success`, `attempt_id`, `run_id`, `scenario_id`

### `evals_run_stopped`
- Emitted by: `run_stop.py`
- Payload: `success`, `run_id`, `attempt_id`

### `evals_stopped`
- Emitted by: `stop.py`
- Payload: `success`, `attempt_id`, `stopped_count`

### `evals_error`
- Emitted by: All handlers on error
- Payload: `success`, `message`, `eval_id` or `attempt_id` or `run_id`

