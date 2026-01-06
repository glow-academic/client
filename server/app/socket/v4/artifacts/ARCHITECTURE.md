# Artifacts Adapter Architecture

## Overview

The artifacts adapter system provides a unified, modality-first architecture for generating artifacts (text, images, videos, audio) across multiple AI providers (OpenAI, Gemini, etc.). The system is designed with the following principles:

- **Modality-First Organization**: Adapters are organized by modality (text, image, video, audio, tool_call) rather than provider
- **Unified Persistence**: All providers use the same persistence helpers, ensuring consistent database storage
- **Unified Interfaces**: Each modality has a base interface that all providers must implement
- **DHH-Style Pattern**: Database is the source of truth; frontend sends minimal data; backend adapters handle provider-specific logic
- **Extensibility**: Easy to add new providers by implementing the base interfaces

## Architecture Principles

### 1. Modality-First Structure

**Old Structure (Provider-First):**
```
adapters/
├── openai/
│   ├── text.py
│   ├── image.py
│   ├── video.py
│   └── audio.py
└── gemini/
    └── (empty)
```

**New Structure (Modality-First):**
```
adapters/
├── text/
│   ├── base.py          # BaseTextAdapter interface
│   ├── openai.py        # OpenAI implementation
│   └── gemini.py        # Gemini stub
├── image/
│   ├── base.py          # BaseImageAdapter interface
│   ├── openai.py        # OpenAI implementation
│   └── gemini.py        # Gemini stub
├── video/
│   ├── base.py          # BaseVideoAdapter interface
│   ├── openai.py        # OpenAI implementation
│   └── gemini.py        # Gemini stub
├── audio/
│   ├── base.py          # BaseAudioAdapter interface
│   ├── openai.py        # OpenAI WebRTC implementation
│   ├── gemini_webrtc.py # Gemini WebRTC stub
│   └── gemini_websocket.py # Gemini WebSocket stub
├── tool_call/
│   ├── base.py          # BaseToolCallAdapter interface
│   ├── openai.py        # OpenAI implementation
│   └── gemini.py        # Gemini stub
├── base.py              # Common types and interfaces
└── persistence.py       # Unified persistence helpers
```

**Benefits:**
- Easy to add new providers: just implement the base interface for each modality
- Consistent behavior: all providers for a modality behave the same way
- Clear separation: each adapter focuses on provider-specific generation logic

### 2. Unified Persistence

All artifact persistence goes through unified helpers in `persistence.py`:

- `persist_image()` - Saves image files and creates database records
- `persist_video()` - Saves video files and creates database records
- `persist_tool_call()` - Creates tool call records (handled by tool_call adapters)
- `persist_audio_message()` - Links audio uploads to messages

**Benefits:**
- Consistent database schema: all providers store data the same way
- Single source of truth: persistence logic is centralized
- Easier maintenance: changes to persistence affect all providers

### 3. Unified Interfaces

Each modality has a base interface that defines the contract:

- `BaseTextAdapter` - `generate()` method for text generation
- `BaseImageAdapter` - `generate()` returns `ImageGenerationResult`
- `BaseVideoAdapter` - `generate()` returns `VideoGenerationResult`
- `BaseAudioAdapter` - `initialize_session()` and `handle_webrtc_event()`
- `BaseToolCallAdapter` - `stream_tool_calls()` for tool call streaming

**Benefits:**
- Type safety: All adapters implement the same interface
- Predictable behavior: Same methods across all providers
- Easy testing: Can mock base interfaces

### 4. DHH-Style Pattern

**Database as Source of Truth:**
- All configuration comes from SQL functions
- SQL functions handle rate limiting, run creation, context fetching
- Adapters fetch what they need from the database

**Frontend Sends Minimal Data:**
- Frontend only sends identifying information (agent_id, resource_id, resource_type)
- No provider-specific configuration in frontend
- Frontend receives unified response types

**Backend Adapters Handle Provider Logic:**
- Adapters fetch additional data they need (personas, history, tools)
- Adapters format data for provider-specific APIs
- Adapters generate provider-specific credentials (ephemeral keys, auth tokens)

## File Structure

### Core Files

