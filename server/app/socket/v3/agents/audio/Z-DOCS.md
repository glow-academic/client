# Audio Agent Documentation

## Purpose

The audio agent grades voice-based simulation conversations. It evaluates student performance across multiple standard groups and standards, generating detailed feedback and scores for voice interactions.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `simulation_grading_start`** with:
   - `chat_id`: UUID of the chat to grade
   - `department_id`: UUID of the department
   - `sid`: Optional WebSocket session ID

2. **Server (`audio/generate.py`)**:
   - Gets context (chat, scenario, rubric, conversation history)
   - Creates grading agent with tools (one per standard group)
   - Runs agent with streaming
   - Emits `audio_progress` internal events for each tool call
   - Emits `log_run` for token/pricing logging
   - Emits `audio_complete` on completion

3. **Server (`audio/progress.py`)**:
   - Receives `audio_progress` internal events
   - Updates grading progress incrementally
   - Emits `simulations_voice_grading_progress` to client

4. **Server (`audio/complete.py`)**:
   - Receives `audio_complete` internal events
   - Finalizes grading in database
   - Emits `simulations_voice_grading_complete` to client

## SQL Files

### `get_grading_run_context_and_create_run_complete.sql`
- Gets all context needed for grading
- Creates run atomically with rate limit check
- Parameters: `chat_id`, `department_id`, `profile_id`
- Returns: All context fields (chat, scenario, rubric, standard groups, standards, conversation history, agent, model, provider, etc.)

### `audio_progress_update_complete.sql`
- Updates grading progress incrementally
- Parameters: `chat_id`, `run_id`, `standard_group_id`, `standard_id`, `score`, `feedback`
- Returns: `chat_id`, `standard_group_id`, `standard_id`, `updated`

### `audio_complete_finalize_complete.sql`
- Finalizes grading in database
- Parameters: `chat_id`, `run_id`
- Returns: `chat_id`, `completed`, `total_score`

## Key Responsibilities

1. **Grading**: Evaluates student performance across multiple dimensions for voice interactions
2. **Standard Groups**: Grades each standard group independently
3. **Tool Management**: Creates one tool per standard group for structured grading
4. **Feedback Generation**: Generates detailed feedback for each standard group
5. **Score Calculation**: Calculates total scores based on rubric structure

## Integration Points

- **Rubric Agent**: Uses rubric structure (standard groups, standards) for grading
- **Simulation Voice Agent**: Grades voice-based simulation conversations
- **Chat History**: Uses conversation history (including audio transcripts) for evaluation

## File Structure

```
audio/
├── __init__.py          # Event registration
├── Z-DOCS.md           # This file
├── generate.py          # Main grading handler
├── progress.py          # Progress updates
├── complete.py          # Completion handler
└── error.py            # Error handling
```

## Client Events

### `simulations_voice_grading_progress`
- Emitted by: `progress.py`
- Payload: `type`, `message`, `chat_id`, `standard_group_id`, `standard_id`

### `simulations_voice_grading_complete`
- Emitted by: `complete.py`
- Payload: `success`, `chat_id`, `total_score`

### `simulations_voice_grading_error`
- Emitted by: `generate.py`, `error.py`
- Payload: `success`, `message`, `chat_id`

## Internal Events

### `audio_progress`
- Internal event name (was `grade_voice_progress`)
- Emitted by: `generate.py`
- Handled by: `progress.py`

### `audio_complete`
- Internal event name (was `grade_voice_complete`)
- Emitted by: `generate.py`
- Handled by: `complete.py`

### `audio_error`
- Internal event name (was `grade_voice_error`)
- Emitted by: `generate.py`
- Handled by: `error.py`

