# Agent Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/agents/Agent.tsx`, `client/components/agents/Agents.tsx`
- **Resource SQL**: `server/app/sql/v4/resources/agents_complete.sql` (`api_create_agents_v4`)

## Resource-First Data Model
- **Artifact identity**: `agent` records are referenced by `agent_id` (or `agent_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (database_schema.md)
### Artifact + resource containers
- `agent_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `agents_resource`(created_at, updated_at, agent_id, active, generated, mcp, call_id, id)

### Junction + relationship tables
- `agent_departments`(active, created_at, updated_at, <u>agent_id</u>, <u>department_id</u>, generated, mcp)
- `agent_descriptions`(<u>agent_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `agent_flags`(<u>agent_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `agent_instructions`(<u>agent_id</u>, <u>instruction_id</u>, created_at, updated_at, generated, mcp, active)
- `agent_models`(<u>agent_id</u>, <u>model_id</u>, created_at, updated_at, generated, mcp, active)
- `agent_names`(<u>agent_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `agent_prompts`(active, created_at, updated_at, <u>agent_id</u>, <u>prompt_id</u>, generated, mcp)
- `agent_reasoning_levels`(active, created_at, updated_at, <u>agent_id</u>, <u>reasoning_level_id</u>, generated, mcp)
- `agent_temperature_levels`(active, created_at, updated_at, <u>agent_id</u>, <u>temperature_level_id</u>, generated, mcp)
- `agent_tools`(<u>agent_id</u>, <u>tool_id</u>, active, created_at, updated_at, generated, mcp)
- `agent_voices`(active, created_at, updated_at, <u>agent_id</u>, <u>voice_id</u>, generated, mcp)

### Resource tables referenced by the UI
- `names_resource`(<u>id</u>, name, created_at, updated_at, active, generated, call_id, mcp)
- `descriptions_resource`(<u>id</u>, description, created_at, updated_at, active, generated, call_id, mcp)
- `departments_resource`(created_at, updated_at, department_id, active, generated, mcp, call_id, <u>id</u>, group_id)
- `flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, call_id, mcp, type)
- `instructions_resource`(<u>id</u>, template, active, created_at, updated_at, generated, call_id, mcp)
- `prompts_resource`(created_at, updated_at, system_prompt, name, description, active, <u>id</u>, generated, call_id, mcp)
- `models_resource`(created_at, updated_at, value, model_id, active, generated, mcp, call_id, <u>id</u>, modality)
- `modalities_resource`(<u>id</u>, modality, created_at, updated_at, active, generated, mcp, call_id)
- `tools_resource` (not listed in schema extract)
- `reasoning_levels_resource`(<u>id</u>, reasoning_level_id, reasoning_level, created_at, updated_at, active, generated, call_id, mcp)
- `temperature_levels_resource`(<u>id</u>, temperature_level_id, temperature, is_upper, created_at, updated_at, active, generated, call_id, mcp)
- `voices_resource`(<u>id</u>, voice_id, voice, created_at, updated_at, active, generated, call_id, mcp)

### Draft persistence
- `draft_agents`(<u>draft_id</u>, <u>agents_id</u>, version, created_at, updated_at, generated, mcp, active)

## UI Resource Mapping
- **Resources used**: Names, Descriptions, Departments, Flags, Instructions, Prompts, Models, Modalities, Tools, ReasoningLevels, TemperatureLevels, Voices
- **IDs**: Use `<resource>_id` for single-select and `<resource>_ids` for multi-select resources (matching each resource component listed above).
- **Note**: `models_resource.modality` is a direct column (type: `modality_type`, default: 'text'), not a junction table. The `model_modalities` junction table exists for multi-modality support via `modalities_resource`.

## Component Responsibilities
### Agent.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `agent` data and persist changes.
- Stores selected resources in local form state as IDs (e.g., `name_id`, `description_id`, `flag_ids`).
- Delegates option rendering and selection to resource components, passing `<resource>_id` / `<resource>_ids` plus `<resource>_resource` payloads from the API.
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Uses draft autosave to persist partial edits (draft ID stored in URL/search params).
- Supports generate/regenerate flows via `GenerateRegenerateModal`, emitting resource-type generation events and updating resource IDs on completion.

### Agents.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Agent.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).

## SQL Resource Creation (api_create_agents_v4)
- **Parameters**: `agent_id, group_id, artifact_agent_id, mcp`.
- **Behavior**:
  1. Validates tooling for the `agent` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `agents_resource` (or `agent_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `agents_id` in resource-only tables).

## Implementation Guidelines (resource-first)
- **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `agent` in junction tables.
- **Use explicit IDs**: Persist `agent_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Populate junction metadata**: Set `active`, `generated`, and `mcp` on each link row; for flags tables include `value` and any enum `type` fields.
- **Respect ordering columns**: If a junction table includes `position` or `idx`, preserve ordering when updating.
- **Honor draft workflow**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.