#### `adapters/base.py`
Defines common types and base interfaces:
- `ModelConfig` - Model configuration from database
- `AgentConfig` - Agent configuration from SQL result
- `ImageGenerationResult` - Unified image result type
- `VideoGenerationResult` - Unified video result type
- `AudioSessionConfig` - Unified audio session configuration
- `ToolCallResult` - Unified tool call result type
- Base interfaces for each modality

#### `adapters/persistence.py`
Unified persistence helpers:
- `persist_image()` - Save image and create database records
- `persist_video()` - Save video and create database records
- `persist_audio_message()` - Link audio uploads to messages
- Helper functions for user/assistant audio persistence

### Modality Adapters

#### Text Adapters (`adapters/text/`)

**Base Interface:**
```python
class BaseTextAdapter(ABC):
    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> None:
        """Generate text using provider-specific logic."""
```

**OpenAI Implementation:**
- Uses `GenericAgent` for text generation
- Streams tool calls via `OpenAIToolCallAdapter`
- Emits progress and completion events
- Handles audio input if provided

**Key Features:**
- Tool call streaming with unified result types
- Message history handling
- System/developer message linking
- Usage tracking and logging

#### Image Adapters (`adapters/image/`)

**Base Interface:**
```python
class BaseImageAdapter(ABC):
    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID | None,
        conn: Any,
    ) -> ImageGenerationResult:
        """Generate image - returns unified result type."""
```

**OpenAI Implementation:**
- Uses LiteLLM for image generation
- Supports multiple providers (OpenAI, Anthropic, Google, Stability AI)
- Handles base64 and URL responses
- Returns `ImageGenerationResult` with image_bytes, mime_type, file_size

**Flow:**
1. Get agent context + create run (SQL)
2. Decrypt API key
3. Call LiteLLM image generation API
4. Download image if URL provided
5. Return `ImageGenerationResult`
6. Router calls `persist_image()` to save

#### Video Adapters (`adapters/video/`)

**Base Interface:**
```python
class BaseVideoAdapter(ABC):
    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID | None,
        conn: Any,
    ) -> VideoGenerationResult:
        """Generate video - returns unified result type."""
```

**OpenAI Implementation:**
- Uses OpenAI Sora API
- Polls for completion with progress updates
- Creates upload record before returning
- Returns `VideoGenerationResult` with video_bytes, mime_type, file_size, upload_id

**Flow:**
1. Get agent context + create run (SQL)
2. Decrypt API key
3. Create video job via OpenAI API
4. Poll for completion (max 5 minutes)
5. Download video when complete
6. Create upload record
7. Return `VideoGenerationResult`
8. Router calls `persist_video()` to save

#### Audio Adapters (`adapters/audio/`)

**Base Interface:**
```python
class BaseAudioAdapter(ABC):
    def get_implementation_type(self) -> Literal["webrtc", "websocket"]:
        """Returns whether this adapter uses WebRTC or WebSocket."""
    
    async def initialize_session(
        self,
        conn: Any,
        agent_config: AgentConfig,
        resource_id: uuid.UUID,
        resource_type: str,
        run_id: uuid.UUID,
        **kwargs: Any,
    ) -> AudioSessionConfig:
        """Initialize audio session - adapter fetches what it needs from DB."""
    
    async def handle_webrtc_event(
        self,
        conn: Any,
        event_type: str,
        event_data: dict[str, Any],
        run_id: uuid.UUID,
    ) -> None:
        """Handle WebRTC forwarding events from frontend."""
```

**OpenAI Implementation (WebRTC):**
- Generates ephemeral key via OpenAI Realtime API
- Returns `AudioSessionConfig` with ephemeral_key, expires_in, model
- TODO: Fetch personas, tools, history and format for OpenAI Realtime
- TODO: Implement `handle_webrtc_event()` for 14 unified event types

**Implementation Types:**
- **WebRTC**: Client-side handling (OpenAI Realtime API)
  - Frontend creates `RealtimeSession` with `OpenAIRealtimeWebRTC` transport
  - Frontend forwards transport events to backend via socket events
  - Backend adapter handles forwarding events and persists to database
- **WebSocket**: Backend handling (future Gemini, xAI)
  - Backend creates WebSocket connection to provider
  - Backend streams audio to frontend via socket events
  - Backend adapter handles streaming and persistence

#### Tool Call Adapters (`adapters/tool_call/`)

