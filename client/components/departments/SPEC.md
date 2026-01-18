# Department Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/departments/Department.tsx`, `client/components/departments/Departments.tsx`
- **Resource SQL**: `server/app/sql/v4/resources/departments_complete.sql` (`api_create_departments_v4`)

## Resource-First Data Model
- **Artifact identity**: `department` records are referenced by `department_id` (or `department_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (database_schema.md)
### Artifact + resource containers
- `department_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `departments_resource`(created_at, updated_at, department_id, active, generated, mcp, call_id, <u>id</u>, group_id)

### Junction + relationship tables
- `department_descriptions`(<u>department_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `department_flags`(<u>department_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `department_names`(<u>department_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `department_settings`(active, created_at, updated_at, <u>department_id</u>, <u>settings_id</u>, generated, mcp)

### Resource tables referenced by the UI
- `names_resource`(<u>id</u>, name, created_at, updated_at, active, generated, call_id, mcp)
- `descriptions_resource`(<u>id</u>, description, created_at, updated_at, active, generated, call_id, mcp)
- `flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, call_id, mcp, type)
- `settings_resource`(created_at, setting_id, updated_at, active, generated, mcp, call_id, id, group_id)

### Draft persistence
- `draft_departments`(<u>draft_id</u>, <u>departments_id</u>, version, created_at, updated_at, generated, mcp, active)

## UI Resource Mapping
- **Resources used**: Names, Descriptions, Flags, Settings
- **IDs**: Use `<resource>_id` for single-select and `<resource>_ids` for multi-select resources (matching each resource component listed above).

## Component Responsibilities
### Department.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `department` data and persist changes.
- Stores selected resources in local form state as IDs (e.g., `name_id`, `description_id`, `flag_ids`).
- Delegates option rendering and selection to resource components, passing `<resource>_id` / `<resource>_ids` plus `<resource>_resource` payloads from the API.
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Uses draft autosave to persist partial edits (draft ID stored in URL/search params).
- No generation modal is wired; resource edits are manual and saved through the form.

### Departments.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Department.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).

## SQL Resource Creation (api_create_departments_v4)
- **Parameters**: `agent_id, group_id, department_id, mcp`.
- **Behavior**:
  1. Validates tooling for the `department` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `departments_resource` (or `department_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `departments_id` in resource-only tables).

## Implementation Guidelines (resource-first)
- **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `department` in junction tables.
- **Use explicit IDs**: Persist `department_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Populate junction metadata**: Set `active`, `generated`, and `mcp` on each link row; for flags tables include `value` and any enum `type` fields.
- **Respect ordering columns**: If a junction table includes `position` or `idx`, preserve ordering when updating.
- **Honor draft workflow**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.
