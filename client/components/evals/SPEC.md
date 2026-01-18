# Eval Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/evals/Eval.tsx`, `client/components/evals/Evals.tsx`
- **Resource SQL**: `server/app/sql/v4/resources/evals_complete.sql` (`api_create_evals_v4`)

## Resource-First Data Model
- **Artifact identity**: `eval` records are referenced by `eval_id` (or `eval_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (database_schema.md)
### Artifact + resource containers
- `eval_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `evals_resource`(created_at, updated_at, eval_id, active, generated, mcp, call_id, id, group_id)

### Junction + relationship tables
- `eval_agents`(<u>eval_id</u>, <u>agent_id</u>, created_at, updated_at, generated, mcp, active)
- `eval_analyses`(<u>eval_id</u>, <u>analyses_id</u>, created_at, updated_at, active, generated, mcp)
- `eval_attempts`(created_at, archived, <u>id</u>, eval_id, infinite_mode, generated, mcp, active, updated_at)
- `eval_departments`(active, created_at, updated_at, <u>department_id</u>, <u>eval_id</u>, generated, mcp)
- `eval_descriptions`(<u>eval_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `eval_feedbacks`(<u>eval_id</u>, <u>feedbacks_id</u>, created_at, updated_at, active, generated, mcp)
- `eval_flags`(<u>eval_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `eval_group_positions`(<u>eval_id</u>, <u>group_positions_id</u>, created_at, updated_at, active, generated, mcp)
- `eval_groups`(<u>eval_id</u>, <u>group_id</u>, created_at, updated_at, generated, mcp, active)
- `eval_groups_rubrics`(<u>eval_id</u>, <u>group_id</u>, <u>rubric_id</u>, created_at, updated_at, generated, mcp, active)
- `eval_names`(<u>eval_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `eval_run_positions`(<u>eval_id</u>, <u>run_positions_id</u>, created_at, updated_at, active, generated, mcp)
- `eval_runs`(completed, created_at, updated_at, <u>eval_id</u>, <u>run_id</u>, generated, mcp, active)
- `eval_runs_rubrics`(<u>eval_id</u>, <u>run_id</u>, <u>rubric_id</u>, created_at, updated_at, generated, mcp, active)
- `eval_times`(<u>eval_id</u>, <u>times_id</u>, created_at, updated_at, active, generated, mcp)

### Resource tables referenced by the UI
- `rubrics_resource`(created_at, updated_at, rubric_id, active, generated, mcp, call_id, <u>id</u>)

### Draft persistence
- `draft_evals`(<u>draft_id</u>, <u>evals_id</u>, version, created_at, updated_at, generated, mcp, active)

## UI Resource Mapping
- **Resources used**: Rubrics (via `eval_runs_rubrics` and `eval_groups_rubrics` junction tables)
- **IDs**: Use `rubric_id` for direct rubric links to eval runs and eval groups. All relationships remain keyed by `eval_id` and resource IDs returned from create/update endpoints.
- **Note**: Rubrics are linked directly to `eval_runs` and `eval_groups` via `eval_runs_rubrics` and `eval_groups_rubrics` tables. The old `rubric_grade_agents` pattern has been removed.

## Component Responsibilities
### Eval.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `eval` data and persist changes.
- Stores artifact fields in local form state and maps any linked resources by ID when applicable.
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Uses draft autosave to persist partial edits (draft ID stored in URL/search params).
- No generation modal is wired; resource edits are manual and saved through the form.

### Evals.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Eval.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).

## SQL Resource Creation (api_create_evals_v4)
- **Parameters**: `agent_id, group_id, eval_id, mcp`.
- **Behavior**:
  1. Validates tooling for the `eval` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `evals_resource` (or `eval_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `evals_id` in resource-only tables).

## Implementation Guidelines (resource-first)
- **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `eval` in junction tables.
- **Use explicit IDs**: Persist `eval_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Populate junction metadata**: Set `active`, `generated`, and `mcp` on each link row; for flags tables include `value` and any enum `type` fields.
- **Respect ordering columns**: If a junction table includes `position` or `idx`, preserve ordering when updating.
- **Honor draft workflow**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.
