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
   - Gets context and creates run atomically (via SQL)
   - Creates scenario agent with tools (title, problem_statement, objectives, questions, image, video)
   - Runs agent with streaming
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

1. **Scenario Generation**: Creates problem statements, objectives, and questions using AI
2. **Resource Linking**: Links generated resources to scenarios, personas, documents, and fields
3. **Tool Management**: Manages scenario tools (title, problem_statement, objectives, questions, image, video)
4. **Image/Video Generation**: Optionally triggers image/video agents for media generation
5. **Simulation Integration**: Can trigger simulation advance after generation

## Integration Points

- **Image Agent**: Triggered when `imagesEnabled=true` and `imageAgentId` provided
- **Video Agent**: Triggered when `videoEnabled=true` and `videoAgentId` provided
- **Simulation Agent**: Can trigger `simulation_advance` after generation

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
└── error.py            # Error handling
```

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

