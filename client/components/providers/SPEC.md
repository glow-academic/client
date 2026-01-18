# Provider Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/providers/Provider.tsx`, `client/components/providers/Providers.tsx`
- **Resource SQL**: `server/app/sql/v4/resources/providers_complete.sql` (`api_create_providers_v4`)

## Resource-First Data Model
- **Artifact identity**: `provider` records are referenced by `provider_id` (or `provider_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (database_schema.md)
### Artifact + resource containers
- `provider_artifact`(<u>id</u>, created_at, updated_at, generated, mcp, group_id)
- `providers_resource`(<u>id</u>, provider_id, created_at, updated_at, active, generated, mcp, call_id, group_id)

### Junction + relationship tables
- `provider_descriptions`(<u>provider_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `provider_flags`(<u>provider_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `provider_names`(<u>provider_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `provider_values`(<u>provider_id</u>, <u>values_id</u>, created_at, updated_at, active, generated, mcp)

### Resource tables referenced by the UI
- `names_resource`(<u>id</u>, name, created_at, updated_at, active, generated, call_id, mcp)
- `descriptions_resource`(<u>id</u>, description, created_at, updated_at, active, generated, call_id, mcp)
- `flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, call_id, mcp, type)

### Draft persistence
- `draft_providers`(<u>draft_id</u>, <u>providers_id</u>, <u>version</u>, created_at, updated_at, generated, mcp, active)

## UI Resource Mapping
- **Resources used**: Names, Descriptions, Flags
- **IDs**: Use `<resource>_id` for single-select and `<resource>_ids` for multi-select resources (matching each resource component listed above).

## Component Responsibilities
### Provider.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `provider` data and persist changes.
- Stores selected resources in local form state as IDs (e.g., `name_id`, `description_id`, `flag_ids`).
- Delegates option rendering and selection to resource components, passing `<resource>_id` / `<resource>_ids` plus `<resource>_resource` payloads from the API.
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Uses draft autosave to persist partial edits (draft ID stored in URL/search params).
- No generation modal is wired; resource edits are manual and saved through the form.

### Providers.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Provider.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).

## SQL Resource Creation (api_create_providers_v4)
- **Parameters**: `agent_id, group_id, mcp + resource-specific fields`.
- **Behavior**:
  1. Validates tooling for the `provider` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `providers_resource` (or `provider_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `providers_id` in resource-only tables).

## Implementation Guidelines (resource-first)
- **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `provider` in junction tables.
- **Use explicit IDs**: Persist `provider_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Populate junction metadata**: Set `active`, `generated`, and `mcp` on each link row; for flags tables include `value` and any enum `type` fields.
- **Respect ordering columns**: If a junction table includes `position` or `idx`, preserve ordering when updating.
- **Honor draft workflow**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.
