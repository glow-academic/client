# Model Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/models/Model.tsx`, `client/components/models/Models.tsx`
- **Resource SQL**: `server/app/sql/v4/resources/models_complete.sql` (`api_create_models_v4`)

## Resource-First Data Model
- **Artifact identity**: `model` records are referenced by `model_id` (or `model_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (database_schema.md)
### Artifact + resource containers
- `model_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `models_resource`(created_at, updated_at, value, model_id, active, generated, mcp, call_id, <u>id</u>)

### Junction + relationship tables
- `model_departments`(active, created_at, updated_at, <u>department_id</u>, <u>model_id</u>, generated, mcp)
- `model_descriptions`(<u>model_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `model_endpoints`(<u>model_id</u>, <u>endpoint_id</u>, created_at, updated_at, generated, mcp, active)
- `model_flags`(<u>model_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `model_keys`(<u>model_id</u>, <u>key_id</u>, created_at, updated_at, generated, mcp, active)
- `model_modalities`(active, created_at, updated_at, <u>model_id</u>, generated, mcp, <u>modality_id</u>, <u>type</u>)
- `model_names`(<u>model_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `model_pricing`(active, created_at, updated_at, <u>model_id</u>, generated, mcp, <u>pricing_id</u>)
- `model_providers`(<u>model_id</u>, <u>providers_id</u>, created_at, updated_at, generated, mcp, active)
- `model_qualities`(active, created_at, updated_at, <u>model_id</u>, generated, mcp, <u>quality_id</u>)
- `model_reasoning_levels`(<u>model_id</u>, <u>reasoning_level_id</u>, created_at, updated_at, generated, mcp, active)
- `model_temperature_levels`(<u>model_id</u>, <u>temperature_level_id</u>, created_at, updated_at, generated, mcp, active)
- `model_values`(<u>model_id</u>, <u>value_id</u>, created_at, updated_at, generated, mcp, active)
- `model_voices`(<u>model_id</u>, <u>voice_id</u>, created_at, updated_at, generated, mcp, active)

### Resource tables referenced by the UI
- `names_resource`(<u>id</u>, name, created_at, updated_at, active, generated, call_id, mcp)
- `descriptions_resource`(<u>id</u>, description, created_at, updated_at, active, generated, call_id, mcp)
- `endpoints_resource`(<u>id</u>, base_url, active, created_at, updated_at, generated, call_id, mcp)
- `flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, call_id, mcp, type)
- `keys_resource`(<u>id</u>, key_id, created_at, updated_at, active, generated, mcp, call_id, key)
- `modalities_resource`(<u>id</u>, modality, created_at, updated_at, active, generated, mcp, call_id)
- `pricing_resource`(<u>id</u>, pricing_type, price, unit_id, created_at, updated_at, active, generated, mcp, call_id)
- `qualities_resource`(<u>id</u>, quality, created_at, updated_at, active, generated, mcp, call_id)
- `reasoning_levels_resource`(<u>id</u>, reasoning_level_id, reasoning_level, created_at, updated_at, active, generated, call_id, mcp)
- `temperature_levels_resource`(<u>id</u>, temperature_level_id, temperature, is_upper, created_at, updated_at, active, generated, call_id, mcp)
- `values_resource`(<u>id</u>, value, created_at, updated_at, active, generated, call_id, mcp)
- `voices_resource`(<u>id</u>, voice_id, voice, created_at, updated_at, active, generated, call_id, mcp)

### Draft persistence
- `draft_models`(<u>draft_id</u>, <u>models_id</u>, version, created_at, updated_at, generated, mcp, active)

## UI Resource Mapping
- **Resources used**: Names, Descriptions, Endpoints, Flags, Keys, Modalities, Pricing, Qualities, ReasoningLevels, TemperatureLevels, Values, Voices
- **IDs**: Use `<resource>_id` for single-select and `<resource>_ids` for multi-select resources (matching each resource component listed above).
- **Note**: `models_resource.modality` is a direct column (type: `modality_type`, default: 'text'). Keys are linked via `model_keys` junction table to `keys_resource`. API key flag can be set via `model_flags` with appropriate flag type.

## Component Responsibilities
### Model.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `model` data and persist changes.
- Stores selected resources in local form state as IDs (e.g., `name_id`, `description_id`, `flag_ids`).
- Delegates option rendering and selection to resource components, passing `<resource>_id` / `<resource>_ids` plus `<resource>_resource` payloads from the API.
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Uses draft autosave to persist partial edits (draft ID stored in URL/search params).
- No generation modal is wired; resource edits are manual and saved through the form.

### Models.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Model.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).

## SQL Resource Creation (api_create_models_v4)
- **Parameters**: `agent_id, group_id, model_id, mcp`.
- **Behavior**:
  1. Validates tooling for the `model` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `models_resource` (or `model_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `models_id` in resource-only tables).

## Implementation Guidelines (resource-first)
- **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `model` in junction tables.
- **Use explicit IDs**: Persist `model_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Populate junction metadata**: Set `active`, `generated`, and `mcp` on each link row; for flags tables include `value` and any enum `type` fields.
- **Respect ordering columns**: If a junction table includes `position` or `idx`, preserve ordering when updating.
- **Honor draft workflow**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.
