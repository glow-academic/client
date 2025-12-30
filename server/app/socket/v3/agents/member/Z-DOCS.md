# Member Agent Documentation

## Purpose

The member agent handles user message upserts and orchestrates the flow between text and voice simulation modes. It serves as the entry point for all user messages in simulations, creating/updating user messages and runs, then triggering the appropriate agent (simulation-text or simulation-voice) based on the `voice_mode` flag.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `member_progress`** with:
   - `chat_id`: UUID of the chat
   - `message`: User message content
   - `voice_mode`: Boolean flag indicating if this is a voice message
   - `upload_id`: Optional UUID for voice audio uploads

2. **Server (`member/progress.py`)**:
   - Upserts user message (creates if empty, updates if exists)
   - Upserts run (creates if doesn't exist)
   - Links run to group (atomic)
   - Links system/developer messages to run (atomic)
   - Handles voice_mode flag on message

3. **Server triggers appropriate generate event**:
   - If `voice_mode=true`: Emits `simulation_voice_generate` internally
   - If `voice_mode=false`: Emits `simulation_text_generate` internally

4. **Server emits `message_sent`** event to client for UI updates

## SQL Files

### `member_progress_upsert_complete.sql`

**Purpose**: Atomic upsert of user message and run, with group and message linking.

**Parameters**:
- `$1`: `chat_id` (uuid)
- `$2`: `message_content` (text)
- `$3`: `voice_mode` (boolean)
- `$4`: `upload_id` (uuid, nullable)

**Returns**:
- `message_id`: UUID of the user message (as text)
- `run_id`: UUID of the run (as text)
- `voice_mode`: Boolean flag
- `chat_id`: UUID of the chat (as text)
- `group_id`: UUID of the group (as text)

**Operations**:
1. Gets or creates member agent (role='member')
2. Gets or creates group for chat
3. Upserts run (creates if doesn't exist, uses member agent)
4. Links run to group (atomic)
5. Links profile to run
6. Upserts user message (creates if empty, updates if exists)
7. Links message to run
8. Links audio upload to message (if upload_id provided)
9. Creates branch from latest message
10. Links system/developer messages to run (atomic)

## Key Responsibilities

1. **User Message Management**: Handles creation and updates of user messages
2. **Run Management**: Creates runs with member agent, ensures proper linking
3. **Mode Routing**: Routes to appropriate agent based on voice_mode flag
4. **Group Linking**: Ensures runs are properly linked to chat groups
5. **Message Linking**: Links system/developer messages to runs atomically

## Integration Points

- **simulation-text agent**: Triggered when `voice_mode=false`
- **simulation-voice agent**: Triggered when `voice_mode=true`
- **Unified streaming handlers**: Used indirectly via simulation-text/simulation-voice agents

## Notes

- The `generate.py` file is built but unused in this migration (future use: member agent will decide what to do based on user message)
- All user messages (both text and voice) flow through `member_progress`
- The member agent ensures consistent run creation and message linking across both modes

