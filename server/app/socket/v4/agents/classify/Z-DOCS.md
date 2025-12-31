# Classify Agent Documentation

## Purpose

The classify agent classifies uploaded files by matching them to parameter items. It analyzes file names and content to determine which parameter items each file should be linked to.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `classify_upload`** with:
   - `uploadId`: UUID of the upload to classify
   - `profileId`: UUID of the profile

2. **Server (`classify/generate.py`)**:
   - Gets context and creates run atomically (via SQL)
   - Extracts files from upload (supports ZIP files)
   - Gets parameter items for classification
   - Creates classification agent with tools (one per parameter item)
   - Runs agent with streaming
   - Emits `classify_progress` internal events
   - Emits `log_run` for token/pricing logging
   - Emits `classify_complete` on completion

3. **Server (`classify/progress.py`)**:
   - Receives `classify_progress` internal events
   - Updates classification progress
   - Emits `uploads_classification_progress` to client

4. **Server (`classify/complete.py`)**:
   - Receives `classify_complete` internal events
   - Finalizes file-to-parameter-item links
   - Emits `uploads_classification_complete` to client

## SQL Files

### `get_upload_classification_run_context_and_create_run_complete.sql`
- Gets all context needed for classification
- Creates run atomically with rate limit check
- Parameters: `upload_id`, `profile_id`, `department_id`
- Returns: All context fields (agent, model, provider, upload info, parameter items, etc.)

### `classify_progress_update_complete.sql`
- Updates classification progress incrementally
- Parameters: `upload_id`, `run_id`, `parameter_item_id`, `file_names`
- Returns: `upload_id`, `parameter_item_id`, `updated`

### `classify_complete_finalize_complete.sql`
- Finalizes file-to-parameter-item links
- Parameters: `upload_id`, `run_id`, `classifications`
- Returns: `upload_id`, `completed`, `linked_count`

## Key Responsibilities

1. **File Classification**: Matches files to parameter items based on file names and content
2. **ZIP Support**: Extracts and classifies files from ZIP archives
3. **Tool Management**: Creates one tool per parameter item for structured classification
4. **Multi-Match Support**: Allows files to be linked to multiple parameter items if relevant

## Integration Points

- **Upload System**: Classifies files uploaded via TUS protocol
- **Parameter Items**: Links files to parameter items for structured data organization

## File Structure

```
classify/
├── __init__.py          # Event registration
├── Z-DOCS.md           # This file
├── generate.py          # Main classification handler
├── progress.py          # Progress updates
├── complete.py          # Completion handler
└── error.py            # Error handling
```

## Client Events

### `uploads_classification_progress`
- Emitted by: `progress.py`
- Payload: `type`, `message`

### `uploads_classification_complete`
- Emitted by: `complete.py`
- Payload: `success`, `upload_id`, `classifications`

### `uploads_classification_error`
- Emitted by: `generate.py`, `error.py`
- Payload: `success`, `message`

