# Rubric Agent Documentation

## Purpose

The rubric agent generates rubric descriptions for educational rubrics. It creates detailed descriptions for each combination of standard group and standard, providing clear performance criteria for grading.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `rubric_generate`** with:
   - `department_id`: UUID of the department
   - `rubric_agent_id`: UUID of the agent for rubric generation
   - `rubric_id`: UUID of the rubric to generate descriptions for
   - `profile_id`: Optional UUID of the profile

2. **Server (`rubric/generate.py`)**:
   - Gets context and creates run atomically (via SQL)
   - Gets rubric structure (standard groups, standards)
   - Creates rubric agent with `generate_standard_group_descriptions` tool
   - Runs agent with streaming
   - Emits `rubric_progress` internal events
   - Emits `log_run` for token/pricing logging
   - Emits `rubric_complete` on completion

3. **Server (`rubric/progress.py`)**:
   - Receives `rubric_progress` internal events
   - Updates rubric descriptions incrementally
   - Emits `rubrics_generation_progress` to client

4. **Server (`rubric/complete.py`)**:
   - Receives `rubric_complete` internal events
   - Finalizes rubric descriptions
   - Emits `rubrics_generation_complete` to client

## SQL Files

### `get_rubric_run_context_and_create_run_complete.sql`
- Gets all context needed for rubric generation
- Creates run atomically with rate limit check
- Parameters: `department_id`, `rubric_agent_id`, `profile_id`, `rubric_id`
- Returns: All context fields (agent, model, provider, rubric structure, standard groups, standards, etc.)

### `rubric_progress_update_complete.sql`
- Updates rubric descriptions incrementally
- Parameters: `rubric_id`, `run_id`, `standard_group_id`, `standard_id`, `description`
- Returns: `rubric_id`, `standard_group_id`, `standard_id`, `updated`

### `rubric_complete_finalize_complete.sql`
- Finalizes rubric descriptions
- Parameters: `rubric_id`, `run_id`
- Returns: `rubric_id`, `completed`

## Key Responsibilities

1. **Description Generation**: Creates detailed descriptions for each rubric grid cell
2. **Grid Coverage**: Ensures all combinations of standard groups and standards are covered
3. **Tool Management**: Manages rubric description tool (generate_standard_group_descriptions)
4. **Consistency**: Ensures descriptions are consistent within standard groups
5. **Regeneration**: Supports regenerating descriptions with user instructions

## Integration Points

- **Grade Agents**: Generated rubrics are used by grade_text and grade_voice agents
- **Rubric Structure**: Uses existing rubric structure (standard groups, standards) for generation

## File Structure

```
rubric/
├── __init__.py          # Event registration
├── Z-DOCS.md           # This file
├── generate.py          # Main generation handler
├── regenerate.py        # Regeneration handler (with user instructions)
├── progress.py          # Progress updates
├── complete.py          # Completion handler
└── error.py            # Error handling
```

## Client Events

### `rubrics_generation_progress`
- Emitted by: `progress.py`
- Payload: `type`, `message`, `rubric_id`

### `rubrics_generation_complete`
- Emitted by: `complete.py`
- Payload: `success`, `rubric_id`, `message`

### `rubrics_generation_error`
- Emitted by: `generate.py`, `error.py`
- Payload: `success`, `message`, `rubric_id`

