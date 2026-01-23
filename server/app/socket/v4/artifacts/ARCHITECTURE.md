# Artifacts Adapter Architecture

## Overview

The artifacts adapter system provides a unified, modality-first architecture for generating artifacts (text, images, videos, audio) across multiple AI providers (OpenAI, Gemini, etc.). The system is designed with the following principles:

- **Modality-First Organization**: Adapters are organized by modality (text, image, video, audio, tool_call) rather than provider
- **Unified Persistence**: All providers use the same persistence helpers, ensuring consistent database storage
- **Unified Interfaces**: Each modality has a base interface that all providers must implement
- **DHH-Style Pattern**: Database is the source of truth; frontend sends minimal data; backend adapters handle provider-specific logic
- **Domain-Based Agent Resolution**: Resources link to agents via domains, which encapsulate agent and resource context
- **Instructions in System Prompt**: Developer instructions are fetched from `agent_instructions` table and appended to system_prompt in SQL (not separate developer messages)
- **Resource Types Array Support**: `generate_artifact` accepts `resource_types` array for batch generation (backward compatible with single `resource_type`)

## Architecture Principles

### 1. Modality-First Structure

**Structure:**
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
│   └── gemini_webrtc.py # Gemini WebRTC stub
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

### 2. Domain-Based Agent Resolution

**Pattern:**
- Resources (personas, scenarios, documents) link to agents via domains
- Domains encapsulate agent and resource context via `domain_artifacts` junction table
- `generate_artifact` accepts `domain_id` (preferred) or `agent_id` (legacy) for backward compatibility
- When `domain_id` provided, agent_id is resolved from `domains.agent_id` in SQL

**Example:**
```python
# Personas handler gets domain_id from SQL
result = await execute_sql_typed(
    conn,
    "app/sql/v4/queries/personas/get_persona_generation_context_complete.sql",
    params=GetPersonaGenerationContextSqlParams(
        persona_id=persona_id,
        draft_id=draft_id,
        profile_id=profile_id,
    )
)
domain_id = result.domain_id

# Emit generate_artifact with domain_id
await internal_sio.emit("generate_artifact", {
    "domain_id": str(domain_id),  # Preferred over agent_id
    "resource_id": resource_id,
    "resource_types": ["names", "descriptions"],
    ...
})
```

**Benefits:**
- Domain encapsulates agent + artifact context
- Resources can have multiple domains (via domain_artifacts)
- Cleaner separation: resources don't need to know agent_id directly

### 3. Instructions in System Prompt (Not Developer Messages)

**Pattern:**
- Developer instructions are fetched from `agent_instructions` → `instructions` table in SQL
- Instructions are **appended** to `system_prompt` (not prepended) in SQL functions
- No separate developer messages are created
- System prompt (with instructions appended) is inserted as first message to LLM

**SQL Pattern:**
```sql
-- In context_data CTE:
COALESCE(
    CASE 
        WHEN did.developer_instruction_template IS NOT NULL 
         AND did.developer_instruction_template != ''
        THEN COALESCE(pr_prompt.system_prompt, '') || E'\n\n' || did.developer_instruction_template
        ELSE COALESCE(pr_prompt.system_prompt, '')
    END,
    ''
) as system_prompt
```

**Benefits:**
- Instructions are part of system context, not separate messages
- Simpler message structure: system prompt includes all instructions
- No need to manage developer message creation/deduplication

### 4. Resource Types Array Support

**Pattern:**
- `generate_artifact` accepts `resource_types` array (preferred) or `resource_type` (legacy)
- Each resource_type in array gets its own run and generation flow
- Backward compatible: single `resource_type` is converted to array internally

**Example:**
```python
# New: Multiple resource types
await internal_sio.emit("generate_artifact", {
    "domain_id": str(domain_id),
    "resource_id": resource_id,
    "resource_types": ["names", "descriptions", "colors"],  # Array
    ...
})

# Legacy: Single resource type (still works)
await internal_sio.emit("generate_artifact", {
    "agent_id": str(agent_id),
    "resource_id": resource_id,
    "resource_type": "names",  # Single value
    ...
})
```

**Implementation:**
```python
# In _generate_artifact_impl:
resource_types = data.get("resource_types")
if not resource_types:
    # Backward compatibility: single resource_type
    resource_type = data.get("resource_type")
    if resource_type:
        resource_types = [resource_type]
    else:
        raise ValueError("Either resource_types or resource_type must be provided")

# Process each resource_type
for resource_type in resource_types:
    # ... handle each type ...
```

