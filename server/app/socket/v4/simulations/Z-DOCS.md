# Simulation Orchestration System

This directory contains the WebSocket event handlers that orchestrate the simulation attempt lifecycle, from creation through scenario progression to completion.

## Overview

The simulation orchestration system manages the flow of scenarios within a simulation attempt. It handles:
- **Starting** simulation attempts (with practice mode support)
- **Ending** simulation chats and determining next steps
- **Creating** fresh scenario variants with randomization
- **Advancing** to the next scenario and notifying clients

The system follows an event-driven architecture where handlers communicate via internal Socket.IO events (`internal_sio.emit`), ensuring loose coupling and clear separation of concerns.

## Architecture

### Core Handlers

The orchestration system consists of four main handlers:

#### 1. `start.py` - Simulation Start Handler

**Purpose**: Creates a new simulation attempt and initiates the first scenario.

**Client Event**: `simulation_start`

**Key Responsibilities**:
- Creates `simulation_attempts` record
- Links profile to attempt
- Handles **practice mode** (finds practice simulation, creates scenario variant if needed)
- Checks for next incomplete scenario
- Emits `simulation_next` if next scenario exists

**Practice Mode**:
- When `practice_mode=True`, finds practice simulation for given persona
- Optionally creates customized scenario variant with selected persona/parameters
- Falls back to parent scenario if no customization needed

**Flow**:
```
Client → simulation_start
  ↓
Create attempt
  ↓
Check next incomplete scenario
  ↓
If next exists → emit simulation_next (internal)
  ↓
Emit simulations_started (client)
```

**SQL Files**:
- `start_simulation_attempt_complete.sql` - Creates attempt and initial chat
- `check_next_incomplete_scenario.sql` - Determines if next scenario exists
- `find_practice_simulation_with_persona.sql` - Finds practice simulation (practice mode)

#### 2. `end.py` - Simulation End Handler

**Purpose**: Ends a simulation chat, handles grading, and determines next steps.

**Client Event**: `simulation_text_end`

**Key Responsibilities**:
- Marks chat as completed
- Triggers grading if needed (emits `simulation_grading_start`)
- Checks for next incomplete scenario
- Emits `simulation_next` if next scenario exists
- Handles "end all" mode (ends all chats in attempt)

**Flow**:
```
Client → simulation_text_end
  ↓
Mark chat completed
  ↓
If needs grading → emit simulation_grading_start (internal)
  ↓
Check next incomplete scenario
  ↓
If next exists → emit simulation_next (internal)
  ↓
Emit simulation_ended (client)
```

**SQL Files**:
- `update_chat_completed.sql` - Marks chat as completed
- `check_next_incomplete_scenario.sql` - Determines if next scenario exists

#### 3. `next.py` - Scenario Creation Handler

**Purpose**: Creates a fresh scenario variant and delegates to `generate.py` for randomization and AI generation.

**Internal Event**: `simulation_next` (emitted by `start.py` or `end.py`)

**Key Responsibilities**:
- Creates child scenario variant from parent (no links yet)
- Links scenario tree edge (parent to child)
- Checks which AI fields need generation (statement, objectives, videos, images, questions)
- Routes to `generate_scenario` which handles:
  - Randomization of missing values (persona, documents, parameters)
  - Linking randomized selections to child scenario
  - AI generation of missing fields
  - Emitting `simulation_advance` when complete

**Note**: Randomization logic is centralized in `agents/scenario/generate.py`. This ensures both frontend scenario creation and simulation flow use identical randomization logic.

**Flow**:
```
Internal → simulation_next
  ↓
Get parent scenario
  ↓
Create child scenario variant (no links yet)
  ↓
Link scenario tree edge (parent → child)
  ↓
Check AI fields (statement, objectives, videos, images, questions)
  ↓
Emit generate_scenario (client) - always emit, even if no AI needed
  ↓
generate.py handles:
  - Randomize missing values (persona, documents, parameters)
  - Link randomized selections to child scenario
  - Generate AI fields if needed
  - Emit simulation_advance (internal) when complete
```

**SQL Files**:
- `get_scenario_by_id.sql` - Gets parent scenario metadata
- `insert_scenario_variant.sql` - Creates child scenario
- `insert_scenario_tree_edge.sql` - Links parent to child
- `get_scenario_problem_statement.sql` - Checks if statement exists
- `get_scenario_objectives.sql` - Checks if objectives exist
- `get_scenario_videos.sql` - Checks if videos exist
- `get_scenario_images.sql` - Checks if images exist
- `get_scenario_questions.sql` - Checks if questions exist

**Note**: Linking of persona, documents, parameters, and department is handled by `generate.py` after randomization.

#### 4. `advance.py` - Simulation Advance Handler

**Purpose**: Attaches scenario to simulation by creating chat and notifying client.

**Internal Event**: `simulation_advance` (emitted by `next.py` or `scenario/generate.py`)

**Key Responsibilities**:
- Creates new chat linked to attempt
- Creates group with trace_id
- Links chat to group
- Emits `simulations_advanced` to client (triggers UI refresh)

**Flow**:
```
Internal → simulation_advance
  ↓
Get scenario name
  ↓
Create chat + group + links
  ↓
Emit simulations_advanced (client)
```

**SQL Files**:
- `get_scenario_by_id.sql` - Gets scenario name
- `create_simulation_chat.sql` - Creates chat, group, and links

## Event Flow Diagrams