**Base Interface:**
```python
class BaseToolCallAdapter(ABC):
    async def stream_tool_calls(
        self,
        runner: Any,
        sid: str,
        resource_id: str | None,
        resource_type: str,
        run_id: uuid.UUID,
        group_id: uuid.UUID | None,
        tool_name_to_type: dict[str, str],
        required_tool_names: set[str],
    ) -> set[str]:
        """Stream tool calls - returns unified result types."""
```

**OpenAI Implementation:**
- Uses `stream_agent_events()` from agents library
- Emits tool_call_start, tool_call_progress, tool_call_complete events
- Tracks completed tool names for verification
- Returns set of completed tool names

**Flow:**
1. Define callbacks for tool call events
2. Stream events from agent runner
3. Emit progress events via internal Socket.IO bus
4. SQL functions handle persistence (via text_tool_progress_update_complete.sql)
5. Return completed tool names

## Routing System

### Main Router (`generate.py`)

The main router uses a `MODALITY_ADAPTERS` mapping to route requests:

```python
MODALITY_ADAPTERS = {
    "text": {"openai": OpenAITextAdapter, "gemini": None},
    "image": {"openai": OpenAIImageAdapter, "gemini": None},
    "video": {"openai": OpenAIVideoAdapter, "gemini": None},
    "audio": {"openai": OpenAIAudioAdapter, "gemini": None},
}
```

**Flow:**
1. Receive `generate_artifact` event
2. Get agent context + create run (SQL)
3. Determine modality from `resource_type`
4. Determine provider from SQL result
5. Get adapter class from `MODALITY_ADAPTERS`
6. Instantiate adapter
7. Call adapter's `generate()` method
8. For image/video: persist result and emit completion
9. For audio: handle special WebRTC case

**Special Cases:**
- **Audio (WebRTC)**: Calls `initialize_session()` and returns `AudioSessionConfig` to frontend
- **Image/Video**: Adapter returns result, router persists and emits completion
- **Text**: Adapter handles everything internally (emits events directly)

## Audio Endpoints

### Unified Audio Start (`audio/start.py`)

**Event:** `audio_session_start`

**DHH-Style Pattern:**
- Frontend sends minimal data: `{agent_id, resource_id, resource_type}`
- Backend gets agent config from database (via SQL function)
- Routes to appropriate adapter's `initialize_session()`
- Adapter fetches additional data it needs (personas, history, tools) from DB
- Adapter formats data for provider and returns unified `AudioSessionConfig`

**Response:**
```python
{
    "success": True,
    "type": "webrtc" | "websocket",
    "run_id": str,
    "ephemeral_key": str,  # For WebRTC
    "expires_in": int,      # For WebRTC
    "model": str,
    "tools": list[dict],    # Provider-formatted tools
    "instructions": str,    # Provider-formatted instructions
    "history": list[dict],  # Provider-formatted history
    "websocket_url": str,   # For WebSocket
    "auth_token": str,      # For WebSocket
}
```

### WebRTC Event Forwarding (`audio/events.py`)

**Unified Audio Event Interface - 14 Event Types:**

**User Events:**
1. `audio_user_start` - User speech started (with item_id, audio_start_ms)
2. `audio_user_progress` - User speech transcription delta (incremental transcript)
3. `audio_user_complete` - User speech completed (final transcript, upload_id for audio file)

**Assistant Events:**
1. `audio_assistant_start` - Assistant speech/tool call started (with call_id, item_id)
2. `audio_assistant_progress` - Assistant tool call delta (incremental arguments)
3. `audio_assistant_complete` - Assistant tool call completed (final arguments, upload_id for audio file)

**Tool Call Events:**
1. `audio_tool_call_start` - Tool call started (call_id, tool_name)
2. `audio_tool_call_progress` - Tool call arguments delta (incremental)
3. `audio_tool_call_complete` - Tool call completed (final arguments)

**Audio Linking Events:**
1. `audio_user_audio_link` - Link user audio upload to message (upload_id, item_id, message_id)
2. `audio_assistant_audio_link` - Link assistant audio upload to message (upload_id, call_id, message_id)

**Session Events:**
1. `audio_session_usage` - Token/pricing usage data (run_id, input_tokens, output_tokens, etc.)
2. `audio_session_interrupt` - Session interrupted/cancelled (run_id, reason)

**Error Events:**
1. `audio_error` - Generic error event (error_message, context)

