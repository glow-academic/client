# Simulation Text Agent Documentation

## Purpose

The simulation text agent handles text-based simulation conversations. It receives events from the member agent (when `voice_mode=false`), runs the simulation agent with streaming, and processes tokens incrementally to update messages and tool calls in the database.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `simulation_text_send`** with:
   - `chat_id`: UUID of the chat
   - `message`: User message content
   - `is_retry`: Boolean flag for retry
   - `sketch_data`: Optional sketch data

2. **Server (`simulation_text/send.py`)**: 
   - Validates payload
   - Emits `member_progress` internal event with `voice_mode=false`

3. **Member Agent (`member/progress.py`)**:
   - Upserts user message and run
   - Links run to group
   - Links system/developer messages
   - Emits `simulation_text_generate` internal event

4. **Server (`simulation_text/generate.py`)**:
   - Gets context (run already exists from member_progress)
   - Creates agent instance with persona tools
   - Runs agent with streaming
   - For each token/tool call event:
     - Emits `simulation_text_progress` internal event
   - On completion:
     - Emits `simulation_text_complete` internal event
   - Emits `log_run` for token/pricing logging
   - Emits `simulation_text_complete` with `type="run_complete"`

5. **Server (`simulation_text/progress.py`)**:
   - Receives `simulation_text_progress` internal events
   - Updates DB incrementally via `text_progress_update_complete.sql`
   - Emits `simulations_text_message_token` to client
   - Emits `simulations_text_new_message` to client (on first token)

6. **Server (`simulation_text/complete.py`)**:
   - Receives `simulation_text_complete` internal events
   - Finalizes DB via `text_complete_finalize_complete.sql`
   - Emits `simulations_text_message_complete` to client
   - Emits `simulations_text_new_message` to client (with completed=true)
   - Emits `simulations_text_run_complete` to client (on run completion)

## SQL Files

### `get_text_run_context_complete.sql`
- Gets all context needed to run simulation text agent
- Parameters: `chat_id`, `run_id` (already exists from member_progress)
- Returns: All context fields (chat, attempt, scenario, persona, model, provider, etc.)

### `text_progress_update_complete.sql`
- Updates message content and tool call arguments incrementally
- Parameters: `chat_id`, `run_id`, `tool_call_id`, `call_id`, `tool_name`, `token`, `accumulated_content`, `arguments_raw`, `message_id`, `parent_message_id`, `persona_id`
- Returns: `message_id`, `tool_call_id`, `accumulated_content`
- Creates/updates tool call if provided
- Creates/updates message if provided
- Updates message content incrementally
- Updates tool call arguments incrementally
- Links message to run
- Links message to persona if provided
- Creates message branch if parent_message_id provided

### `text_complete_finalize_complete.sql`
- Finalizes message and tool call
- Parameters: `chat_id`, `run_id`, `tool_call_id`, `call_id`, `message_id`, `final_content`, `persona_id`
- Returns: `message_id`, `final_content`, `completed`
- Finalizes tool call (marks as completed)
- Finalizes message (marks as completed, updates final content)
- Links message to persona if provided

## Key Responsibilities

1. **Agent Execution**: Runs the simulation agent with streaming support
2. **Token Processing**: Processes streaming tokens and tool call arguments incrementally
3. **Database Updates**: Updates messages and tool calls in the database incrementally
4. **Client Communication**: Emits progress and completion events to clients
5. **Persona Tools**: Creates and manages persona tools (speak tool) for multi-persona simulations
6. **Message Branching**: Handles message tree branching for retry scenarios
7. **Hint Generation**: Triggers hint generation for practice simulations

## Integration Points

- **Member Agent**: Receives events from `member_progress` when `voice_mode=false`
- **Unified Streaming Handlers**: Uses SQL files instead of direct calls to unified handlers
- **Client Events**: Emits to client via Socket.IO events (`simulations_text_*`)

## File Structure

```
simulation_text/
├── __init__.py          # Event registration
├── Z-DOCS.md           # This file
├── generate.py          # Agent execution, emits to progress/complete
├── progress.py         # Receives internal emits, updates DB, emits to client
├── complete.py          # Receives internal emits, finalizes DB, emits to client
├── error.py            # Error handling
└── send.py             # Simplified: emits to member_progress
```

## Internal Events

### `simulation_text_generate`
- Triggered by: `member_progress` (when `voice_mode=false`)
- Payload: `sid`, `chat_id`, `run_id`, `group_id`
- Handler: `generate.py`

### `simulation_text_progress`
- Triggered by: `generate.py` (for each token/tool call)
- Payload: `sid`, `type`, `chat_id`, `run_id`, `tool_call_id`, `call_id`, `tool_name`, `token`, `accumulated_content`, `arguments_raw`, `persona_so_far`, `parent_message_id`
- Handler: `progress.py`

### `simulation_text_complete`
- Triggered by: `generate.py` (on completion)
- Payload: `sid`, `type`, `chat_id`, `run_id`, `tool_call_id`, `call_id`, `tool_name`, `final_message`, `final_persona`, `arguments_raw`
- Handler: `complete.py`

## Client Events

### `simulations_text_new_message`
- Emitted by: `progress.py` (on first token), `complete.py` (on completion)
- Payload: `message_id`, `chat_id`, `role`, `content`, `completed`, `created_at`, `persona_id`

### `simulations_text_message_token`
- Emitted by: `progress.py` (for each token)
- Payload: `message_id`, `chat_id`, `token`, `accumulated_content`

### `simulations_text_message_complete`
- Emitted by: `complete.py` (on message completion)
- Payload: `message_id`, `chat_id`, `final_content`

### `simulations_text_run_complete`
- Emitted by: `complete.py` (on run completion)
- Payload: `chat_id`