### Standard Simulation Start Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │ simulation_start
     ↓
┌─────────┐
│ start.py│
└────┬────┘
     │ Create attempt
     │ Check next scenario
     ↓
     ├─→ Has next? ──┐
     │                │
     │                ↓
     │         ┌──────────┐
     │         │ next.py  │
     │         └────┬─────┘
     │              │ Create child scenario
     │              │ Link scenario tree edge
     │              │ Check AI fields
     │              ↓
     │         ┌──────────┐
     │         │scenario  │
     │         │generate  │
     │         └────┬─────┘
     │              │ Randomize missing values
     │              │ Link randomized selections
     │              │ Generate AI fields if needed
     │              │ Emit simulation_advance
     │              ↓
     │         ┌──────────┐
     │         │ advance.py│
     │         └────┬──────┘
     │              │ Create chat
     │              │ Emit to client
     │              ↓
     │         ┌──────────┐
     │         │  Client  │
     │         │  Refresh │
     │         └──────────┘
     │
     ↓
┌─────────┐
│ Client  │ ← simulations_started
└─────────┘
```

### Simulation End Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │ simulation_text_end
     ↓
┌─────────┐
│ end.py │
└────┬────┘
     │ Mark chat completed
     │
     ├─→ Needs grading? ──→ emit simulation_grading_start
     │
     │ Check next scenario
     ↓
     ├─→ Has next? ──┐
     │                │
     │                ↓
     │         ┌──────────┐
     │         │ next.py  │
     │         │ (same flow as start)
     │         └──────────┘
     │
     ↓
┌─────────┐
│ Client  │ ← simulation_ended
└─────────┘
```

### Practice Mode Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │ simulation_start (practice_mode=True)
     ↓
┌─────────┐
│ start.py│
└────┬────┘
     │ Find practice simulation
     │
     ├─→ Needs customization? ──┐
     │                            │
     │                         Yes│
     │                            ↓
     │                    Create scenario variant
     │                    Link persona/parameters
     │                            │
     │                         No│
     │                            ↓
     │                    Use parent scenario
     │                            │
     │                            ↓
     │                    (continue with standard flow)
     │
     ↓
```

## Integration with Scenario Generation

When `next.py` creates a child scenario variant, it always emits `generate_scenario` to `agents/scenario/generate.py`. The scenario generation handler:

1. **Randomizes missing values** (persona, documents, parameters) if not provided
2. **Links randomized selections** to the child scenario
3. **Generates missing AI fields** (statement, objectives, videos, images, questions) if needed
4. On completion, checks if `simulationId` and `attemptId` are present
5. If present, emits `simulation_advance` to continue the simulation flow

This ensures seamless integration: randomization and generation are centralized in one place, and scenarios automatically advance the simulation once ready.

## Key Concepts

### Scenario Variants

- **Parent Scenario**: Template scenario defined in `simulation_scenarios`
- **Child Scenario**: Generated variant created for each attempt
- **Scenario Tree**: Links parent to child via `scenario_tree` table
- **Randomization**: Child scenarios get randomized persona, documents, and parameters (handled by `generate.py`)

### Next Scenario Detection

The `check_next_incomplete_scenario.sql` query:
- Finds scenarios from `simulation_scenarios` that haven't been completed
- Considers scenarios "complete" if they have a graded chat
- Handles infinite mode (always finds next scenario)
- Maps child scenarios to parent scenarios via `scenario_tree`

### Practice Mode

Practice mode allows users to start simulations with customized scenarios:
- Finds practice simulation for selected persona
- Optionally creates scenario variant with selected persona/parameters
- Falls back to parent scenario if no customization needed
- Uses same orchestration flow as standard mode

## File Structure

```
simulations/
├── README.md              # This file
├── __init__.py            # Router registration
├── start.py               # Start handler (creates attempt)
├── end.py                 # End handler (ends chat, checks next)
├── next.py                # Next handler (creates scenario variant)
├── advance.py             # Advance handler (creates chat, notifies client)
├── enter.py               # Enter simulation room
├── join.py                # Join simulation room
├── leave.py               # Leave simulation room
├── stop.py                # Stop simulation
├── streaming/             # Streaming message handlers
└── ...
```

## Event Naming Convention

- **Client Events**: `simulation_*` (e.g., `simulation_start`, `simulation_text_end`)
- **Server Events**: `simulations_*` (e.g., `simulations_started`, `simulations_advanced`)
- **Internal Events**: `simulation_*` (e.g., `simulation_next`, `simulation_advance`)

## Error Handling

All handlers follow consistent error handling:
- Validate inputs (profile_id, attempt_id, etc.)
- Check database pool availability
- Emit error events to client on failure
- Log errors with context
- Log activity for audit trail

## Testing

- **Integration Tests**: `server/tests/integration/socket/simulations/`
- **E2E Tests**: `server/tests/e2e/` (Playwright tests)

## Related Handlers

- **Scenario Generation**: `agents/scenario/generate.py` - Generates AI fields for scenarios
- **Grading**: `agents/grade_text/generate.py` - Grades simulation chats
- **Hints**: `agents/hint/generate.py` - Generates hints for practice simulations (creates hints directly)

## Notes

- All handlers use SQL files (no inline SQL)
- All handlers follow the single unit of work principle
- Internal events use `internal_sio.emit()` for server-to-server communication
- Client events use `sio.emit()` for server-to-client communication
- Profile ID is always retrieved from WebSocket session, never from payload