**Benefits:**
- Batch generation: generate multiple resource types in one request
- Backward compatible: existing single resource_type calls still work
- Each resource_type gets its own run (for tracking/auditing)

### 5. Unified Persistence

All artifact persistence goes through unified helpers in `persistence.py`:
- `persist_image()` - Saves image files and creates database records
- `persist_video()` - Saves video files and creates database records
- `persist_tool_call()` - Creates tool call records (handled by tool_call adapters)
- `persist_audio_message()` - Links audio uploads to messages

**Benefits:**
- Consistent database schema: all providers store data the same way
- Single source of truth: persistence logic is centralized
- Easier maintenance: changes to persistence affect all providers

### 6. Unified Interfaces

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

### 7. DHH-Style Pattern

**Database as Source of Truth:**
- All configuration comes from SQL functions
- SQL functions handle rate limiting, run creation, context fetching
- Instructions fetched from `agent_instructions` table in SQL
- System prompt includes instructions (appended in SQL)

**Frontend Sends Minimal Data:**
- Frontend only sends identifying information (`domain_id` or `agent_id`, `resource_id`, `resource_types`)
- No provider-specific configuration in frontend
- Frontend receives unified response types

**Backend Adapters Handle Provider Logic:**
- Adapters fetch additional data they need (personas, history, tools) from DB
- Adapters format data for provider-specific APIs
- Adapters generate provider-specific credentials (ephemeral keys, auth tokens)

## Key Changes from Previous Architecture

### Removed: developer_message_contents Parameter

**Before:**
- `developer_message_contents` was passed as optional parameter to `generate_artifact`
- SQL function created separate developer messages with role "developer"
- Developer messages were linked to runs via `message_runs`

**After:**
- `developer_message_contents` parameter completely removed
- Instructions fetched from `agent_instructions` table in SQL
- Instructions appended to system_prompt (not separate messages)
- System prompt (with instructions) inserted as first message to LLM

**Files Changed:**
- `server/app/sql/v4/queries/generate/start/get_generation_run_context_and_create_run_complete.sql` - Removed developer_message_contentss parameter and all developer message creation CTEs
- `server/app/sql/v4/queries/generate/text/get_text_run_context_and_create_run_complete.sql` - Append instructions to system_prompt, removed developer message creation
- `server/app/sql/v4/queries/generate/text/get_text_run_context_for_existing_run_complete.sql` - Append instructions to system_prompt
- `server/app/socket/v4/artifacts/generate.py` - Removed developer_message_contents from SQL params
- All resource handlers (scenario, document, personas, rubric, agent) - Removed developer_message_contents from generate_artifact emits

### Added: Resource Types Array Support

**Before:**
- `generate_artifact` accepted single `resource_type` parameter
- Handlers emitted one `generate_artifact` event per resource type

**After:**
- `generate_artifact` accepts `resource_types` array (preferred)
- Backward compatible: still accepts single `resource_type` parameter
- Process each resource_type in the array (each gets its own run)

**Files Changed:**
- `server/app/socket/v4/artifacts/generate.py` - Added resource_types array handling with backward compatibility

### Added: Domain-Based Agent Resolution

**Before:**
- Resources passed `agent_id` directly to `generate_artifact`
- Personas handler had hardcoded TODO for agent_id lookup

**After:**
- Resources pass `domain_id` (preferred) or `agent_id` (legacy)
- `generate_artifact` resolves `agent_id` from `domain_id` if provided
- Personas handler uses SQL function to get `domain_id`

**Files Changed:**
- `server/app/sql/v4/queries/personas/get_persona_generation_context_complete.sql` - NEW FILE: Gets domain_id and agent_id for persona generation
- `server/app/socket/v4/personas/generate.py` - Calls SQL function to get domain_id, emits with domain_id
- `server/app/socket/v4/artifacts/generate.py` - Resolves agent_id from domain_id if provided

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
- System prompt includes instructions (appended in SQL)
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
2. Handle `resource_types` array (or `resource_type` for backward compatibility)
3. For each resource_type:
   - Resolve `agent_id` from `domain_id` if provided
   - Get agent context + create run (SQL)
   - Determine modality from `resource_type`
   - Determine provider from SQL result
   - Get adapter class from `MODALITY_ADAPTERS`
   - Instantiate adapter
   - Call adapter's `generate()` method
   - For image/video: persist result and emit completion
   - For audio: handle special WebRTC case

**Special Cases:**
- **Audio (WebRTC)**: Calls `initialize_session()` and returns `AudioSessionConfig` to frontend
- **Image/Video**: Adapter returns result, router persists and emits completion
- **Text**: Adapter handles everything internally (emits events directly)

