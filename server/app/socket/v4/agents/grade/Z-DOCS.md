# Grade Text Agent Documentation

## Purpose

The grade text agent grades text-based simulation conversations. It evaluates student performance across multiple standard groups and standards, generating detailed feedback and scores.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `simulation_grading_start`** with:
   - `chat_id`: UUID of the chat to grade
   - `department_id`: UUID of the department
   - `sid`: Optional WebSocket session ID

2. **Server (`grade_text/generate.py`)**:
   - Gets context (chat, scenario, rubric, conversation history)
   - Creates grading agent with tools (one per standard group)
   - Runs agent with streaming
   - Emits `grade_text_progress` internal events for each tool call
   - Emits `log_run` for token/pricing logging
   - Emits `grade_text_complete` on completion

3. **Server (`grade_text/progress.py`)**:
   - Receives `grade_text_progress` internal events
   - Updates grading progress incrementally
   - Emits `simulations_text_grading_progress` to client

4. **Server (`grade_text/complete.py`)**:
   - Receives `grade_text_complete` internal events
   - Finalizes grading in database
   - Emits `simulations_text_grading_complete` to client

## SQL Files

### `get_grading_run_context_and_create_run_complete.sql`
- Gets all context needed for grading
- Creates run atomically with rate limit check
- Parameters: `chat_id`, `department_id`, `profile_id`
- Returns: All context fields (chat, scenario, rubric, standard groups, standards, conversation history, agent, model, provider, etc.)

### `grade_text_progress_update_complete.sql`
- Updates grading progress incrementally
- Parameters: `chat_id`, `run_id`, `standard_group_id`, `standard_id`, `score`, `feedback`
- Returns: `chat_id`, `standard_group_id`, `standard_id`, `updated`

### `grade_text_complete_finalize_complete.sql`
- Finalizes grading in database
- Parameters: `chat_id`, `run_id`
- Returns: `chat_id`, `completed`, `total_score`

## Key Responsibilities

1. **Grading**: Evaluates student performance across multiple dimensions
2. **Standard Groups**: Grades each standard group independently
3. **Tool Management**: Creates one tool per standard group for structured grading
4. **Feedback Generation**: Generates detailed feedback for each standard group
5. **Score Calculation**: Calculates total scores based on rubric structure

## Integration Points

- **Rubric Agent**: Uses rubric structure (standard groups, standards) for grading
- **Simulation Text Agent**: Grades text-based simulation conversations
- **Chat History**: Uses conversation history for evaluation

## File Structure

```
grade_text/
├── __init__.py          # Event registration
├── Z-DOCS.md           # This file
├── generate.py          # Main grading handler
├── progress.py          # Progress updates
├── complete.py          # Completion handler
└── error.py            # Error handling
```

## Client Events

### `simulations_text_grading_progress`
- Emitted by: `progress.py`
- Payload: `type`, `message`, `chat_id`, `standard_group_id`, `standard_id`

### `simulations_text_grading_complete`
- Emitted by: `complete.py`
- Payload: `success`, `chat_id`, `total_score`

### `simulations_text_grading_error`
- Emitted by: `generate.py`, `error.py`
- Payload: `success`, `message`, `chat_id`

