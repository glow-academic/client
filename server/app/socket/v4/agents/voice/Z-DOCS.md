# Simulation Voice Agent Documentation

## Purpose

The simulation voice agent handles voice-based simulation conversations using the OpenAI Realtime API. It receives events from the member agent (when `voice_mode=true`), generates ephemeral keys for Realtime API sessions, and processes assistant messages/tool calls from the Realtime API.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `simulation_voice_user_transcript` or `simulation_voice_user_text`** with:
   - `chat_id`: UUID of the chat
   - `message`: User message content
   - `upload_id`: Optional UUID for voice audio uploads

2. **Server (`member/progress.py`)**:
   - Upserts user message and run (with `audio=true`)
   - Links run to group
   - Links system/developer messages
   - Emits `simulation_voice_generate` internal event

3. **Server (`simulation_voice/generate.py`)**:
   - Gets context (run already exists from member_progress)
   - Generates ephemeral key from OpenAI Realtime API
   - Builds persona tools and voice agent configuration
   - Returns ephemeral key and configuration to client via `simulations_voice_start_response`
   - Client connects to Realtime API using ephemeral key

4. **Client → Realtime API → Server (`simulation_voice/progress.py`)**:
   - Client emits `simulation_voice_assistant_delta` → Incremental tool call argument updates
   - Client emits `simulation_voice_assistant_done` → Tool call completion
   - Client emits `simulation_voice_assistant_audio_link` → Audio upload linking
   - All handled by `progress.py` via `voice_progress_upsert_complete.sql`
   - Emits `simulations_text_message_token` and `simulations_text_message_complete` to client (reuses text events)

5. **Client → Server (`simulation_voice/complete.py`)**:
   - Client emits `simulation_voice_complete` when voice session ends
   - Finalizes all incomplete messages and runs via `voice_complete_complete.sql`
   - Emits `simulations_voice_complete` to client

## SQL Files

### `get_voice_run_context_complete.sql`
- Gets all context needed for voice simulation
- Parameters: `chat_id`, `run_id` (already exists from member_progress)
- Returns: All context fields including voice-specific fields (voice_model_name, voice_provider, voice_api_key, voice_system_prompt, voice_agent_id, etc.)

### `voice_progress_upsert_complete.sql`
- Upserts assistant message and tool call
- Parameters: `chat_id`, `run_id`, `call_id`, `tool_name`, `arguments_raw`, `message_content`, `persona_id`, `parent_message_id`, `upload_id`, `message_id`, `is_complete`
- Returns: `message_id`, `tool_call_id`, `final_content`, `upload_linked`
- Creates/updates tool call if `call_id` provided
- Creates/updates message if `message_id` provided or if `call_id` provided
- Updates message content incrementally or with final content
- Updates tool call arguments incrementally or with final arguments
- Links message to run
- Links tool call to run
- Links audio upload to message if `upload_id` provided
- Links message to persona if `persona_id` provided
- Creates message branch if `parent_message_id` provided

### `voice_complete_complete.sql`
- Finalizes voice simulation messages and runs
- Parameters: `chat_id`, `run_id`
- Returns: `success`, `messages_finalized`
- Finalizes all incomplete assistant messages for the run
- Marks run as complete

## Key Responsibilities

1. **Ephemeral Key Generation**: Generates OpenAI Realtime API ephemeral keys for voice sessions
2. **Voice Agent Configuration**: Builds persona tools and voice agent instructions for Realtime API
3. **Assistant Message Processing**: Processes incremental tool call arguments and finalizes messages
4. **Audio Linking**: Links audio uploads to assistant messages
5. **Database Updates**: Updates messages and tool calls in the database incrementally
6. **Client Communication**: Emits progress and completion events to clients (reuses text simulation events)

## Integration Points

- **Member Agent**: Receives events from `member_progress` when `voice_mode=true`
- **Realtime API**: Client connects to Realtime API using ephemeral key from `generate.py`
- **Text Simulation Events**: Reuses `simulations_text_message_token` and `simulations_text_message_complete` events for consistency
- **Client Events**: Emits to client via Socket.IO events (`simulations_voice_*`)

## File Structure

```
simulation_voice/
├── __init__.py          # Event registration
├── Z-DOCS.md           # This file
├── generate.py          # Ephemeral key generation, returns configuration
├── progress.py          # Assistant message/tool call upserts (consolidates assistant/delta, assistant/done, assistant/audio)
├── complete.py          # Finalization
├── error.py             # Error handling
└── [REMOVED]:
    ├── start.py         # Logic moved to generate.py
    ├── user/            # Consolidated into member_progress
    └── assistant/       # Consolidated into progress.py
```

## Client Events

### `simulation_voice_assistant_delta`
- Emitted by: Client (from Realtime API)
- Payload: `chat_id`, `call_id`, `item_id`, `delta`, `response_id`
- Handler: `progress.py` → `voice_progress_upsert_complete.sql`

### `simulation_voice_assistant_done`
- Emitted by: Client (from Realtime API)
- Payload: `chat_id`, `call_id`, `item_id`, `arguments`, `response_id`
- Handler: `progress.py` → `voice_progress_upsert_complete.sql`

### `simulation_voice_assistant_audio_link`
- Emitted by: Client
- Payload: `chat_id`, `message_id`, `upload_id`
- Handler: `progress.py` → `voice_progress_upsert_complete.sql`

### `simulation_voice_complete`
- Emitted by: Client (when voice session ends)
- Payload: `chat_id`, `run_id` (optional)
- Handler: `complete.py` → `voice_complete_complete.sql`

## Server Events

### `simulations_voice_start_response`
- Emitted by: `generate.py`
- Payload: `success`, `message`, `ephemeral_key`, `persona_tools`, `tool_context_map`, `instructions`, `model`, `voice`, `transcription_model`, `transcription_prompt`, `history`
- Received by: Client (to configure Realtime API session)

### `simulations_text_message_token` (reused)
- Emitted by: `progress.py`
- Payload: `message_id`, `chat_id`, `token`, `accumulated_content`
- Received by: Client (for real-time message updates)

### `simulations_text_message_complete` (reused)
- Emitted by: `progress.py`
- Payload: `message_id`, `chat_id`, `final_content`
- Received by: Client (for message completion)

### `simulations_voice_complete`
- Emitted by: `complete.py`
- Payload: `success`, `message`
- Received by: Client (for session completion)

