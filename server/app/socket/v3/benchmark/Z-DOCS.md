# Benchmark Orchestration System

This directory contains the WebSocket event handlers that orchestrate the benchmark attempt lifecycle, from creation through section-by-section execution to completion.

## Overview

The benchmark orchestration system manages the flow of test runs/groups within a benchmark attempt. It handles:
- **Starting** benchmark attempts (with infinite mode support)
- **Processing** runs/groups sequentially (section-by-section execution)
- **Ending** tests and running grading
- **Advancing** to notify clients of progress
- **Stopping** benchmark attempts

The system follows an event-driven architecture where handlers communicate via internal Socket.IO events (`internal_sio.emit`), ensuring loose coupling and clear separation of concerns.

## Architecture

### Core Handlers

The orchestration system consists of five main handlers:

#### 1. `start.py` - Benchmark Start Handler

**Purpose**: Creates a new benchmark attempt and initiates the first run/group.

**Client Event**: `benchmark_start`

**Key Responsibilities**:
- Creates `eval_attempts` record with `infinite_mode` flag
- Gets `agent_ids` from `eval_agents` junction table
- Gets `rubric_grade_agent_ids` from `eval_runs_rubric_grade_agents` (if `use_groups=false`) or `eval_groups_rubric_grade_agents` (if `use_groups=true`)
- Gets pending runs/groups for the eval
- Emits `benchmark_next` if next run/group exists
- Emits `benchmarks_started` to client

**Flow**:
```
Client → benchmark_start
  ↓
Create attempt
  ↓
Get agent_ids from eval_agents junction
  ↓
Get rubric_grade_agent_ids from junction tables
  ↓
Get pending runs/groups
  ↓
If next exists → emit benchmark_next (internal)
  ↓
Emit benchmarks_started (client)
```

**SQL Files**:
- `start_benchmark_attempt_complete.sql` - Creates attempt and gets pending runs/groups

#### 2. `next.py` - Section-by-Section Execution Handler

**Purpose**: Orchestrates sequential execution of tools and agents for a run/group.

**Internal Event**: `benchmark_next` (emitted by `start.py` or recursively by itself)

**Key Responsibilities**:
- Gets next pending run/group for attempt
- Creates or gets test record
- Gets `group_stop` tools (if `use_groups=true`)
- Gets `group_order` agents (if `use_groups=true`)
- Executes tools first (one at a time):
  - Emits to `tools/{tool_name}/eval.py` (internal: `{tool_name}_eval_start`)
  - Waits for completion: `{tool_name}_eval_complete`
- Executes agents (one at a time):
  - Emits to `agents/{agent_name}/eval.py` (internal: `{agent_name}_eval_start`)
  - Waits for completion: `{agent_name}_eval_complete`
- Emits `benchmark_end` after all tools and agents complete

**Sequential Execution Pattern**:
- Unlike other agents that auto-kickoff, benchmark sections execute **one at a time**
- Each section's `eval.py` completes before the next starts
- This ensures deterministic, sequential behavior

**Flow**:
```
Internal → benchmark_next
  ↓
Get next run/group
  ↓
Create/get test record
  ↓
Get group_stop tools (if use_groups=true)
  ↓
For each tool in group_stop (ordered by position_idx):
  - Emit to tools/{tool_name}/eval.py
  - Wait for completion
  ↓
Get group_order agents (if use_groups=true)
  ↓
For each agent in group_order (ordered by position_idx):
  - Emit to agents/{agent_name}/eval.py
  - Wait for completion
  ↓
Emit benchmark_end
```

**SQL Files**:
- `get_next_pending_run_or_group_for_benchmark.sql` - Gets next run/group
- `get_group_stop_tools.sql` - Gets tools in group_stop
- `get_group_order_agents.sql` - Gets agents in group_order
- Note: Cycle counting and tool call tracking SQL files removed

#### 3. `end.py` - Benchmark End Handler

**Purpose**: Runs grading and completes test after all tools and agents have executed.

**Internal Event**: `benchmark_end` (emitted by `next.py`)

**Key Responsibilities**:
- Gets `rubric_grade_agent_id` from junction table for the run/group
- Runs rubric_grade_agent via `agents/grade/generate.py` (not separate eval agent)
- Creates grade record (via `create_eval_grade.sql`)
- Marks test as completed
- Marks eval_run or eval_group as completed
- Checks if more runs/groups exist:
  - If yes → emit `benchmark_next` (internal)
  - If no → emit `benchmarks_completed` (client)

**Flow**:
```
Internal → benchmark_end
  ↓
Get rubric_grade_agent_id from junction table
  ↓
Run rubric_grade_agent (via agents/grade/generate.py)
  ↓
Create grade record
  ↓
Mark test completed
  ↓
Mark eval_run/eval_group completed
  ↓
Check if more runs/groups exist
  ↓
If yes → emit benchmark_next (internal)
If no → emit benchmarks_completed (client)
```