## Resource-Specific Client Handlers

### Architecture Pattern

The artifacts system is **server-to-server only** - adapters emit internal events via `internal_sio.emit()` and never interact directly with clients. Resource-specific folders (e.g., `rubric/`, `scenario/`, `document/`, `personas/`) bridge the gap between artifacts and clients.

**Key Principle**: Artifacts = Infrastructure, Resources = Client Communication

### Event Flow

```
artifacts/adapters/text/openai.py
  → internal_sio.emit("generate_text_progress", {...})
  → internal_sio.emit("generate_text_complete", {...})
  → internal_sio.emit("generate_error", {...})

rubric/progress.py
  → @internal_sio.on("generate_text_progress")
  → Filter by resource_type == "rubric"
  → sio.emit("artifact_generation_progress", {...})

rubric/complete.py
  → @internal_sio.on("rubric_end")  # From artifacts/end.py
  → Fetch tool results from DB
  → Format resource-specifically
  → sio.emit("artifact_tool_call_complete", {...})
  → sio.emit("artifact_generation_complete", {...})

rubric/error.py
  → @internal_sio.on("rubric_error")  # From artifacts/error.py
  → sio.emit("artifact_generation_error", {...})
```

### Resource Handler Structure

Each resource folder (e.g., `rubric/`, `personas/`) contains:

- **`progress.py`**: Listens to `generate_text_progress`, filters by `resource_type`, emits `artifact_generation_progress`
- **`complete.py`**: Listens to `{resource}_end`, fetches tool results from DB, formats them, emits `artifact_tool_call_complete` and `artifact_generation_complete`
- **`error.py`**: Listens to `{resource}_error`, emits `artifact_generation_error`
- **`generate.py`**: Entry point (client → server), gets domain_id from SQL (if needed), routes to `generate_artifact`

### Personas Handler Pattern

**`personas/generate.py`:**
```python
# Get domain_id from SQL function
result = await execute_sql_typed(
    conn,
    "app/sql/v4/queries/personas/get_persona_generation_context_complete.sql",
    params=GetPersonaGenerationContextSqlParams(
        persona_id=persona_id,
        draft_id=draft_id,
        profile_id=profile_id,
    )
)
domain_id = result.domain_id

# Emit generate_artifact with domain_id and resource_types array
await internal_sio.emit("generate_artifact", {
    "domain_id": str(domain_id),
    "resource_id": resource_id,
    "resource_types": ["names", "descriptions"],  # Array
    ...
})
```

**Benefits:**
- Domain encapsulates agent + artifact context
- SQL function handles department/domain resolution logic
- Clean separation: handler doesn't need to know agent_id

### Unified Client Events

All resource handlers emit unified client events with `resource_type` and `resource_id`:

- **`artifact_generation_progress`**: Progress updates with `type: "start" | "tool_call"`
- **`artifact_tool_call_complete`**: Tool call completion with tool-specific results
- **`artifact_generation_complete`**: Run completion
- **`artifact_generation_error`**: Error events

**Frontend Filtering:**
```typescript
socket.on("artifact_generation_progress", (data) => {
  if (data.resource_type === "rubric" && data.resource_id === rubricId) {
    // Handle rubric progress
  }
});
```

### Tool Result Fetching Pattern

Resource handlers fetch tool results from database when tool calls complete:

```python
# In rubric/complete.py
if data["type"] == "tool_call_complete":
    if data["tool_name"] == "standard_description":
        # Fetch from DB using resource-specific SQL function
        result = await execute_sql_typed(
            conn,
            "app/sql/v4/queries/rubric/get_rubric_tool_call_results_complete.sql",
            params=GetRubricToolCallResultsSqlParams(run_id=uuid.UUID(data["run_id"]))
        )
        # Format and emit to client
        await sio.emit("artifact_tool_call_complete", {
            "resource_type": "rubric",
            "tool_name": "standard_description",
            "descriptions": formatted_descriptions,
            ...
        })
```

### Benefits

1. **Clear Separation**: Artifacts handle infrastructure, resources handle client communication
2. **Resource-Specific Logic**: Each resource formats its own tool results
3. **Unified Events**: All resources emit same event names, frontend filters by `resource_type`
4. **Tool Result Retrieval**: Handlers fetch actual results from DB, not just arguments
5. **Reduced Abstraction**: Resources own their client communication logic

## Eval Mode Support

### Overview

Eval mode allows benchmarks to reuse the artifact generation infrastructure as a single source of truth, while preventing resource handlers from processing eval runs. When `eval_mode=True`, resource handlers skip processing, allowing benchmark handlers to track completion via `group_id` linkage.

