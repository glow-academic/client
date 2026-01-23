# Parameter Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/parameters/Parameter.tsx`, `client/components/parameters/Parameters.tsx`
- **Resource SQL**: `server/app/sql/v4/queries/resources/parameters_complete.sql` (`api_create_parameters_v4`)

## Resource-First Data Model
- **Artifact identity**: `parameter` records are referenced by `parameter_id` (or `parameter_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (schema.sql)
### Artifact + resource containers
- `parameter_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `parameters_resource`(created_at, updated_at, parameter_id, active, generated, mcp, call_id, <u>id</u>)

### Junction + relationship tables
- `parameter_departments`(active, created_at, updated_at, <u>department_id</u>, <u>parameter_id</u>, generated, mcp)
- `parameter_descriptions`(<u>parameter_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `parameter_fields`(<u>parameter_id</u>, <u>field_id</u>, created_at, updated_at, generated, mcp, active)
- `parameter_flags`(<u>parameter_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `parameter_names`(<u>parameter_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)

### Resource tables referenced by the UI
- `names_resource`(<u>id</u>, name, created_at, updated_at, active, generated, call_id, mcp)
- `descriptions_resource`(<u>id</u>, description, created_at, updated_at, active, generated, call_id, mcp)
- `departments_resource`(created_at, updated_at, department_id, active, generated, mcp, call_id, <u>id</u>, group_id)
- `flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, call_id, mcp, type)

### Draft persistence
- `draft_parameters`(<u>draft_id</u>, <u>parameters_id</u>, version, created_at, updated_at, generated, mcp, active)

## SQL/API Coverage Gaps
- `api_create_parameters_v4` returns only the new resource `id`; it does not return metadata columns from `parameters_resource` (created_at, updated_at, active, generated, mcp, call_id, group_id when present). If the UI needs those without a follow-up fetch, extend the SQL response or add a read endpoint.

## UI Resource Mapping
- **Resources used**: Names, Descriptions, Departments, Flags, Fields
- **IDs**: Use `<resource>_id` for single-select and `<resource>_ids` for multi-select resources (matching each resource component listed above).
- **Boolean flags**: Parameters use boolean flags stored in `parameter_flags` table: `persona_parameter`, `document_parameter`, `scenario_parameter`, `simulation_parameter`, `video_parameter`. These are NOT junction tables - they are simple boolean flags indicating parameter type.

## Component Responsibilities
### Parameter.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `parameter` data and persist changes.
- Stores selected resources in local form state as IDs (e.g., `name_id`, `description_id`, `department_ids`, `field_ids`).
- Stores boolean flags for parameter types: `persona_parameter`, `document_parameter`, `scenario_parameter`, `simulation_parameter`, `video_parameter`.
- Delegates option rendering and selection to resource components, passing `<resource>_id` / `<resource>_ids` plus `<resource>_resource` payloads from the API.
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Uses draft autosave to persist partial edits (draft ID stored in URL/search params).
- No generation modal is wired; resource edits are manual and saved through the form.

### Parameters.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Parameter.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).

## SQL Resource Creation (api_create_parameters_v4)
- **Parameters**: `agent_id, group_id, parameter_id, mcp`.
- **Behavior**:
  1. Validates tooling for the `parameter` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `parameters_resource` (or `parameter_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `parameters_id` in resource-only tables).

## Implementation Guidelines (resource-first)
- **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `parameter` in junction tables.
- **Use explicit IDs**: Persist `parameter_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Populate junction metadata**: Set `active`, `generated`, and `mcp` on each link row; for flags tables include `value` and any enum `type` fields.
- **Respect ordering columns**: If a junction table includes `position` or `idx`, preserve ordering when updating.
- **Honor draft workflow**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.
