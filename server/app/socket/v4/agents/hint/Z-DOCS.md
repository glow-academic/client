# Hint Agent Documentation

## Purpose

The hint agent generates hints for practice simulations. It creates strategic teaching hints based on conversation history, helping GTAs provide better guidance to students.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `simulation_hints_generate`** with:
   - `chat_id`: UUID of the chat
   - `message_id`: UUID of the message to generate hints for
   - `department_id`: UUID of the department

2. **Server (`hint/generate.py`)**:
   - Gets context (chat, scenario, conversation history)
   - Creates hint agent with `create_hint` tool
   - Runs agent with streaming
   - Collects hints from tool calls (at least 3 hints required)
   - Emits `hint_progress` internal events
   - Emits `log_run` for token/pricing logging
   - Emits `hint_complete` on completion

3. **Server (`hint/progress.py`)**:
   - Receives `hint_progress` internal events
   - Updates hint generation progress
   - Emits `hints_generation_progress` to client

4. **Server (`hint/complete.py`)**:
   - Receives `hint_complete` internal events
   - Finalizes hints in database
   - Emits `hints_generation_complete` to client

## SQL Files

### `get_hint_run_context_and_create_run_complete.sql`
- Gets all context needed for hint generation
- Creates run atomically with rate limit check
- Parameters: `chat_id`, `message_id`, `department_id`, `profile_id`
- Returns: All context fields (chat, scenario, conversation history, agent, model, provider, etc.)

### `hint_progress_update_complete.sql`
- Updates hint generation progress
- Parameters: `chat_id`, `run_id`, `hint_count`, `hints`
- Returns: `chat_id`, `hint_count`

### `hint_complete_finalize_complete.sql`
- Finalizes hints in database
- Parameters: `chat_id`, `run_id`, `hints`
- Returns: `chat_id`, `hint_ids`, `completed`

## Key Responsibilities

1. **Hint Generation**: Creates strategic teaching hints using AI
2. **Conversation Analysis**: Analyzes conversation history to generate contextually relevant hints
3. **Tool Management**: Manages hint creation tool (create_hint)
4. **Minimum Hints**: Ensures at least 3 hints are generated per request

## Integration Points

- **Simulation Text Agent**: Triggered automatically for practice simulations
- **Chat History**: Uses conversation history for context-aware hint generation

## File Structure

```
hint/
├── __init__.py          # Event registration
├── Z-DOCS.md           # This file
├── generate.py          # Main generation handler
├── progress.py          # Progress updates
├── complete.py          # Completion handler
└── error.py            # Error handling
```

## Client Events

### `hints_generation_progress`
- Emitted by: `progress.py`
- Payload: `type`, `message`, `error`, `chat_id`, `message_id`, `hint_ids`, `hints_count`, `hints`

### `hints_generation_complete`
- Emitted by: `complete.py`
- Payload: `success`, `chat_id`, `message_id`, `hint_ids`

### `hints_generation_error`
- Emitted by: `generate.py`, `error.py`
- Payload: `success`, `message`, `chat_id`, `message_id`