### Architecture Principles

1. **Artifacts Stay Agnostic**: Artifacts folder remains simulation/eval agnostic - only passes `eval_mode` flag through events
2. **Group ID Links Everything**: Use existing `group_id` to link eval runs - no enriched payload changes needed
3. **Resource Handlers Skip Evals**: Resource handlers check `eval_mode` and return early if `True`
4. **Benchmark Handlers Filter**: Benchmark handlers listen to `artifact_generation_*` events and only process when `eval_mode=True`
5. **Tool Execution Unchanged**: Tools still execute normally in `artifacts/complete.py` - only resource post-processing is skipped

### Flow Diagram

```
benchmark_next emits agent_eval_start
  → eval handler calls generate_artifact with eval_mode=True
  → artifacts/generate.py creates run streams LLM
  → artifacts/generate.py emits generate_progress with eval_mode=True
  → artifacts/progress.py emits artifact_generation_progress with eval_mode=True
  → artifacts/complete.py executes tools normally
  → artifacts/complete.py emits generate_complete with eval_mode=True
  → artifacts/complete.py emits resource_complete with eval_mode=True
  → personas/complete.py checks eval_mode → Skip processing (return early)
  → artifacts/complete.py emits artifact_generation_complete with eval_mode=True
  → benchmark/complete.py checks eval_mode → Process and emit benchmark_eval_complete
  → next.py receives benchmark_eval_complete and tracks completion
```

### Implementation

**1. Eval Mode Flag Passing**

The `eval_mode` boolean flag is extracted in `artifacts/generate.py` and passed through all events:

```python
# In _generate_artifact_impl
eval_mode = data.get("eval_mode", False)

# Pass to modality handlers
await _handle_text_generation(..., eval_mode=eval_mode)

# Include in all emit calls
await internal_sio.emit("generate_progress", {
    ...,
    "eval_mode": eval_mode,
})
```

**2. Resource Handler Skipping**

Resource handlers check `eval_mode` and return early if `True`:

```python
# In personas/complete.py
@internal_sio.on("resource_complete")
async def handle_persona_artifact_complete(data: dict[str, Any]) -> None:
    eval_mode = data.get("eval_mode", False)
    if eval_mode:
        return  # Don't process evals - benchmark handlers will handle them
    
    # ... normal processing ...
```

**3. Benchmark Handler Filtering**

Benchmark handlers listen to `artifact_generation_*` events and only process when `eval_mode=True`:

```python
# In benchmark/complete.py
@sio.on("artifact_generation_complete")
async def handle_benchmark_complete(data: dict[str, Any]) -> None:
    eval_mode = data.get("eval_mode", False)
    if not eval_mode:
        return  # Not an eval - skip
    
    # Extract group_id for linking
    group_id = data.get("group_id")
    
    # Emit benchmark_eval_complete for next.py to track
    await internal_sio.emit("benchmark_eval_complete", {
        "group_id": group_id_str,
        "run_id": run_id,
        "success": True,
    })
```

**4. Eval Start Routing**

Eval handlers route `{agent_name}_eval_start` events to `generate_artifact` with `eval_mode=True`:

```python
# In benchmark/eval.py
@internal_sio.on("simulation_eval_start")
async def simulation_eval_start_internal(data: dict[str, Any]) -> None:
    # Extract eval context
    agent_id = data.get("agent_id")
    group_id = data.get("group_id")
    
    # Route to generate_artifact with eval_mode=True
    await internal_sio.emit("generate_artifact", {
        "sid": sid,
        "agent_id": str(agent_id),
        "resource_types": ["text"],
        "artifact_type": "eval",
        "group_id": str(group_id),
        "eval_mode": True,  # CRITICAL: Enable eval mode
    })
```

### Benefits

1. **Single Source of Truth**: Benchmarks reuse artifact generation infrastructure
2. **No Duplication**: No need to duplicate generation logic for benchmarks
3. **Clean Separation**: Resource handlers skip evals, benchmark handlers process them
4. **Group ID Linking**: `group_id` links all related data (runs, tests, attempts, eval contexts)
5. **Backward Compatible**: `eval_mode` defaults to `False` for existing flows

### Files Changed

