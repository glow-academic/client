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

**Purpose**: Creates a fresh scenario variant based on parent scenario with randomization.

**Internal Event**: `simulation_next` (emitted by `start.py` or `end.py`)

**Key Responsibilities**:
- Creates child scenario variant from parent
- Randomizes persona, documents, and parameters
- Links randomized selections to child scenario
- Checks which AI fields need generation (statement, objectives, videos, images, questions)
- Routes to either:
  - `generate_scenario` (if AI fields needed) → waits for completion → `simulation_advance`
  - `simulation_advance` (if no AI fields needed)

**Randomization Logic**:
- Selects random persona from available personas
- Selects random documents (1-3) from available documents
- Selects random parameters (1-3) with random parameter items (1-3 per parameter)
- Respects department filtering and availability

**Flow**:
```
Internal → simulation_next
  ↓
Get parent scenario
  ↓
Randomize selections (persona, documents, parameters)
  ↓
Create child scenario variant
  ↓
Link randomized selections
  ↓
Check AI fields (statement, objectives, videos, images, questions)
  ↓
If needs AI → emit generate_scenario (client)
  ↓ (scenario generate completes)
  ↓
Emit simulation_advance (internal)
```

**SQL Files**:
- `get_scenario_by_id.sql` - Gets parent scenario metadata
- `insert_scenario_variant.sql` - Creates child scenario
- `insert_scenario_tree_edge.sql` - Links parent to child
- `insert_scenario_persona_link.sql` - Links persona
- `insert_scenario_document_link.sql` - Links documents
- `insert_scenario_parameter_link.sql` - Links parameters
- `insert_scenario_department_link.sql` - Links department
- `get_scenario_problem_statement.sql` - Checks if statement exists
- `get_scenario_objectives.sql` - Checks if objectives exist
- `get_scenario_videos.sql` - Checks if videos exist
- `get_scenario_images.sql` - Checks if images exist
- `get_scenario_questions.sql` - Checks if questions exist

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
     │              │ Randomize selections
     │              │ Check AI fields
     │              ↓
     │         ┌──────────────┐
     │         │ Needs AI?    │
     │         └──┬───────┬───┘
     │            │       │
     │         Yes│       │No
     │            │       │
     │            ↓       ↓
     │    ┌──────────┐ ┌──────────┐
     │    │scenario  │ │ advance.py│
     │    │generate  │ └────┬──────┘
     │    └────┬─────┘      │
     │         │            │ Create chat
     │         │            │ Emit to client
     │         │            │
     │         │            ↓
     │         │      ┌──────────┐
     │         │      │  Client  │
     │         │      │  Refresh │
     │         │      └──────────┘
     │         │
     │         │ (after generation completes)
     │         ↓
     │    ┌──────────┐
     │    │ advance.py│
     │    └────┬──────┘
     │         │
     │         ↓
     │    ┌──────────┐
     │    │  Client  │
     │    │  Refresh │
     │    └──────────┘
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

When `next.py` determines that AI fields need generation, it emits `generate_scenario` to `agents/scenario/generate.py`. The scenario generation handler:

1. Generates missing fields (statement, objectives, videos, images, questions)
2. On completion, checks if `simulationId` and `attemptId` are present
3. If present, emits `simulation_advance` to continue the simulation flow

This ensures seamless integration: scenarios are generated on-demand and automatically advance the simulation once ready.

## Key Concepts

### Scenario Variants

- **Parent Scenario**: Template scenario defined in `simulation_scenarios`
- **Child Scenario**: Generated variant created for each attempt
- **Scenario Tree**: Links parent to child via `scenario_tree` table
- **Randomization**: Child scenarios get randomized persona, documents, and parameters

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

