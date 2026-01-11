# Tool Call Architecture: BEFORE vs AFTER Inference

## Overview

This document describes the complete architecture for tool calls, tracing everything from tool definition (BEFORE inference) through tool execution (AFTER inference). This is the single source of truth for understanding how tools work in the system.

**Key Statistics:**
- **57 tools** defined in the system
- **115,808 calls** executed (as of latest check)
- **1,617 template values** created from rendered templates

---

## BEFORE INFERENCE — Tool Definition Phase

**Purpose**: Define what the LLM can call and what arguments it should provide

### 1. TOOLS TABLE (57 tools)

```sql
tool (
  id uuid PRIMARY KEY,
  name text NOT NULL,           -- e.g., "create_content", "create_persona"
  description text NOT NULL,    -- Tool description for LLM
  active boolean DEFAULT true
)
```

**Examples:**
- `create_content` - Create content resource
- `create_persona` - Create persona resource
- `create_document` - Create document resource

### 2. INPUT SCHEMAS (56 tools have input schemas)

**Purpose**: Define the structure of arguments the LLM must provide

```
tools
  ↓ (via tool_schemas junction table)
schemas (INPUT schema)
  ↓ (via schema_id FK)
schema_fields (defines argument structure)
  ├─ name: "message"
  ├─ field_type: "string"
  ├─ required: true
  ├─ description: "The message content..."
  ├─ default_value: ""
  └─ template: "" (EMPTY - no Jinja here!)
```

**Key Point**: Input schema fields have **empty templates** - they're just structure definitions, not transformation templates.

**Example Input Schema:**
```sql
-- For create_content tool
schema_fields:
  - name: "message", field_type: "string", required: true, template: ""
  - name: "persona", field_type: "string", required: true, template: ""
```

### 3. OUTPUT SCHEMAS (57 tools have output templates)

**Purpose**: Define how to transform LLM arguments into output values

```
tools
  ↓ (via tool_templates junction table)
templates (OUTPUT schema metadata - 57 templates)
  ├─ Examples: create_content_template, create_persona_template
  └─ Purpose: Define output structure
  ↓ (via schema_templates junction table)
schemas (OUTPUT schema)
  ↓ (via schema_id FK)
schema_fields (with Jinja templates!)
  ├─ name: "content"
  ├─ field_type: "string"
  └─ template: "{{ message }}" ← JINJA TEMPLATE HERE!
```

**Key Point**: Output schema fields have **Jinja templates** - they transform LLM arguments into output values.

**Example Output Schema:**
```sql
-- For create_content tool
schema_fields:
  - name: "content", field_type: "string", template: "{{ message }}"
```

### 4. TOOL DEFINITION JSON (built from INPUT schemas)

**Process:**
1. Query `tool_schemas` → `schemas` → `schema_fields` for input schema
2. Build JSON schema from `schema_fields` (name, field_type, required, description)
3. Send to LLM as available tool

**Example Tool JSON:**
```json
{
  "name": "create_content",
  "description": "Create content resource",
  "arguments": {
    "message": {
      "type": "string",
      "required": true,
      "description": "The message content..."
    },
    "persona": {
      "type": "string",
      "required": true,
      "description": "The name of the persona..."
    }
  }
}
```

**Sent to LLM as available tool**

---

## AFTER INFERENCE — Tool Execution Phase

**Purpose**: Execute the tool call, transform arguments, and create resources

### 1. LLM CALLS TOOL

**LLM decides to call:**
```json
create_content(message="Hello", persona="Alice")
```

### 2. CALLS TABLE (115,808 calls created)

**Created during tool call progress events:**

