# Eval Agent Documentation

## Purpose

The eval agent manages evaluation attempts and runs. It handles starting eval attempts, processing eval runs, and managing the evaluation workflow for batch processing of scenarios.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `eval_start`** with:
   - `eval_id`: UUID of the eval to start
   - `profile_id`: Optional UUID of the profile

2. **Server (`eval/start.py`)**:
   - Creates eval_attempt record
   - Emits `evals_started` to client

3. **Client emits `eval_run_start`** with:
   - `attempt_id`: UUID of the eval attempt
   - `run_id`: UUID of the eval run to start
   - `profile_id`: Optional UUID of the profile

4. **Server (`eval/run_start.py`)**:
   - Starts a single eval run (idempotent)
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

### `create_eval_attempt_complete.sql`
- Creates eval_attempt record
- Parameters: `eval_id`, `profile_id`
- Returns: `attempt_id`, `eval_id`, `created_at`

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

1. **Attempt Management**: Creates and manages eval attempts
2. **Run Management**: Starts, stops, and processes individual eval runs
3. **Batch Processing**: Supports starting all runs at once
4. **Workflow Orchestration**: Processes runs sequentially and triggers scenario generation
5. **State Management**: Tracks run status (pending, in_progress, completed, stopped)

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

