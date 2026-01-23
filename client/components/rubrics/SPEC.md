# Rubric Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/rubrics/Rubric.tsx`, `client/components/rubrics/Rubrics.tsx`
- **Resource SQL**: `server/app/sql/v4/queries/resources/rubrics_complete.sql` (`api_create_rubrics_v4`)

## Resource-First Data Model
- **Artifact identity**: `rubric` records are referenced by `rubric_id` (or `rubric_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (schema.sql)
### Artifact + resource containers
- `rubric_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `rubrics_resource`(created_at, updated_at, rubric_id, active, generated, mcp, call_id, <u>id</u>)

### Junction + relationship tables
- `rubric_artifacts`(<u>rubric_id</u>, <u>artifact</u>, created_at, updated_at, generated, mcp, active)
- `rubric_departments`(active, created_at, updated_at, <u>department_id</u>, <u>rubric_id</u>, generated, mcp)
- `rubric_descriptions`(<u>rubric_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `rubric_flags`(<u>rubric_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `rubric_names`(<u>rubric_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `rubric_points`(<u>rubric_id</u>, <u>point_id</u>, <u>type</u>, created_at, updated_at, generated, mcp, active)
- `rubric_standard_groups`(<u>rubric_id</u>, <u>standard_group_id</u>, active, created_at, updated_at, generated, mcp)

### Resource tables referenced by the UI
- (none used directly in UI)

### Draft persistence
- `draft_rubrics`(<u>draft_id</u>, <u>rubrics_id</u>, version, created_at, updated_at, generated, mcp, active)

## SQL/API Coverage Gaps
- `api_create_rubrics_v4` returns only the new resource `id`; it does not return metadata columns from `rubrics_resource` (created_at, updated_at, active, generated, mcp, call_id, group_id when present). If the UI needs those without a follow-up fetch, extend the SQL response or add a read endpoint.

## UI Resource Mapping
- **Resources used**: None (artifact-specific fields only).
- **IDs**: All relationships remain keyed by `rubric_id` and resource IDs returned from create/update endpoints.
- **Note**: `rubric_artifact.group_id` provides the group relationship (redundant `rubric_groups` table removed). `rubric_grade_agents` and `rubric_grade_agents_audio` tables have been removed - rubrics are now linked directly to evals and simulations via `eval_runs_rubrics`, `eval_groups_rubrics`, `simulation_rubrics`, and `scenario_rubrics` tables.

## Component Responsibilities
### Rubric.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `rubric` data and persist changes.
- Stores artifact fields in local form state and maps any linked resources by ID when applicable.
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Uses draft autosave to persist partial edits (draft ID stored in URL/search params).
- No generation modal is wired; resource edits are manual and saved through the form.

### Rubrics.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Rubric.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).

## SQL Resource Creation (api_create_rubrics_v4)
- **Parameters**: `agent_id, group_id, rubric_id, mcp`.
- **Behavior**:
  1. Validates tooling for the `rubric` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `rubrics_resource` (or `rubric_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `rubrics_id` in resource-only tables).

## Implementation Guidelines (resource-first)
- **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `rubric` in junction tables.
- **Use explicit IDs**: Persist `rubric_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Populate junction metadata**: Set `active`, `generated`, and `mcp` on each link row; for flags tables include `value` and any enum `type` fields.
- **Respect ordering columns**: If a junction table includes `position` or `idx`, preserve ordering when updating.
- **Honor draft workflow**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.
