# Artifacts and Resources Guidelines

## Artifact Tables

**Pattern**: `{artifact}_artifact` (e.g., `scenario_artifact`, `persona_artifact`)

**Required Columns** (exactly 6 columns):
- `id` (uuid, PRIMARY KEY)
- `created_at` (timestamptz, NOT NULL)
- `updated_at` (timestamptz, NOT NULL)
- `generated` (boolean, NOT NULL, DEFAULT false) - Indicates if AI generated this artifact (rather than a human). Automatically true when `mcp` is true, or could be true if created via tool call.
- `mcp` (boolean, NOT NULL, DEFAULT false) - Indicates if the latest upsert (update or create) was made by MCP.
- `group_id` (uuid, NOT NULL)

**No other columns allowed** - Artifact tables are minimal containers for strong entities.

## Resource Tables

**Pattern**: `{resource}_resource` (e.g., `names_resource`, `descriptions_resource`)

**Required Columns**:
- All necessary columns for the resource type (e.g., `name` for names_resource, `description` for descriptions_resource)
- `id` (uuid, PRIMARY KEY)
- `created_at` (timestamptz, NOT NULL)
- `updated_at` (timestamptz, NOT NULL) - if applicable
- `active` (boolean, NOT NULL, DEFAULT true) - if applicable
- `generated` (boolean, NOT NULL, DEFAULT false) - **REQUIRED** - Indicates if AI generated this resource (rather than a human). Automatically true when `mcp` is true, or could be true if created via tool call.
- `mcp` (boolean, NOT NULL, DEFAULT false) - **REQUIRED** - Indicates if the latest upsert was made by MCP (for resource-only creation).
- `call_id` (uuid, NOT NULL) - **REQUIRED, NON-NULLABLE** - References the call that created/updated this resource.

**Note**: Resource tables may have additional columns specific to their type (e.g., `name_id`, `department_id` for self-referencing resources).

## Junction Tables

**Pattern**: `{artifact}_{resource}` (e.g., `scenario_names`, `persona_departments`)

**Required Columns**:
- `{artifact}_id` (uuid, NOT NULL) - Foreign key to `{artifact}_artifact(id)`
- `{resource}_id` (uuid, NOT NULL) - Foreign key to `{resource}_resource(id)`
- `active` (boolean, NOT NULL, DEFAULT true)
- `created_at` (timestamptz, NOT NULL)
- `updated_at` (timestamptz, NOT NULL)
- `generated` (boolean, NOT NULL, DEFAULT false) - **REQUIRED** - Indicates if AI generated this relationship (rather than a human). Automatically true when `mcp` is true, or could be true if created via tool call.
- `mcp` (boolean, NOT NULL, DEFAULT false) - **REQUIRED** - Indicates if the latest upsert (update or create) was made by MCP.

**Note**: Junction tables do NOT have `call_id` - only resource tables have `call_id`.

**Optional Columns**:
- `type` (enum) - Only for flags tables (e.g., `type_scenario_flags`, `type_persona_flags`)
- `value` (boolean) - Only for flags tables
- Additional columns specific to the relationship (e.g., `position`, `idx`)

**Note**: Flags junction tables (`*_flags`) must have `type` enum column and `value` boolean column.

## Artifact-Resource Relationships

All artifact-resource relationships are defined in the `artifact_resources` table:
- `artifact` (artifacts enum, NOT NULL)
- `resource` (resources enum, NOT NULL)
- `created_at` (timestamptz, NOT NULL)
- `updated_at` (timestamptz, NOT NULL)

Every artifact-resource pair in `artifact_resources` must have a corresponding junction table following the `{artifact}_{resource}` pattern.

## Compliance Checklist

### Artifact Tables
- [ ] Has exactly 6 columns: id, created_at, updated_at, generated, mcp, group_id
- [ ] No additional columns

### Resource Tables
- [ ] Has `generated` boolean column (NOT NULL)
- [ ] Has `mcp` boolean column (NOT NULL)
- [ ] Has `call_id` uuid column (NOT NULL)
- [ ] Has all necessary columns for the resource type

### Junction Tables
- [ ] Has `{artifact}_id` column referencing artifact table
- [ ] Has `{resource}_id` column referencing resource table
- [ ] Has `active` boolean column
- [ ] Has `created_at` timestamptz column
- [ ] Has `updated_at` timestamptz column
- [ ] Has `generated` boolean column
- [ ] Has `mcp` boolean column
- [ ] Does NOT have `call_id` column (only resource tables have call_id)
- [ ] Flags tables have `type` enum column
- [ ] Flags tables have `value` boolean column