**Event Routing:**
- All events route to adapter's `handle_webrtc_event()` method
- Adapter handles provider-specific persistence logic
- Unified persistence via `persist_audio_message()` helper

### Unified Audio Stop (`audio/stop.py`)

**Event:** `audio_session_stop`

**Flow:**
1. Receive stop request with `run_id`
2. Emit `audio_session_stopped` event to frontend
3. Cleanup handled by adapter if needed

## Backward Compatibility

### Old Event Mapping

The system maintains backward compatibility by mapping old `simulation_voice_*` events to new `audio_webrtc_*` events:

```python
OLD_TO_NEW_EVENT_MAPPING = {
    "simulation_voice_user_start": "audio_user_start",
    "simulation_voice_user_progress": "audio_user_progress",
    "simulation_voice_user_complete": "audio_user_complete",
    "simulation_voice_assistant_start": "audio_assistant_start",
    "simulation_voice_assistant_delta": "audio_assistant_progress",
    "simulation_voice_assistant_done": "audio_assistant_complete",
    "simulation_voice_tool_call_start": "audio_tool_call_start",
    "simulation_voice_tool_call_progress": "audio_tool_call_progress",
    "simulation_voice_tool_call_complete": "audio_tool_call_complete",
    "simulation_voice_user_audio_link": "audio_user_audio_link",
    "simulation_voice_assistant_audio_link": "audio_assistant_audio_link",
    "simulation_voice_usage": "audio_session_usage",
    "simulation_voice_interrupt": "audio_session_interrupt",
    "simulation_voice_error": "audio_error",
}
```

All old events are automatically routed to the new adapter system.

## Usage Examples

### Text Generation

```python
# Frontend sends:
{
    "agent_id": "uuid",
    "resource_id": "uuid",
    "resource_type": "simulation",
    "message_ids": ["uuid1", "uuid2"],
}

# Router:
# 1. Gets context + creates run (SQL)
# 2. Routes to OpenAITextAdapter
# 3. Adapter generates text with tool calls
# 4. Adapter emits events directly
```

### Image Generation

```python
# Frontend sends:
{
    "agent_id": "uuid",
    "resource_id": "uuid",  # image_id
    "resource_type": "image",
    "name": "My Image",
    "prompt": "A beautiful sunset",
}

# Router:
# 1. Gets context + creates run (SQL)
# 2. Routes to OpenAIImageAdapter
# 3. Adapter generates image, returns ImageGenerationResult
# 4. Router calls persist_image()
# 5. Router emits generate_image_complete
```

### Video Generation

```python
# Frontend sends:
{
    "agent_id": "uuid",
    "resource_id": "uuid",  # video_id
    "resource_type": "video",
    "prompt": "A cat playing piano",
    "imageReferenceId": "uuid",  # Optional
}

# Router:
# 1. Gets context + creates run (SQL)
# 2. Routes to OpenAIVideoAdapter
# 3. Adapter polls for completion, returns VideoGenerationResult
# 4. Router calls persist_video()
# 5. Router emits generate_video_complete
```

### Audio Generation (WebRTC)

```python
# Frontend sends:
{
    "agent_id": "uuid",
    "resource_id": "uuid",  # chat_id for voice, upload_id for audio
    "resource_type": "voice",  # or "audio"
}

# Router:
# 1. Gets context + creates run (SQL)
# 2. Routes to OpenAIAudioAdapter
# 3. Adapter calls initialize_session()
# 4. Adapter fetches personas, tools, history from DB
# 5. Adapter formats for OpenAI Realtime
# 6. Adapter generates ephemeral key
# 7. Returns AudioSessionConfig
# 8. Router emits audio_session_started with config

# Frontend then forwards WebRTC events:
{
    "event_type": "audio_user_start",
    "event_data": {"item_id": "...", "audio_start_ms": 0},
    "run_id": "uuid",
}

# Router:
# 1. Routes to adapter's handle_webrtc_event()
# 2. Adapter handles persistence
```

## Adding a New Provider

To add a new provider (e.g., Anthropic), implement the base interfaces:

1. **Create adapter files:**
   ```
   adapters/text/anthropic.py
   adapters/image/anthropic.py
   adapters/video/anthropic.py
   adapters/audio/anthropic_webrtc.py  # or _websocket.py
   adapters/tool_call/anthropic.py
   ```

