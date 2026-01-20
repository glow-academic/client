# Setting Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/settings/Setting.tsx`, `client/components/settings/NewSetting.tsx`, `client/components/settings/Settings.tsx`
- **Resource SQL**: `server/app/sql/v4/resources/settings_complete.sql` (`api_create_settings_v4`)

## Resource-First Data Model
- **Artifact identity**: `setting` records are referenced by `setting_id` (or `setting_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (schema.sql)
### Artifact + resource containers
- `setting_artifact`(created_at, <u>id</u>, updated_at, generated, mcp, group_id)
- `settings_resource`(created_at, setting_id, updated_at, active, generated, mcp, call_id, id, group_id)

### Junction + relationship tables
- `setting_auth_keys`(active, created_at, updated_at, <u>auth_id</u>, <u>auth_item_id</u>, <u>key_id</u>, <u>settings_id</u>, generated, mcp)
- `setting_auth_values`(value, created_at, updated_at, <u>auth_id</u>, <u>auth_item_id</u>, <u>settings_id</u>, generated, mcp, active)
- `setting_auths`(active, created_at, updated_at, <u>auth_id</u>, <u>settings_id</u>, generated, mcp)
- `setting_colors`(<u>setting_id</u>, <u>color_id</u>, <u>type</u>, created_at, updated_at, generated, mcp, active)
- `setting_departments`(<u>setting_id</u>, <u>department_id</u>, active, created_at, updated_at, generated, mcp)
- `setting_descriptions`(<u>setting_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `setting_flags`(<u>setting_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `setting_names`(<u>setting_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `setting_provider_keys`(active, created_at, updated_at, <u>key_id</u>, <u>settings_id</u>, <u>providers_id</u>, generated, mcp)
- `setting_providers`(active, created_at, updated_at, <u>settings_id</u>, <u>providers_id</u>, generated, mcp)
- `setting_thresholds`(<u>setting_id</u>, <u>threshold_id</u>, <u>type</u>, created_at, updated_at, generated, mcp, active)

### Resource tables referenced by the UI
- `auths_resource`(created_at, updated_at, auth_id, active, generated, mcp, call_id, <u>id</u>, group_id)
- `colors_resource`(<u>id</u>, name, description, hex_code, created_at, updated_at, active, generated, call_id, mcp)
- `departments_resource`(created_at, updated_at, department_id, active, generated, mcp, call_id, <u>id</u>, group_id)
- `descriptions_resource`(<u>id</u>, description, created_at, updated_at, active, generated, call_id, mcp)
- `flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, call_id, mcp, type)
- `keys_resource`(<u>id</u>, key_id, created_at, updated_at, active, generated, mcp, call_id, key)
- `names_resource`(<u>id</u>, name, created_at, updated_at, active, generated, call_id, mcp)
- `providers_resource`(<u>id</u>, provider_id, created_at, updated_at, active, generated, mcp, call_id, group_id)

### Draft persistence
- `draft_settings`(<u>draft_id</u>, <u>settings_id</u>, version, created_at, updated_at, generated, mcp, active)

## SQL/API Coverage Gaps
- `api_create_settings_v4` returns only the new resource `id`; it does not return metadata columns from `settings_resource` (created_at, updated_at, active, generated, mcp, call_id, group_id when present). If the UI needs those without a follow-up fetch, extend the SQL response or add a read endpoint.

## UI Resource Mapping
- **Resources used**: Auths, Colors, Departments, Descriptions, Flags, Keys, Names, Providers
- **IDs**: Use `<resource>_id` for single-select and `<resource>_ids` for multi-select resources (matching each resource component listed above).

## Component Responsibilities
### Setting.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `setting` data and persist changes.
- Stores selected resources in local form state as IDs (e.g., `name_id`, `description_id`, `flag_ids`).
- Delegates option rendering and selection to resource components, passing `<resource>_id` / `<resource>_ids` plus `<resource>_resource` payloads from the API.
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Uses draft autosave to persist partial edits (draft ID stored in URL/search params).
- Supports generate/regenerate flows via `GenerateRegenerateModal`, emitting resource-type generation events and updating resource IDs on completion.

### Settings.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Setting.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).

## SQL Resource Creation (api_create_settings_v4)
- **Parameters**: `agent_id, group_id, setting_id, mcp`.
- **Behavior**:
  1. Validates tooling for the `setting` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `settings_resource` (or `setting_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `settings_id` in resource-only tables).

## Implementation Guidelines (resource-first)
- **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `setting` in junction tables.
- **Use explicit IDs**: Persist `setting_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Populate junction metadata**: Set `active`, `generated`, and `mcp` on each link row; for flags tables include `value` and any enum `type` fields.
- **Respect ordering columns**: If a junction table includes `position` or `idx`, preserve ordering when updating.
- **Honor draft workflow**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.
