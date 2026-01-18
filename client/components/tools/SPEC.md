# Tool Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/tools/Tool.tsx`, `client/components/tools/Tools.tsx`
- **Resource SQL**: `server/app/sql/v4/resources/tools_complete.sql` (`api_create_tools_v4`)

## Resource-First Data Model
- **Artifact identity**: `tool` records are referenced by `tool_id` (or `tool_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (schema.sql)
### Artifact + resource containers
- `tool_artifact`(<u>id</u>, created_at, updated_at, group_id, generated, mcp)

### Junction + relationship tables
- `tool_args`(<u>tool_id</u>, <u>args_id</u>, created_at, updated_at, generated, mcp)
- `tool_args_outputs`(<u>tool_id</u>, <u>args_outputs_id</u>, created_at, updated_at, generated, mcp)
- `tool_descriptions`(<u>tool_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `tool_domains`(<u>tool_id</u>, <u>domain_id</u>, active, created_at, updated_at, generated, mcp)
- `tool_flags`(<u>tool_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `tool_names`(<u>tool_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)

### Resource tables referenced by the UI
- `args_resource`(<u>id</u>, name, description, field_type, required, default_value, created_at, updated_at, active, generated, call_id, mcp, type)
- `args_outputs_resource`(<u>id</u>, args_id, name, template, created_at, updated_at, active, generated, call_id, mcp)

### Draft persistence
- (no artifact draft table listed for this UI flow)

## SQL/API Coverage Gaps
- `api_create_tools_v4` returns only the new resource `id`; it does not return metadata columns from `args_resource` (created_at, updated_at, active, generated, mcp, call_id, group_id when present). If the UI needs those without a follow-up fetch, extend the SQL response or add a read endpoint.

## UI Resource Mapping
- **Resources used**: Args, ArgsOutputs
- **IDs**: Use `<resource>_id` for single-select and `<resource>_ids` for multi-select resources (matching each resource component listed above).

## Component Responsibilities
### Tool.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `tool` data and persist changes.
- Stores selected resources in local form state as IDs (e.g., `name_id`, `description_id`, `flag_ids`).
- Delegates option rendering and selection to resource components, passing `<resource>_id` / `<resource>_ids` plus `<resource>_resource` payloads from the API.
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Draft autosave is not used; updates are committed via explicit save actions.
- No generation modal is wired; resource edits are manual and saved through the form.

### Tools.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Tool.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).

## SQL Resource Creation (api_create_tools_v4)
- **Parameters**: `agent_id, group_id, mcp + resource-specific fields`.
- **Behavior**:
  1. Validates tooling for the `tool` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `tools_resource` (or `tool_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `tools_id` in resource-only tables).

## Implementation Guidelines (resource-first)
- **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `tool` in junction tables.
- **Use explicit IDs**: Persist `tool_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Populate junction metadata**: Set `active`, `generated`, and `mcp` on each link row; for flags tables include `value` and any enum `type` fields.
- **Respect ordering columns**: If a junction table includes `position` or `idx`, preserve ordering when updating.
- **Honor draft workflow**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.