2. **Implement base interfaces:**
   ```python
   class AnthropicTextAdapter(BaseTextAdapter):
       async def generate(self, sid, data, profile_id, conn):
           # Provider-specific implementation
           pass
   ```

3. **Add to MODALITY_ADAPTERS mapping:**
   ```python
   MODALITY_ADAPTERS = {
       "text": {
           "openai": OpenAITextAdapter,
           "gemini": None,
           "anthropic": AnthropicTextAdapter,  # Add here
       },
       # ... other modalities
   }
   ```

4. **Use unified persistence:**
   - All adapters use `persist_image()`, `persist_video()`, etc.
   - No need to implement persistence logic

## Database Integration

### SQL Functions

The system relies on SQL functions for:
- **Context Fetching**: `get_*_run_context_and_create_run_complete.sql`
- **Rate Limiting**: Built into context functions
- **Run Creation**: Atomic with context fetching
- **Tool Call Persistence**: `text_tool_progress_update_complete.sql`
- **Message Linking**: Various message linking functions

### Key SQL Functions

- `socket_get_generation_run_context_and_create_run_v4()` - Creates run and returns context
- `socket_get_audio_run_context_and_create_run_v4()` - Audio-specific context
- `socket_text_tool_progress_update_v4()` - Tool call persistence
- `socket_complete_image_generation_v4()` - Image persistence
- `api_create_generation_and_link_v4()` - Video persistence

## Error Handling

All adapters follow consistent error handling:

1. **SQL Errors**: Caught and emitted as `generate_error` events
2. **Rate Limiting**: Detected in SQL, returned as user-friendly messages
3. **Provider Errors**: Caught and emitted with context
4. **Validation Errors**: Caught early, emitted before processing

Error events include:
- `sid` - Socket ID
- `error_message` - Human-readable error message
- `resource_id` - Resource ID for context
- `resource_type` - Resource type for routing

## Testing Strategy

### Unit Tests
- Test each adapter's `generate()` method with mocked providers
- Test persistence helpers with mocked database connections
- Test base interfaces with mock implementations

### Integration Tests
- Test full flow from `generate_start` → adapter → persistence → `generate_end`
- Test routing logic with different providers/modalities
- Test error handling and rate limiting

### Audio Tests
- Test WebRTC forwarding events route correctly through adapters
- Test backward compatibility event mapping
- Test session initialization and cleanup

## Future Enhancements

### TODO Items

1. **Audio Adapter Enhancements:**
   - Implement persona fetching and formatting for OpenAI Realtime
   - Implement tool fetching and formatting for OpenAI Realtime
   - Implement history fetching and formatting for OpenAI Realtime
   - Implement `handle_webrtc_event()` for all 14 event types

2. **Gemini Adapters:**
   - Implement Gemini text adapter
   - Implement Gemini image adapter
   - Implement Gemini video adapter
   - Implement Gemini audio adapters (WebRTC and WebSocket)

3. **Additional Providers:**
   - Anthropic adapters
   - xAI adapters
   - Other providers as needed

4. **Persistence Enhancements:**
   - Implement `persist_user_audio()` helper
   - Implement `persist_assistant_audio()` helper
   - Enhance tool call persistence helpers

## Migration Notes

### From Old Structure

The old provider-first structure has been completely migrated:
- ✅ All adapters moved to modality-first structure
- ✅ All imports updated
- ✅ Old folders removed
- ✅ Backward compatibility maintained for events

### Breaking Changes

None - backward compatibility is maintained through event mapping.

### Deprecations

Old `simulation_voice_*` events are deprecated but still work. New code should use `audio_*` events.

## Key Design Decisions

1. **Modality-First**: Makes it easier to add providers and ensures consistent behavior
2. **Unified Persistence**: Ensures all providers store data consistently
3. **DHH-Style**: Database is source of truth, frontend stays simple
4. **Base Interfaces**: Type safety and predictable behavior
5. **Event-Based**: Uses Socket.IO events for real-time communication
6. **SQL Functions**: Database handles complex logic (rate limiting, run creation)

## References

- Base interfaces: `adapters/base.py`
- Persistence helpers: `adapters/persistence.py`
- Main router: `generate.py`
- Audio endpoints: `audio/start.py`, `audio/events.py`, `audio/stop.py`
- End handler: `end.py`