```sql
INSERT INTO calls (
  id uuid DEFAULT uuidv7(),
  tool_id uuid NOT NULL,                    -- Which tool was called
  template_id uuid NOT NULL,                -- OUTPUT template (from tool_templates)
  arguments_raw text NOT NULL,              -- LLM's arguments: {"message": "Hello", "persona": "Alice"}
  completed boolean DEFAULT false,
  external_call_id text NOT NULL,            -- External identifier
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

**Key Fields:**
- `tool_id`: References `tool.id` - which tool was called
- `template_id`: References `templates.id` - OUTPUT template for rendering
- `arguments_raw`: Raw JSON string of LLM's arguments
- `external_call_id`: External identifier (e.g., from LLM provider)

**Progress Updates:**
- `tool_call_start`: Create `calls` record with initial `arguments_raw`
- `tool_call_progress`: Append to `calls.arguments_raw` incrementally
- `tool_call_complete`: Finalize `calls.arguments_raw`, mark `completed = true`

### 3. TEMPLATE RENDERING (using OUTPUT schema)

**Process:**
1. Lookup output schema via `calls.template_id`:
   ```
   calls.template_id
     → templates (OUTPUT schema metadata)
     → schema_templates (junction)
     → schemas (OUTPUT schema)
     → schema_fields (with Jinja templates)
   ```

2. For each `schema_field` with non-empty `template`:
   - Render Jinja template with `arguments_raw` as context
   - Example: `{{ message }}` with `{"message": "Hello", "persona": "Alice"}` → `"Hello"`

**Implementation:**
- Function: `render_tool_template(conn, tool_id, tool_arguments)`
- Location: `server/app/infra/v4/tools/render_tool_template.py`
- Returns: Dictionary of rendered values keyed by schema field name

### 4. TEMPLATE_VALUES TABLE (1,617 template values created)

**Purpose**: Store rendered values for each output schema field

```sql
INSERT INTO template_values (
  id uuid DEFAULT uuidv7(),
  template_id uuid NOT NULL,                -- Links to a template resource (if created)
  schema_field_id uuid NOT NULL,            -- Which output field
  string_value text,                         -- Rendered value (if string type)
  number_value numeric,                      -- Rendered value (if number type)
  boolean_value boolean,                     -- Rendered value (if boolean type)
  call_id uuid NOT NULL,                     -- Links back to call
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT template_values_check CHECK (
    (string_value IS NOT NULL)::integer + 
    (number_value IS NOT NULL)::integer + 
    (boolean_value IS NOT NULL)::integer = 1
  )
)
```

**Key Points:**
- `template_id`: Links to `templates.id` (the OUTPUT template metadata)
- `schema_field_id`: Links to `schema_fields.id` (which field was rendered)
- `call_id`: Links to `calls.id` (which tool call created this value)
- **Note**: `templates.call_id` column does NOT exist (removed as redundant)

**Example:**
```sql
template_values:
  - template_id: create_content_template_id
  - schema_field_id: content_field_id
  - string_value: "Hello"
  - call_id: call_id_from_step_2
