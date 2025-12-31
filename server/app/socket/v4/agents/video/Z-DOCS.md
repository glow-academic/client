# Video Agent Documentation

## Purpose

The video agent generates videos using OpenAI's Sora API. It creates videos based on prompts and optionally image references, polling for completion and downloading the final video.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `video_generate`** with:
   - `videoId`: UUID of the video to generate
   - `prompt`: Text prompt for video generation
   - `agentId`: UUID of the agent for video generation
   - `imageReferenceId`: Optional UUID of image reference
   - `departmentId`: Optional UUID of the department

2. **Server (`video/generate.py`)**:
   - Gets context and creates run atomically (via SQL)
   - Decrypts API key
   - Creates video job via OpenAI Sora API
   - Polls for completion with progress updates
   - Downloads completed video
   - Saves video to disk
   - Updates video record with upload_id
   - Emits `videos_generation_progress` during polling
   - Emits `videos_generation_complete` on completion

3. **Server (`video/progress.py`)**:
   - Receives `video_progress` internal events
   - Updates video generation progress
   - Emits `videos_generation_progress` to client

4. **Server (`video/complete.py`)**:
   - Receives `video_complete` internal events
   - Finalizes video generation
   - Emits `videos_generation_complete` to client

## SQL Files

### `get_video_run_context_and_create_run_complete.sql`
- Gets all context needed for video generation
- Creates run atomically with rate limit check
- Parameters: `video_id`, `agent_id`, `profile_id`, `department_id`
- Returns: All context fields (agent, model, provider, API key, video info, etc.)

### `video_progress_update_complete.sql`
- Updates video generation progress
- Parameters: `video_id`, `run_id`, `status`, `progress`
- Returns: `video_id`, `status`, `progress`

### `video_complete_finalize_complete.sql`
- Finalizes video generation
- Parameters: `video_id`, `run_id`, `upload_id`
- Returns: `video_id`, `completed`, `upload_id`

## Key Responsibilities

1. **Video Generation**: Generates videos using OpenAI Sora API
2. **Polling**: Polls for video job completion with progress updates
3. **File Management**: Downloads and saves generated videos to disk
4. **Upload Linking**: Links generated videos to upload records
5. **Progress Reporting**: Provides real-time progress updates during generation

## Integration Points

- **Scenario Agent**: Triggered when `videoEnabled=true` for scenario generation
- **Image Agent**: Can use image references for video generation
- **OpenAI Sora API**: Uses Sora API for video generation

## File Structure

```
video/
├── __init__.py          # Event registration
├── Z-DOCS.md           # This file
├── generate.py          # Main video generation handler
├── progress.py          # Progress updates
├── complete.py          # Completion handler
└── error.py            # Error handling
```

## Client Events

### `videos_generation_progress`
- Emitted by: `generate.py`, `progress.py`
- Payload: `type`, `message`, `status`, `progress`, `video_id`

### `videos_generation_complete`
- Emitted by: `generate.py`, `complete.py`
- Payload: `success`, `video_id`, `upload_id`, `message`

### `videos_generation_error`
- Emitted by: `generate.py`, `error.py`
- Payload: `success`, `video_id`, `message`

