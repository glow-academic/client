# Developer Instructions System

## Overview

The `developer_instructions` table stores Jinja2 templates that provide instructions to AI agents. These instructions are dynamically retrieved based on the agent's role and the type of operation being performed.

## Database Schema

### Core Tables

#### `developer_instructions`
The main table storing instruction templates.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `type` (developer_instruction_type enum, UNIQUE) - Type of instruction
- `template` (TEXT) - Jinja2 template string
- `active` (BOOLEAN) - Whether this instruction is active
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Constraints:**
- Only one instruction per type (UNIQUE on `type`)
- Use `active` flag to enable/disable without deleting

**Indexes:**
- `developer_instructions_type_idx` on `type`
- `developer_instructions_active_idx` on `active`

#### `developer_instruction_schemas`
Junction table linking developer instructions to schemas (for validation/context).

**Columns:**
- `developer_instruction_id` (UUID, FK → developer_instructions.id)
- `schema_id` (UUID, FK → schemas.id)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Primary Key:** (`developer_instruction_id`, `schema_id`)

#### `agent_role_developer_instruction_types`
Junction table mapping agent roles to developer instruction types.

**Columns:**
- `agent_role` (agent_role enum)
- `developer_instruction_type` (developer_instruction_type enum)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Primary Key:** (`agent_role`, `developer_instruction_type`)

### Related Schema Tables

#### `schemas`
Container for schema definitions (used for template validation).

#### `schema_fields`
Fields within a schema (name, type, required, position).

#### `schema_field_items`
Junction table for array fields linking to item schemas (for nested structures).

## Enum Types

### `developer_instruction_type`
Available instruction types:
- `scenario_statement` - Instructions for generating scenario statements
- `scenario_document` - Instructions for generating scenario documents
- `persona` - Instructions for persona generation
- `hint` - Instructions for hint generation
- `grade_rubric` - Instructions for rubric grading
- `grade_time` - Instructions for time-based grading
- `classify` - Instructions for classification
- `member` - Instructions for member generation
- `document` - Instructions for document generation

### `schema_field_type`
Field types for schemas:
- `string`
- `number`
- `boolean`
- `array`

## Current Data

### Developer Instructions
All 9 instruction types exist in the database:
- Most have placeholder templates: `{{ placeholder_template }}`
- `document` type has a real template: "Generate a Jinja2 template HTML document..."

### Agent Role Mappings
- `scenario` → `scenario_statement`, `scenario_document`
- `simulation` → `persona`
- `hint` → `hint`
- `grade` → `grade_rubric`, `grade_time`
- `classify` → `classify`
- `member` → `member`
- `document` → `document`

### Schemas
- Each developer instruction has an associated schema (via `developer_instruction_schemas`)
- Currently, all schemas are empty (no `schema_fields` records)

## SQL Functions

### `api_get_developer_instruction_v4`
Retrieves a developer instruction template and schema for a given type and agent role.

**Parameters:**
- `instruction_type` (developer_instruction_type)
- `agent_role_val` (agent_role)

**Returns:**
- `developer_instruction_id` (uuid)
- `type` (developer_instruction_type)
- `template` (text)
- `active` (boolean)
- `schema_id` (uuid)

**Logic:**
1. Joins `developer_instructions` with `agent_role_developer_instruction_types` to match type and role
2. Left joins `developer_instruction_schemas` to get associated schema
3. Filters by `active = true`
4. Returns first match (LIMIT 1)

**File:** `server/app/sql/v4/developer_instructions/get_developer_instruction_complete.sql`

## Usage in Code
C
### Pattern: Retrieving Developer Instructions

```python
from server.app.sql.types import GetDeveloperInstructionSqlParams, GetDeveloperInstructionSqlRow
from server.app.utils.sql_helper import execute_sql_typed

# Create params
dev_instruction_params = GetDeveloperInstructionSqlParams(
    instruction_type="document",
    agent_role_val="document",
)

# Execute SQL function
dev_instruction_result = cast(
    GetDeveloperInstructionSqlRow,
    await execute_sql_typed(
        conn,
        "app/sql/v4/developer_instructions/get_developer_instruction_complete.sql",
        params=dev_instruction_params,
    ),
)

# Use template
if dev_instruction_result and dev_instruction_result.template:
    from jinja2 import Template
    template = Template(dev_instruction_result.template)
    developer_message_content = template.render()  # Add context variables as needed
```

### Example: Document Regenerate

**File:** `server/app/socket/v4/agents/document/regenerate.py`