```

### 5. RESOURCE CREATION (creates actual resource records)

**Process:**
1. Execute SQL function like `api_create_{resource}_v4(agent_id, group_id, mcp)`
2. Function reads `calls.arguments_raw` and rendered template values
3. Creates resource record with `call_id` foreign key

**Example for `contents` resource:**
```sql
INSERT INTO contents (
  id uuid DEFAULT uuidv7(),
  call_id uuid NOT NULL,                    -- Links back to call
  active boolean DEFAULT true,
  generated boolean DEFAULT true,
  mcp boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

**Example for `templates` resource:**
```sql
INSERT INTO templates (
  id uuid DEFAULT uuidv7(),
  name text NOT NULL,                        -- e.g., "backfill_content_..."
  active boolean DEFAULT true,
  generated boolean DEFAULT false,
  mcp boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
  -- NOTE: NO call_id column here (removed as redundant)
)
```

**Key Point**: Resource tables link back to `calls` via `call_id` foreign key, NOT via `templates.call_id`.

### 6. RESULT

**After tool execution:**
- ✅ Resource record created (`contents`, `personas`, `documents`, etc.)
- ✅ Template values stored in `template_values` table
- ✅ Call record tracks the execution in `calls` table
- ✅ Message/run records track the conversation

**Tracking:**
- To find which tool call created a resource: `SELECT * FROM calls WHERE id = resource.call_id`
- To find which resource was created by a tool call: `SELECT * FROM resource_table WHERE call_id = calls.id`

---

## Complete Data Flow Example: `create_content`

### BEFORE (Tool Definition)

**Input Schema** (what LLM provides):
```
tool_schemas → schemas → schema_fields:
  - message: string, required, "The message content...", template: ""
  - persona: string, required, "The name of the persona...", template: ""
```

**Output Schema** (what gets created):
```
tool_templates → templates (create_content_template) → 
schema_templates → schemas → schema_fields:
  - content: string, template: "{{ message }}"
```

**Tool JSON sent to LLM:**
```json
{
  "name": "create_content",
  "arguments": {
    "message": {"type": "string", "required": true},
    "persona": {"type": "string", "required": true}
  }
}
```

### AFTER (Tool Execution)

**1. LLM calls tool:**
```json
create_content(message="Hello", persona="Alice")
```

**2. Call created:**
```sql
calls: {
  id: uuid_v7(),
  tool_id: create_content_tool_id,
  template_id: create_content_template_id,
  arguments_raw: '{"message": "Hello", "persona": "Alice"}',
  completed: true,
  external_call_id: "call_abc123"
}
```

**3. Template rendering:**
- Lookup output schema via `calls.template_id`
- Find `schema_field` with `name="content"` and `template="{{ message }}"`
- Render: `{{ message }}` with `{"message": "Hello"}` → `"Hello"`

**4. Template values created:**
```sql
template_values: {
  id: uuid_v7(),
  template_id: create_content_template_id,
  schema_field_id: content_field_id,
  string_value: "Hello",
  call_id: call_id_from_step_2
}
```

**5. Resource created:**
```sql
contents: {
  id: uuid_v7(),
  call_id: call_id_from_step_2,  -- Links back to call
  active: true,
  generated: true
}
```

---

## Summary Table

| Component | BEFORE | AFTER | Count |
|-----------|--------|-------|-------|
| **Tools** | Define what LLM can call | N/A | 57 |
| **Input Schemas** | Define tool arguments | N/A | 56 |
| **Output Templates** | Define output structure | Used for rendering | 57 |
| **Calls** | N/A | Store LLM's tool calls | 115,808 |
| **Template Values** | N/A | Store rendered values | 1,617 |
| **Resources** | N/A | Created records | Varies |

---

## Key Insights

### 1. Two Separate Schemas

- **Input Schema** (`tool_schemas`) → defines arguments (no Jinja)
- **Output Schema** (`tool_templates`) → defines output (has Jinja)

### 2. Templates Table Dual Purpose

- **BEFORE**: 57 templates as output schema metadata (via `tool_templates`)
- **AFTER**: Templates can be created as resource records (but NO `call_id` column)

### 3. Flow Summary

- **BEFORE**: `tool_schemas` → build tool JSON → send to LLM
- **AFTER**: LLM calls → `calls` → render templates → `template_values` → create resource

### 4. Jinja Templates Location

- **Jinja templates are ONLY in OUTPUT schemas**
- Used AFTER inference to transform LLM arguments into output values
- Input schemas have empty templates (just structure definitions)

### 5. Call ID Tracking

- **Resources link to calls**: `resource_table.call_id` → `calls.id`
- **Template values link to calls**: `template_values.call_id` → `calls.id`
- **Templates table**: NO `call_id` column (removed as redundant)
- **Calls table**: Has `template_id` → `templates.id` (OUTPUT schema metadata)

---

## Database Schema Relationships

```
tools
  ├─ tool_schemas → schemas (INPUT schema)
  │                  └─ schema_fields (no Jinja templates)
  │
  └─ tool_templates → templates (OUTPUT schema metadata)
                       └─ schema_templates → schemas (OUTPUT schema)
                                            └─ schema_fields (with Jinja templates)

calls (tool execution)
  ├─ tool_id → tools.id
  ├─ template_id → templates.id (OUTPUT schema metadata)
  └─ arguments_raw: JSON string

template_values (rendered values)
  ├─ template_id → templates.id (OUTPUT schema metadata)
  ├─ schema_field_id → schema_fields.id
  └─ call_id → calls.id

resources (created records)
  └─ call_id → calls.id
```

---

## Implementation Files

### Template Rendering
- **File**: `server/app/infra/v4/tools/render_tool_template.py`
- **Function**: `render_tool_template(conn, tool_id, tool_arguments)`
- **Process**: Gets tool's `template_id`, finds output schema, renders Jinja templates

### Tool Call Progress
- **File**: `server/app/socket/v4/artifacts/progress.py`
- **Function**: `_handle_text_tool_progress(data)`
- **SQL**: `server/app/sql/v4/generate/text/text_tool_progress_update_complete.sql`
- **Process**: Updates `calls.arguments_raw` incrementally

### Tool Call Completion
- **File**: `server/app/socket/v4/artifacts/complete.py`
- **Function**: `_handle_tool_call_template_rendering(call_id)`
- **Process**: Renders templates, creates `template_values` records

### Resource Creation
- **SQL Functions**: `server/app/sql/v4/resources/{resource}_complete.sql`
- **Pattern**: `api_create_{resource}_v4(agent_id, group_id, mcp)`
- **Process**: Reads `calls.arguments_raw`, renders templates, creates resource with `call_id`

---

## References

- Main Architecture: `server/app/socket/v4/artifacts/ARCHITECTURE.md`
- Template Rendering: `server/app/infra/v4/tools/render_tool_template.py`
- Progress Handler: `server/app/socket/v4/artifacts/progress.py`
- Complete Handler: `server/app/socket/v4/artifacts/complete.py`
- Resource SQL Functions: `server/app/sql/v4/resources/*_complete.sql`
