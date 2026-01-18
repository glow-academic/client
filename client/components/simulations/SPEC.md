# Simulation Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/simulations/Simulation.tsx`, `client/components/simulations/Simulations.tsx`
- **Resource SQL**: `server/app/sql/v4/resources/simulations_complete.sql` (`api_create_simulations_v4`)

## Resource-First Data Model
- **Artifact identity**: `simulation` records are referenced by `simulation_id` (or `simulation_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (database_schema.md)
### Artifact + resource containers
- `simulation_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `simulations_resource`(created_at, updated_at, simulation_id, active, generated, mcp, call_id, id)

### Junction + relationship tables
- `simulation_analyses`(<u>simulation_id</u>, <u>analysis_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_attempts`(created_at, infinite_mode, archived, <u>id</u>, simulation_id, generated, mcp, active, updated_at)
- `simulation_departments`(active, created_at, updated_at, <u>department_id</u>, <u>simulation_id</u>, generated, mcp)
- `simulation_descriptions`(<u>simulation_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `simulation_eval_rubric_grade_agents`(<u>simulation_id</u>, <u>eval_rubric_grade_agents_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_feedbacks`(<u>simulation_id</u>, <u>feedback_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_flags`(<u>simulation_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `simulation_improvements`(<u>simulation_id</u>, <u>improvement_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_names`(<u>simulation_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `simulation_scenario_flags`(<u>simulation_id</u>, <u>scenario_id</u>, <u>scenario_flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `simulation_scenario_positions`(<u>simulation_id</u>, <u>scenario_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_scenario_rubric_grade_agents`(<u>simulation_id</u>, <u>scenario_rubric_grade_agent_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_scenarios`(created_at, updated_at, <u>scenario_id</u>, <u>simulation_id</u>, generated, mcp, active)
- `simulation_scenarios_scenario_rubric_grade_agents`(<u>simulation_id</u>, <u>scenario_id</u>, <u>scenario_rubric_grade_agent_id</u>, created_at, updated_at, generated, mcp, active)
- `simulation_simulation_scenario_flags`(<u>simulation_id</u>, <u>simulation_scenario_flag_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_strengths`(<u>simulation_id</u>, <u>strength_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_times`(<u>simulation_id</u>, <u>time_id</u>, created_at, updated_at, active, generated, mcp)

### Resource tables referenced by the UI
- `names_resource`(<u>id</u>, name, created_at, updated_at, active, generated, call_id, mcp)
- `descriptions_resource`(<u>id</u>, description, created_at, updated_at, active, generated, call_id, mcp)
- `departments_resource`(created_at, updated_at, department_id, active, generated, mcp, call_id, <u>id</u>, group_id)
- `flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, call_id, mcp, type)
- `scenario_flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, mcp, call_id)
- `scenario_positions_resource`(<u>simulation_id</u>, <u>scenario_id</u>, value, created_at, updated_at, generated, mcp, call_id)
- `scenario_rubric_grade_agents_resource`(<u>id</u>, rubric_id, grade_agent_id, agent_id, created_at, updated_at, active, generated, call_id, mcp)
- `scenarios_resource`(created_at, updated_at, scenario_id, active, generated, mcp, call_id, id)

### Draft persistence
- `draft_simulations`(<u>draft_id</u>, <u>simulations_id</u>, version, created_at, updated_at, generated, mcp, active)

## UI Resource Mapping
- **Resources used**: Names, Descriptions, Departments, Flags, ScenarioFlags, ScenarioPositions, ScenarioRubricGradeAgents, Scenarios
- **IDs**: Use `<resource>_id` for single-select and `<resource>_ids` for multi-select resources (matching each resource component listed above).

## Component Responsibilities
### Simulation.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `simulation` data and persist changes.
- Stores selected resources in local form state as IDs (e.g., `name_id`, `description_id`, `flag_ids`).
- Delegates option rendering and selection to resource components, passing `<resource>_id` / `<resource>_ids` plus `<resource>_resource` payloads from the API.
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Uses draft autosave to persist partial edits (draft ID stored in URL/search params).
- Supports generate/regenerate flows via `GenerateRegenerateModal`, emitting resource-type generation events and updating resource IDs on completion.

### Simulations.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Simulation.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).

## SQL Resource Creation (api_create_simulations_v4)
- **Parameters**: `agent_id, group_id, simulation_id, mcp`.
- **Behavior**:
  1. Validates tooling for the `simulation` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `simulations_resource` (or `simulation_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `simulations_id` in resource-only tables).

## Implementation Guidelines (resource-first)
- **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `simulation` in junction tables.
- **Use explicit IDs**: Persist `simulation_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Populate junction metadata**: Set `active`, `generated`, and `mcp` on each link row; for flags tables include `value` and any enum `type` fields.
- **Respect ordering columns**: If a junction table includes `position` or `idx`, preserve ordering when updating.
- **Honor draft workflow**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.
