# Profile Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/staff/Profile.tsx`, `client/components/staff/Profiles.tsx`
- **Resource SQL**: `server/app/sql/v4/queries/resources/profiles_complete.sql` (`api_create_profiles_v4`)

## Resource-First Data Model
- **Artifact identity**: `profile` records are referenced by `profile_id` (or `profile_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (schema.sql)
### Artifact + resource containers
- `profile_artifact`(updated_at, created_at, <u>id</u>, generated, mcp, group_id)
- `profiles_resource`(updated_at, last_login, created_at, role, profile_id, active, generated, mcp, call_id, id)

### Junction + relationship tables
- `profile_cohorts`(<u>profile_id</u>, <u>cohort_id</u>, active, created_at, updated_at, generated, mcp)
- `profile_departments`(is_primary, created_at, active, updated_at, <u>department_id</u>, <u>profile_id</u>, generated, mcp)
- `profile_emails`(email, is_primary, active, created_at, updated_at, <u>profile_id</u>, <u>email_id</u>, generated, mcp)
- `profile_flags`(<u>profile_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `profile_names`(<u>profile_id</u>, <u>name_id</u>, <u>type</u>, created_at, updated_at, generated, mcp, active)
- `profile_request_limits`(requests_per_day, active, created_at, updated_at, profile_id, request_limit_id, generated, mcp)
- `profile_roles`(<u>profile_id</u>, <u>role_id</u>, created_at, updated_at, generated, mcp, active)

### Resource tables referenced by the UI
- `names_resource`(<u>id</u>, name, created_at, updated_at, active, generated, call_id, mcp)
- `departments_resource`(created_at, updated_at, department_id, active, generated, mcp, call_id, <u>id</u>, group_id)
- `emails_resource`(<u>id</u>, email, created_at, updated_at, active, generated, call_id, mcp)
- `flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, call_id, mcp, type)
- `request_limits_resource`(<u>id</u>, requests_per_day, created_at, updated_at, active, generated, call_id, mcp)

### Draft persistence
- `draft_profiles`(<u>draft_id</u>, <u>profiles_id</u>, version, created_at, updated_at, generated, mcp, active)

## SQL/API Coverage Gaps
- `api_create_profiles_v4` returns only the new resource `id`; it does not return metadata columns from `profiles_resource` (created_at, updated_at, active, generated, mcp, call_id, group_id when present). If the UI needs those without a follow-up fetch, extend the SQL response or add a read endpoint.

## UI Resource Mapping
- **Resources used**: Names, Departments, Emails, Flags, RequestLimits, Cohorts
- **IDs**: Use `<resource>_id` for single-select and `<resource>_ids` for multi-select resources (matching each resource component listed above).
- **Note**: `profile_logins` and `profile_activity` are separate entities (not profile resources) - they exist as junction tables but are not part of the profile resource model. Profiles own cohorts via `profile_cohorts` junction table (not `cohort_profiles`).

## Component Responsibilities
### Profile.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `profile` data and persist changes.
- Stores selected resources in local form state as IDs (e.g., `name_id`, `description_id`, `flag_ids`).
- Delegates option rendering and selection to resource components, passing `<resource>_id` / `<resource>_ids` plus `<resource>_resource` payloads from the API.
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Uses draft autosave to persist partial edits (draft ID stored in URL/search params).
- Supports generate/regenerate flows via `GenerateRegenerateModal`, emitting resource-type generation events and updating resource IDs on completion.

### Profiles.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Profile.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).

## SQL Resource Creation (api_create_profiles_v4)
- **Parameters**: `agent_id, group_id, profile_id, mcp`.
- **Behavior**:
  1. Validates tooling for the `profile` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `profiles_resource` (or `profile_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `profiles_id` in resource-only tables).

## Implementation Guidelines (resource-first)
- **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `profile` in junction tables.
- **Use explicit IDs**: Persist `profile_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Populate junction metadata**: Set `active`, `generated`, and `mcp` on each link row; for flags tables include `value` and any enum `type` fields.
- **Respect ordering columns**: If a junction table includes `position` or `idx`, preserve ordering when updating.
- **Honor draft workflow**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.
