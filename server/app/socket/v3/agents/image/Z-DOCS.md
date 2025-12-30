# Image Agent Documentation

## Purpose

The image agent generates images using AI image generation models (via LiteLLM). It creates images based on prompts and links them to scenarios or other resources.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `generate_image`** (or internal `generate_image` event) with:
   - `image_id`: UUID of the image to generate
   - `name`: Name of the image
   - `prompt`: Text prompt for image generation
   - `agent_id`: UUID of the agent for image generation
   - `department_id`: Optional UUID of the department
   - `room`: Optional room for event targeting
   - `trace_id`: Optional trace ID for scenario tool completion

2. **Server (`image/generate.py`)**:
   - Gets context and creates run atomically (via SQL)
   - Decrypts API key
   - Calls LiteLLM image generation API
   - Downloads generated image
   - Saves image to disk
   - Updates image record with upload_id
   - Emits `images_generation_complete` to client

3. **Server (`image/complete.py`)**:
   - Receives `image_generation_complete` events (from client or internal)
   - Finalizes image generation
   - Emits `images_generation_complete` to client

## SQL Files

### `get_image_generation_context_and_create_upload_complete.sql`
- Gets all context needed for image generation
- Creates run atomically with rate limit check
- Creates upload record for generated image
- Parameters: `image_id`, `agent_id`, `profile_id`, `department_id`
- Returns: All context fields (agent, model, provider, API key, image info, etc.)

## Key Responsibilities

1. **Image Generation**: Generates images using AI models via LiteLLM
2. **File Management**: Downloads and saves generated images to disk
3. **Upload Linking**: Links generated images to upload records
4. **Error Handling**: Handles API errors and file system errors gracefully

## Integration Points

- **Scenario Agent**: Triggered when `imagesEnabled=true` for scenario generation
- **LiteLLM**: Uses LiteLLM for image generation API calls
- **Upload System**: Creates upload records for generated images

## File Structure

```
image/
├── __init__.py          # Event registration
├── Z-DOCS.md           # This file
├── generate.py          # Main image generation handler
└── complete.py          # Completion handler (client event)
```

## Client Events

### `images_generation_complete`
- Emitted by: `generate.py`, `complete.py`
- Payload: `success`, `image_id`, `upload_id`, `name`, `trace_id`

### `images_generation_error`
- Emitted by: `generate.py`
- Payload: `success`, `image_id`, `message`, `trace_id`

## Internal Events

### `generate_image`
- Triggered by: Scenario agent (when images enabled)
- Payload: Same as client event
- Handler: `generate.py`