- `server/app/socket/v4/artifacts/generate.py` - Add eval_mode parameter passing
- `server/app/socket/v4/artifacts/progress.py` - Add eval_mode to events
- `server/app/socket/v4/artifacts/complete.py` - Add eval_mode to events
- `server/app/socket/v4/personas/complete.py` - Skip when eval_mode=True
- `server/app/socket/v4/benchmark/progress.py` - NEW: Listen to artifact_generation_progress
- `server/app/socket/v4/benchmark/complete.py` - NEW: Listen to artifact_generation_complete
- `server/app/socket/v4/benchmark/error.py` - NEW: Listen to artifact_generation_error
- `server/app/socket/v4/benchmark/eval.py` - NEW: Route eval_start to generate_artifact

## Database Integration

### SQL Functions

The system relies on SQL functions for:
- **Context Fetching**: `get_*_run_context_and_create_run_complete.sql`
- **Rate Limiting**: Built into context functions
- **Run Creation**: Atomic with context fetching
- **Tool Call Persistence**: `text_tool_progress_update_complete.sql`
- **Message Linking**: Various message linking functions
- **Domain Resolution**: `get_persona_generation_context_complete.sql` (for personas)

### Key SQL Functions

- `socket_get_generation_run_context_and_create_run_v4()` - Creates run and returns context (no developer_message_contentss parameter)
- `socket_get_text_run_context_and_create_run_v4()` - Text context with instructions appended to system_prompt
- `socket_get_text_run_context_for_existing_run_v4()` - Text context for existing run with instructions appended to system_prompt
- `api_get_persona_generation_context_v4()` - Gets domain_id and agent_id for persona generation
- `socket_get_audio_run_context_and_create_run_v4()` - Audio-specific context
- `socket_text_tool_progress_update_v4()` - Tool call persistence
- `socket_complete_image_generation_v4()` - Image persistence
- `api_create_generation_and_link_v4()` - Video persistence

### Instruction Fetching Pattern

Instructions are fetched from `agent_instructions` table in SQL:

```sql
-- In developer_instruction_data CTE:
LEFT JOIN agent_instructions ai ON ai.agent_id = a.id
LEFT JOIN instructions i ON i.id = ai.instruction_id AND i.active = true
```

Instructions are appended to system_prompt:

```sql
-- In context_data CTE:
COALESCE(
    CASE 
        WHEN did.developer_instruction_template IS NOT NULL 
         AND did.developer_instruction_template != ''
        THEN COALESCE(pr_prompt.system_prompt, '') || E'\n\n' || did.developer_instruction_template
        ELSE COALESCE(pr_prompt.system_prompt, '')
    END,
    ''
) as system_prompt
```

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
- Test full flow from `generate_artifact` → adapter → persistence → completion
- Test routing logic with different providers/modalities
- Test error handling and rate limiting
- Test resource_types array handling
- Test domain_id resolution

### Audio Tests
- Test WebRTC forwarding events route correctly through adapters
- Test backward compatibility event mapping
- Test session initialization and cleanup

## Migration Notes

### Breaking Changes

**Removed Parameter:**
- `developer_message_contents` parameter removed from `generate_artifact` endpoint
- No longer passed to SQL functions
- No longer used in resource handlers

**New Parameters:**
- `resource_types` array added (backward compatible with `resource_type`)
- `domain_id` added (backward compatible with `agent_id`)

### Backward Compatibility

- Single `resource_type` parameter still works (converted to array internally)
- `agent_id` parameter still works (preferred: use `domain_id`)
- Existing handlers continue to work without changes

### Deprecations

- `developer_message_contents` parameter is deprecated (removed)
- Direct `agent_id` usage is deprecated (preferred: use `domain_id`)

## Key Design Decisions

1. **Modality-First**: Makes it easier to add providers and ensures consistent behavior
2. **Unified Persistence**: Ensures all providers store data consistently
3. **DHH-Style**: Database is source of truth, frontend stays simple
4. **Base Interfaces**: Type safety and predictable behavior
5. **Event-Based**: Uses Socket.IO events for real-time communication
6. **SQL Functions**: Database handles complex logic (rate limiting, run creation, instruction fetching)
7. **Domain-Based Resolution**: Resources link to agents via domains for cleaner architecture
8. **Instructions in System Prompt**: Simpler message structure, instructions part of system context
9. **Resource Types Array**: Batch generation support with backward compatibility

## References

- Base interfaces: `adapters/base.py`
- Persistence helpers: `adapters/persistence.py`
- Main router: `generate.py`
- Audio endpoints: `audio/start.py`, `audio/events.py`, `audio/stop.py`
- End handler: `end.py`
- Personas SQL: `app/sql/v4/queries/personas/get_persona_generation_context_complete.sql`
- **Tool Call Architecture**: `TOOL_CALL_ARCHITECTURE.md` - Complete BEFORE/AFTER inference architecture for tool calls