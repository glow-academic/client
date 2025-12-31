# Scenario Agent Documentation

## Purpose

The scenario agent generates educational scenarios for simulations. It uses AI to create problem statements, objectives, questions, and optionally images/videos based on department, persona, document, and field inputs.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `generate_scenario`** with:
   - `departmentId`: UUID of the department
   - `scenarioAgentId`: UUID of the agent for scenario generation
   - `imageAgentId`: Optional UUID for image generation
   - `videoAgentId`: Optional UUID for video generation
   - `personaIds`: Optional list of persona UUIDs
   - `documentIds`: Optional list of document UUIDs
   - `fieldIds`: Optional list of field UUIDs
   - `profileId`: Optional UUID of the profile
   - `scenarioId`: Optional UUID to link generated resources
   - `simulationId`: Optional UUID for simulation advance
   - `attemptId`: Optional UUID for simulation advance
   - `objectivesMin/Max`: Optional range for objectives count
   - `imagesEnabled`: Boolean flag for image generation
   - `videoEnabled`: Boolean flag for video generation
   - `objectivesEnabled`: Boolean flag for objectives generation
   - `questionsEnabled`: Boolean flag for questions generation
   - `videoLength`: Optional video length in seconds

2. **Server (`scenario/generate.py`)**:
   - **Step 1: Randomize missing values** (if personaIds, documentIds, or fieldIds are not provided):
     - Randomizes missing persona, documents, and parameters using centralized logic
     - Links randomized selections to scenario (if scenarioId provided)
     - Emits `scenario_randomize_complete` event to client with randomized selections
   - **Step 2: Get context and create run** atomically (via SQL)
   - **Step 3: Create scenario agent** with tools (title, problem_statement, objectives, questions, image, video)
   - **Step 4: Run agent** with streaming
   - Emits `scenario_progress` internal events for tool calls
   - Emits `log_run` for token/pricing logging
   - Emits `scenario_complete` on completion

3. **Server (`scenario/progress.py`)**:
   - Receives `scenario_progress` internal events
   - Updates scenario resources incrementally
   - Emits `scenarios_generation_progress` to client

4. **Server (`scenario/complete.py`)**:
   - Receives `scenario_complete` internal events
   - Finalizes scenario resources
   - Emits `scenarios_generation_complete` to client
   - Optionally emits `simulation_advance` if simulationId provided

## SQL Files

### `get_scenario_run_context_and_create_run_complete.sql`
- Gets all context needed for scenario generation
- Creates run atomically with rate limit check
- Parameters: `department_id`, `scenario_agent_id`, `profile_id`, `scenario_id`
- Returns: All context fields (agent, model, provider, persona, document, field info, etc.)

### `scenario_progress_update_complete.sql`
- Updates scenario resources incrementally (title, problem_statement, objectives, questions)
- Parameters: `scenario_id`, `run_id`, `tool_name`, `content`
- Returns: `scenario_id`, `updated`

### `scenario_complete_finalize_complete.sql`
- Finalizes scenario resources
- Parameters: `scenario_id`, `run_id`
- Returns: `scenario_id`, `completed`

## Key Responsibilities

1. **Randomization**: Randomizes missing values (persona, documents, parameters) before generation
   - Centralized randomization logic used by both frontend and simulation flow
   - Only randomizes values that are missing (None or empty)
   - Links randomized selections to scenario if scenarioId provided
   - Emits `scenario_randomize_complete` event before generation starts
2. **Scenario Generation**: Creates problem statements, objectives, and questions using AI
3. **Resource Linking**: Links generated resources to scenarios, personas, documents, and fields
4. **Tool Management**: Manages scenario tools (title, problem_statement, objectives, questions, image, video)
5. **Image/Video Generation**: Optionally triggers image/video agents for media generation
6. **Simulation Integration**: Can trigger simulation advance after generation

## Randomization Step

The first step in `generate_scenario` is randomization of missing values:

1. **Checks for missing values**: Determines which of `personaIds`, `documentIds`, or `fieldIds` are missing
2. **Randomizes missing values**: Uses centralized `_randomize_missing_scenario_values()` helper function
3. **Links selections**: If `scenarioId` is provided, links randomized selections to the scenario
4. **Emits event**: Emits `scenario_randomize_complete` event to client with randomized selections
5. **Proceeds with generation**: Continues with AI generation using randomized (or provided) values

This ensures both frontend scenario creation and simulation flow (`next.py`) use identical randomization logic.

## Integration Points

- **Image Agent**: Triggered when `imagesEnabled=true` and `imageAgentId` provided
- **Video Agent**: Triggered when `videoEnabled=true` and `videoAgentId` provided
- **Simulation Agent**: Can trigger `simulation_advance` after generation
- **Randomization**: Centralized logic used by both frontend and simulation flow

## File Structure

```
scenario/
├── __init__.py          # Event registration
├── Z-DOCS.md           # This file
├── generate.py          # Main generation handler
├── regenerate.py        # Regeneration handler
├── randomize.py         # Randomization handler
├── progress.py          # Progress updates
├── complete.py          # Completion handler
├── error.py            # Error handling
└── tools/              # Scenario agent tools
    ├── title/           # Title tool (create_title)
    ├── document/        # Document tool (create_document)
    ├── image/           # Image tool (create_image)
    ├── video/           # Video tool (create_video)
    ├── objective/       # Objective tool (create_objective)
    ├── question/        # Question tool (create_question)
    ├── statement/       # Statement tool (create_statement)
    └── debug/           # Debug tool (debug_info)
```

## Tools

The scenario agent uses the following tools (located in `tools/` subfolder):

- **title**: Creates/updates scenario titles (`scenario_tool_title`)
- **document**: Creates documents from scenario generation (`scenario_tool_document`)
- **image**: Creates images for scenarios (`scenario_tool_image`)
- **video**: Creates videos for scenarios (`scenario_tool_video`)
- **objective**: Creates objectives for scenarios (`scenario_tool_objective`)
- **question**: Creates questions for scenarios (`scenario_tool_question`)
- **statement**: Creates problem statements for scenarios (`scenario_tool_statement`)
- **debug**: Debug information tool (`scenario_tool_debug`)

## Client Events

### `scenarios_generation_progress`
- Emitted by: `progress.py`
- Payload: `type`, `message`, `tool_name`, `trace_id`

### `scenarios_generation_complete`
- Emitted by: `complete.py`
- Payload: `success`, `scenario_id`, `trace_id`

### `scenarios_generation_error`
- Emitted by: `generate.py`, `error.py`
- Payload: `success`, `message`, `trace_id`

### `scenario_randomize_complete`
- Emitted by: `generate.py` (during randomization step)
- Payload: `success`, `randomized_selections` (personaIds, documentIds, fieldIds), `message`
- Note: This event is emitted before generation starts, allowing frontend to update UI with randomized values