**SQL Files**:
- `get_rubric_grade_agent_for_run_or_group.sql` - Gets rubric_grade_agent_id
- `create_eval_grade.sql` - Creates grade record

#### 4. `advance.py` - Benchmark Advance Handler

**Purpose**: Updates client with test/run status.

**Internal Event**: `benchmark_advance`

**Key Responsibilities**:
- Updates client with new test/run status
- Emits `benchmarks_advanced` to client
- Payload: `test_id`, `run_id` or `group_id`, `attempt_id`, `status`

**Flow**:
```
Internal → benchmark_advance
  ↓
Update client with test status
  ↓
Emit benchmarks_advanced (client)
```

#### 5. `stop.py` - Benchmark Stop Handler

**Purpose**: Stops a benchmark attempt.

**Client Event**: `benchmark_stop`

**Key Responsibilities**:
- Stops active run/group in benchmark attempt
- Cancels active operations (via `cancel_active_run`)
- Marks test as completed if in progress
- Emits `benchmarks_stopped` to client

**Flow**:
```
Client → benchmark_stop
  ↓
Cancel active run
  ↓
Mark test completed
  ↓
Emit benchmarks_stopped (client)
```

## Section Eval.py Pattern

### Tools/*/eval.py

Each tool folder has an `eval.py` file that handles eval-specific logic:

**Pattern**:
- **Direct implementation**: Directly implements tool logic (does NOT wrap `tools/{tool_name}/call.py`)
- **Eval-specific SQL**: Uses eval-specific SQL files that handle eval-specific updates (linking to test)
- **Suppresses auto-emit events**: Does NOT emit completion events that would trigger further actions (unlike normal tool handlers)
- **Completion emission**: Emits completion back to `benchmark/next.py` only: `{tool_name}_eval_complete` (internal event)

**Event Pattern**:
- Internal event: `{tool_name}_eval_start` (emitted by benchmark/next.py)
- Internal event: `{tool_name}_eval_complete` (emitted by tools/{tool_name}/eval.py)
- Payload includes: `test_id`, `run_id` or `group_id`, `attempt_id`, `tool_id`, `eval_id`

**Tool folders with eval.py**:
- `tools/classification/eval.py`
- `tools/hint/eval.py`
- `tools/video/eval.py`
- `tools/speak/eval.py`
- `tools/title/eval.py`
- `tools/statement/eval.py`
- `tools/objective/eval.py`
- `tools/image/eval.py`
- `tools/question/eval.py`
- `tools/audio/eval.py`
- `tools/grade/eval.py`
- `tools/strength/eval.py`
- `tools/improvement/eval.py`
- `tools/rubric/eval.py`
- `tools/conversation/eval.py`
- `tools/debug/eval.py`
- `tools/document/eval.py`

### Agents/*/eval.py

Each agent folder has an `eval.py` file that handles eval-specific logic:

**Non-dynamic mode (dynamic=false)**:
- Simply emits to `agents/grade/generate.py` to run grading agent
- No agent re-run needed

**Dynamic mode (dynamic=true)**:
- Gets `agent_id` from `rubric_grade_agents.agent_id` (the agent being evaluated)
- Gets messages from original run via `get_run_messages_exclude_last_assistant.sql`
  - **Key**: Excludes the LAST assistant output (all messages EXCEPT last assistant)
  - This allows regenerating the last assistant response with full conversation history
- Runs agent with modified system prompt (similar to regenerate.py pattern)
- Uses new assistant output as context for grading
- Then emits to `agents/grade/generate.py`

**Common logic (both modes)**:
- Emits completion back to `benchmark/next.py`: `{agent_name}_eval_complete`

**Event Pattern**:
- Internal event: `{agent_name}_eval_start` (emitted by benchmark/next.py)
- Internal event: `{agent_name}_eval_complete` (emitted by agents/{agent_name}/eval.py)
- Payload includes: `test_id`, `run_id` or `group_id`, `attempt_id`, `agent_id`, `eval_id`, `current_cycle`

**Agent folders with eval.py**:
- `agents/simulation/eval.py`
- `agents/voice/eval.py`
- `agents/scenario/eval.py`
- `agents/document/eval.py`
- `agents/video/eval.py`
- `agents/image/eval.py`
- `agents/rubric/eval.py`
- `agents/classify/eval.py`
- `agents/hint/eval.py`
- `agents/grade/eval.py`
- `agents/audio/eval.py`
- `agents/member/eval.py`

## Junction Table Usage

### eval_agents
Links evals to multiple agents (replaces `evals.agent_id`):
```sql
SELECT agent_id FROM eval_agents WHERE eval_id = $1 ORDER BY created_at
```