```python
# Get developer instruction template from database
developer_message_content: str | None = None
try:
    dev_instruction_params = GetDeveloperInstructionSqlParams(
        instruction_type="document",
        agent_role_val="document",
    )
    dev_instruction_result = cast(
        GetDeveloperInstructionSqlRow,
        await execute_sql_typed(
            conn,
            "app/sql/v4/developer_instructions/get_developer_instruction_complete.sql",
            params=dev_instruction_params,
        ),
    )
    if dev_instruction_result and dev_instruction_result.template:
        # Render Jinja template (no context variables needed for document)
        template = Template(dev_instruction_result.template)
        developer_message_content = template.render()
except Exception:
    # Fallback to hardcoded message if developer instruction not found
    developer_message_content = "Based on the document context..."
```

### Pattern: Using in Run Context Queries

Developer instructions are also retrieved in SQL CTEs for run context queries:

**File:** `server/app/sql/v4/documents/get_document_run_context_and_create_run_complete.sql`

```sql
-- Get developer instruction using agent role
developer_instruction_data AS (
    SELECT 
        ba.agent_id,
        di.template as developer_instruction_template,
        dis.schema_id as developer_instruction_schema_id
    FROM best_agent ba
    INNER JOIN agents a ON a.id = ba.agent_id
    -- Join developer_instructions via agent_role_developer_instruction_types
    -- Use agents.role to determine which developer instruction to use
    LEFT JOIN agent_role_developer_instruction_types ardit ON ardit.agent_role = a.role
    LEFT JOIN developer_instructions di ON di.type = ardit.developer_instruction_type AND di.active = true
    LEFT JOIN developer_instruction_schemas dis ON dis.developer_instruction_id = di.id
    LIMIT 1
),
```

## Schema Helper Utilities

**File:** `server/app/utils/schema_helper.py`

Provides utilities for working with the normalized schema system:

- `get_schema_with_fields()` - Get schema fields including nested arrays
- `get_schema_tree()` - Recursively build complete schema tree
- `get_template_schema()` - Get schema for a template
- `get_template_values()` - Reconstruct template values from normalized tables
- `create_template_with_values()` - Create template and populate value tables
- `link_template_to_schema()` - Link template to schema
- `create_schema_from_dict()` - Create schema from dict structure
- `validate_schema_data()` - Validate data against schema

## Migration History

### Migration 167: Create Schema System
**File:** `database/migrate/167_create_schema_system.sql`

Created the entire schema system including:
1. Enums (`developer_instruction_type`, `schema_field_type`)
2. Tables (`schemas`, `schema_fields`, `schema_field_items`, `developer_instructions`, `developer_instruction_schemas`, `agent_role_developer_instruction_types`)
3. Backfilled existing templates.args JSONB into new schema tables
4. Created empty schemas for all developer instruction types
5. Linked agent roles to developer instruction types

### Migration 169: Add Document Developer Instruction
**File:** `database/migrate/169_add_document_developer_instruction.sql`

Added the `document` type to the `developer_instruction_type` enum and created the corresponding developer instruction record.

## Architecture Principles

1. **BCNF Normalization** - Follows Chris Date principles, no nulls, eliminates redundancy
2. **One Instruction Per Type** - UNIQUE constraint on `type`, use `active` flag to enable/disable
3. **Role-Based Retrieval** - Instructions retrieved via agent role mapping
4. **Jinja2 Templates** - Templates support dynamic rendering with context variables
5. **Schema Validation** - Optional schema association for validation (currently unused)
6. **No JSONB** - Uses normalized tables instead of JSONB (per project standards)

## Files Using Developer Instructions

### WebSocket Events
- `server/app/socket/v4/agents/document/regenerate.py`
- `server/app/socket/v4/agents/document/generate.py`
- `server/app/socket/v4/agents/simulation/generate.py`
- `server/app/socket/v4/agents/simulation/regenerate.py`
- `server/app/socket/v4/agents/hint/generate.py`
- `server/app/socket/v4/agents/grade/generate.py`
- `server/app/socket/v4/agents/classify/generate.py`
- `server/app/socket/v4/agents/member/generate.py`
- `server/app/socket/v4/agents/member/regenerate.py`

### SQL Files
- `server/app/sql/v4/developer_instructions/get_developer_instruction_complete.sql`
- `server/app/sql/v4/documents/get_document_run_context_and_create_run_complete.sql`
- `server/app/sql/v4/generate/text/get_text_run_context_and_create_run_complete.sql`
- `server/app/sql/v4/simulations/generate_hints_complete.sql`

## Future Enhancements

1. **Populate Schemas** - Add actual schema fields for each developer instruction type
2. **Template Context Variables** - Use Jinja2 context variables for dynamic instruction rendering
3. **Schema Validation** - Use associated schemas to validate template context data
4. **API Endpoints** - Create CRUD endpoints for managing developer instructions (currently only read via SQL function)

