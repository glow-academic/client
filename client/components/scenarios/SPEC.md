# Scenario Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/scenarios/Scenario.tsx`, `client/components/scenarios/Scenarios.tsx`
- **Resource SQL**: `server/app/sql/v4/resources/scenarios_complete.sql` (`api_create_scenarios_v4`)

## Resource-First Data Model
- **Artifact identity**: `scenario` records are referenced by `scenario_id` (or `scenario_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (database_schema.md)
### Artifact + resource containers
- `scenario_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `scenarios_resource`(created_at, updated_at, scenario_id, active, generated, mcp, call_id, id)

### Junction + relationship tables
- `scenario_content`(<u>scenario_id</u>, <u>content_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_conversations`(<u>scenario_id</u>, <u>conversation_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_departments`(active, created_at, updated_at, <u>department_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_descriptions`(<u>scenario_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `scenario_documents`(active, created_at, updated_at, <u>document_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_fields`(active, created_at, updated_at, <u>field_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_flags`(<u>scenario_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `scenario_flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, mcp, call_id)
- `scenario_groups`(created_at, updated_at, <u>group_id</u>, <u>scenario_id</u>, generated, mcp, active)
- `scenario_hints`(<u>scenario_id</u>, <u>hint_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_images`(active, created_at, updated_at, <u>image_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_names`(<u>scenario_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `scenario_objectives`(idx, created_at, <u>objective_id</u>, <u>scenario_id</u>, generated, mcp, active, updated_at)
- `scenario_options`(<u>scenario_id</u>, <u>option_id</u>, active, created_at, updated_at, generated, mcp)
- `scenario_parameters`(active, created_at, updated_at, <u>parameter_id</u>, <u>scenario_id</u>, generated, mcp, type)
- `scenario_personas`(active, created_at, updated_at, <u>persona_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_positions_resource`(<u>simulation_id</u>, <u>scenario_id</u>, value, created_at, updated_at, generated, mcp, call_id)
- `scenario_problem_statements`(active, created_at, updated_at, <u>problem_statement_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_questions`(active, created_at, updated_at, <u>question_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_responses`(<u>scenario_id</u>, <u>response_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_rubric_grade_agents_resource`(<u>id</u>, rubric_id, grade_agent_id, agent_id, created_at, updated_at, active, generated, call_id, mcp)
- `scenario_scenario_flags`(<u>scenario_id</u>, <u>scenario_flags_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_templates`(<u>scenario_id</u>, <u>template_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_time_limits`(<u>simulation_id</u>, <u>scenario_id</u>, time_limit_seconds, active, created_at, updated_at, generated, mcp)
- `scenario_tree`(active, created_at, updated_at, <u>child_id</u>, <u>parent_id</u>, generated, mcp)
- `scenario_video_images`(idx, active, created_at, updated_at, <u>image_id</u>, <u>scenario_id</u>, <u>video_id</u>, generated, mcp)
- `scenario_videos`(active, created_at, updated_at, <u>scenario_id</u>, <u>video_id</u>, generated, mcp)

### Resource tables referenced by the UI
- `names_resource`(<u>id</u>, name, created_at, updated_at, active, generated, call_id, mcp)
- `descriptions_resource`(<u>id</u>, description, created_at, updated_at, active, generated, call_id, mcp)
- `flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, call_id, mcp, type)
- `objectives_resource`(created_at, updated_at, objective, <u>id</u>, active, generated, call_id, mcp)
- `problem_statements_resource`(created_at, updated_at, name, problem_statement, <u>id</u>, active, generated, call_id, mcp)

### Draft persistence
- `draft_scenarios`(<u>draft_id</u>, <u>scenarios_id</u>, version, created_at, updated_at, generated, mcp, active)

## UI Resource Mapping
- **Resources used**: Names, Descriptions, Flags, Objectives, ProblemStatements
- **IDs**: Use `<resource>_id` for single-select and `<resource>_ids` for multi-select resources (matching each resource component listed above).

## Component Responsibilities
### Scenario.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `scenario` data and persist changes.
- Stores selected resources in local form state as IDs (e.g., `name_id`, `description_id`, `flag_ids`).
- Delegates option rendering and selection to resource components, passing `<resource>_id` / `<resource>_ids` plus `<resource>_resource` payloads from the API.
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Uses draft autosave to persist partial edits (draft ID stored in URL/search params).
- Supports generate/regenerate flows via `GenerateRegenerateModal`, emitting resource-type generation events and updating resource IDs on completion.

### Scenarios.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Scenario.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).

## SQL Resource Creation (api_create_scenarios_v4)
- **Parameters**: `agent_id, group_id, scenario_id, mcp`.
- **Behavior**:
  1. Validates tooling for the `scenario` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `scenarios_resource` (or `scenario_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `scenarios_id` in resource-only tables).

## Implementation Guidelines (resource-first)
- **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `scenario` in junction tables.
- **Use explicit IDs**: Persist `scenario_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Populate junction metadata**: Set `active`, `generated`, and `mcp` on each link row; for flags tables include `value` and any enum `type` fields.
- **Respect ordering columns**: If a junction table includes `position` or `idx`, preserve ordering when updating.
- **Honor draft workflow**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.
