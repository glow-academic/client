# Document Agent Documentation

## Purpose

The document agent generates document templates using AI. It creates HTML templates and JSON schemas for structured document forms based on department, field, and document inputs.

## Event Flow

### Client → Server → Internal → Client

1. **Client emits `document_generate`** with:
   - `departmentId`: UUID of the department
   - `documentAgentId`: UUID of the agent for document generation
   - `fieldIds`: Optional list of field UUIDs
   - `documentIds`: Optional list of document UUIDs
   - `profileId`: Optional UUID of the profile

2. **Server (`document/generate.py`)**:
   - Gets context and creates run atomically (via SQL)
   - Creates document agent with tools (template_html, template_schema)
   - Runs agent with streaming
   - Emits `document_progress` internal events for tool calls
   - Emits `log_run` for token/pricing logging
   - Emits `document_complete` on completion

3. **Server (`document/progress.py`)**:
   - Receives `document_progress` internal events
   - Updates document resources incrementally
   - Emits `documents_generation_progress` to client

4. **Server (`document/complete.py`)**:
   - Receives `document_complete` internal events
   - Finalizes document resources
   - Emits `documents_generation_complete` to client

## SQL Files

### `get_document_run_context_and_create_run_complete.sql`
- Gets all context needed for document generation
- Creates run atomically with rate limit check
- Parameters: `department_id`, `document_agent_id`, `profile_id`, `field_ids`, `document_ids`
- Returns: All context fields (agent, model, provider, field info, document info, etc.)

### `document_progress_update_complete.sql`
- Updates document resources incrementally (template_html, template_schema)
- Parameters: `document_id`, `run_id`, `tool_name`, `content`
- Returns: `document_id`, `updated`

### `document_complete_finalize_complete.sql`
- Finalizes document resources
- Parameters: `document_id`, `run_id`
- Returns: `document_id`, `completed`

## Key Responsibilities

1. **Document Generation**: Creates HTML templates and JSON schemas using AI
2. **Resource Linking**: Links generated templates to documents, fields, and departments
3. **Tool Management**: Manages document tools (template_html, template_schema)
4. **Template Context**: Formats document template context for agent input

## Integration Points

- **Field Agent**: Uses field information for template generation
- **Document Templates**: Creates reusable templates for document forms

## File Structure

```
document/
├── __init__.py          # Event registration
├── Z-DOCS.md           # This file
├── generate.py          # Main generation handler
├── progress.py          # Progress updates
├── complete.py          # Completion handler
└── error.py            # Error handling
```

## Client Events

### `documents_generation_progress`
- Emitted by: `progress.py`
- Payload: `type`, `message`, `trace_id`

### `documents_generation_complete`
- Emitted by: `complete.py`
- Payload: `success`, `document_id`, `trace_id`

### `documents_generation_error`
- Emitted by: `generate.py`, `error.py`
- Payload: `success`, `message`, `trace_id`