### eval_runs_rubric_grade_agents
Links rubric_grade_agents to runs (multiple per run):
```sql
SELECT rubric_grade_agent_id FROM eval_runs_rubric_grade_agents 
WHERE eval_id = $1 AND run_id = $2
```

### eval_groups_rubric_grade_agents
Links rubric_grade_agents to groups (multiple per group):
```sql
SELECT rubric_grade_agent_id FROM eval_groups_rubric_grade_agents 
WHERE eval_id = $1 AND group_id = $2
```

### group_stop
Defines tools that must be called to stop a group (ordered by `position_idx`):
```sql
SELECT tool_id, position_idx FROM group_stop 
WHERE group_id = $1 ORDER BY position_idx
```

### group_order
Defines order of agents for a group (ordered by `position_idx`):
```sql
SELECT agent_id, position_idx FROM group_order 
WHERE group_id = $1 ORDER BY position_idx
```

## Note: Tracking Logic Removed

Cycle counting, tool call tracking, and stopping condition logic have been removed. The benchmark system now executes tools and agents sequentially without tracking cycles or tool calls.

## Event Naming Convention

- **Client Events**: `benchmark_*` (e.g., `benchmark_start`, `benchmark_stop`, `benchmark_join`)
- **Server Events**: `benchmarks_*` (e.g., `benchmarks_started`, `benchmarks_advanced`, `benchmarks_completed`)
- **Internal Events**: `benchmark_*` (e.g., `benchmark_next`, `benchmark_end`, `benchmark_advance`)
- **Section Events**: `{section}_eval_*` (e.g., `classification_eval_start`, `simulation_eval_start`)

## Room Naming Convention

- **Benchmark Rooms**: `benchmark_{attempt_id}` (e.g., `benchmark_123e4567-e89b-12d3-a456-426614174000`)

## Comparison with Simulations Pattern

The benchmark orchestration system is analogous to the simulations pattern but with key differences:

**Similarities**:
- Both use `start.py` to create attempts
- Both use `next.py` for recursive processing
- Both use `end.py` for completion
- Both use `advance.py` for client updates
- Both use `stop.py` for stopping attempts

**Differences**:
- **Benchmark**: Section-by-section execution (tools → agents, one at a time)
- **Simulations**: Scenario-based execution (creates child scenarios, delegates to generate.py)
- **Benchmark**: Uses junction tables for agent_ids and rubric_grade_agent_ids
- **Simulations**: Uses direct columns for simulation_id and scenario_id
- **Benchmark**: Uses group_stop and group_order for agent ordering (no cycle tracking)
- **Simulations**: Uses scenario tree for progression

## SQL File Organization

All SQL files are in `server/app/sql/v3/benchmark/`:
- Orchestration: `start_benchmark_attempt_complete.sql`, `get_next_pending_run_or_group_for_benchmark.sql`, `get_rubric_grade_agent_for_run_or_group.sql`
- Group stop/order: `get_group_stop_tools.sql`, `get_group_order_agents.sql`
- Dynamic mode: `get_run_messages_exclude_last_assistant.sql`
- Grading: `create_eval_grade.sql`

## Key Implementation Details

### Sequential Section Execution

Unlike other agents that auto-kickoff, benchmark sections execute **one at a time**:
- Each tool's `eval.py` completes before the next tool starts
- Each agent's `eval.py` completes before the next agent starts
- This ensures deterministic, sequential behavior
- Execution stops at run level - each section's `eval.py` completes before next starts

### Tools/eval.py Pattern

- **Direct implementation**: Directly implements tool logic (NOT wrapping `call.py`) for sequential control
- **Eval-specific SQL**: Uses eval-specific SQL files (e.g., `get_tool_context_for_eval.sql`, `create_document_for_eval.sql`)
- **Suppress auto-emit**: Does NOT emit completion events that would trigger further actions
- **Sequential execution**: Ensures deterministic, one-run-at-a-time behavior

### Agents/eval.py Pattern

- **Non-dynamic mode**: Simply emits to `agents/grade/generate.py` to run grading agent
- **Dynamic mode**: Gets agent_id from `rubric_grade_agents.agent_id`, gets messages exclude last assistant, runs agent with modified prompt, uses new output as context, then emits to `agents/grade/generate.py`
- **Sequential execution**: Agents execute one at a time, completing before the next starts

### Migration 160 Impact

Migration 160 adds `agent_id` column to `rubric_grade_agents` table:
- `rubric_grade_agents.agent_id` = agent being evaluated (used in dynamic mode)
- `rubric_grade_agents.grade_agent_id` = grading agent (renamed from `grade_text_agent_id`)
- This enables getting the agent being evaluated directly from `rubric_grade_agents.agent_id` in dynamic mode

