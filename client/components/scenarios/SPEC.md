# Scenario Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/scenarios/Scenario.tsx`, `client/components/scenarios/Scenarios.tsx`
- **Resource SQL**: `server/app/sql/v4/queries/resources/scenarios_complete.sql` (`api_create_scenarios_v4`)
- **API endpoints**: `server/app/api/v4/scenario/` (list, detail, create, update, delete, duplicate)
- **SQL queries**: `server/app/sql/v4/queries/scenario/` (all scenario operations)

## Resource-First Data Model
- **Artifact identity**: `scenario` records are referenced by `scenario_id` (or `scenario_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (schema.sql)

### Artifact + resource containers
- `scenario_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `scenarios_resource`(created_at, updated_at, scenario_id, active, generated, mcp, call_id, id)

### Junction + relationship tables (scenario ↔ resource)
- `scenario_content`(<u>scenario_id</u>, <u>content_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_conversations`(<u>scenario_id</u>, <u>conversation_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_departments`(active, created_at, updated_at, <u>department_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_descriptions`(<u>scenario_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `scenario_documents`(active, created_at, updated_at, <u>document_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_fields`(active, created_at, updated_at, <u>field_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_flags`(<u>scenario_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `scenario_hints`(<u>scenario_id</u>, <u>hint_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_images`(active, created_at, updated_at, <u>image_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_names`(<u>scenario_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `scenario_objectives`(idx, created_at, <u>objective_id</u>, <u>scenario_id</u>, generated, mcp, active, updated_at)
- `scenario_options`(<u>scenario_id</u>, <u>option_id</u>, active, created_at, updated_at, generated, mcp)
- `scenario_parameters`(active, created_at, updated_at, <u>parameter_id</u>, <u>scenario_id</u>, generated, mcp, type)
- `scenario_personas`(active, created_at, updated_at, <u>persona_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_problem_statements`(active, created_at, updated_at, <u>problem_statement_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_questions`(active, created_at, updated_at, <u>question_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_responses`(<u>scenario_id</u>, <u>response_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_templates`(<u>scenario_id</u>, <u>template_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_videos`(active, created_at, updated_at, <u>scenario_id</u>, <u>video_id</u>, generated, mcp)

### Scenario-specific resource tables (scenario-level resources)
- `scenario_flags_resource`(<u>id</u>, scenario_id, flag_id, created_at, updated_at, generated, mcp, active, call_id)
- `scenario_positions_resource`(<u>id</u>, scenario_id, value, created_at, updated_at, generated, mcp, call_id)
- `scenario_rubrics_resource`(<u>id</u>, scenario_id, rubric_id, created_at, updated_at, generated, mcp, active, call_id)
- `scenario_rubric_grade_agents_resource`(<u>id</u>, rubric_id, grade_agent_id, agent_id, created_at, updated_at, active, generated, call_id, mcp)
- `scenario_time_limits_resource`(<u>id</u>, scenario_id, time_limit_seconds, created_at, updated_at, generated, mcp, active, call_id)

### Simulation-scenario relationship tables (simulation context)
- `simulation_scenarios`(created_at, updated_at, <u>scenario_id</u>, <u>simulation_id</u>, generated, mcp, active) - Base relationship
- `simulation_scenario_flags`(<u>simulation_id</u>, <u>scenario_flag_id</u>, value, created_at, updated_at, generated, mcp, active) - Links to `scenario_flags_resource`
- `simulation_scenario_positions`(<u>simulation_id</u>, <u>scenario_position_id</u>, created_at, updated_at, generated, mcp, active) - Links to `scenario_positions_resource`
- `simulation_scenario_rubrics`(<u>simulation_id</u>, <u>scenario_rubric_id</u>, created_at, updated_at, generated, mcp, active) - Links to `scenario_rubrics_resource`
- `simulation_scenario_time_limits`(<u>simulation_id</u>, <u>scenario_time_limit_id</u>, created_at, updated_at, generated, mcp, active) - Links to `scenario_time_limits_resource`

### Resource tables referenced by the UI
- `names_resource`(<u>id</u>, name, created_at, updated_at, active, generated, call_id, mcp)
- `descriptions_resource`(<u>id</u>, description, created_at, updated_at, active, generated, call_id, mcp)
- `flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, call_id, mcp, type)
- `objectives_resource`(created_at, updated_at, objective, <u>id</u>, active, generated, call_id, mcp)
- `problem_statements_resource`(created_at, updated_at, name, problem_statement, <u>id</u>, active, generated, call_id, mcp)
- `images_resource`(created_at, updated_at, name, active, completed, <u>id</u>, description, generated, call_id, mcp)
- `videos_resource`(created_at, updated_at, name, length_seconds, active, completed, <u>id</u>, description, generated, call_id, mcp)
- `questions_resource`(created_at, updated_at, question_text, allow_multiple, active, <u>id</u>, generated, call_id, mcp)
- `options_resource`(created_at, updated_at, option_text, active, <u>id</u>, is_correct, generated, call_id, mcp)
- `hints_resource`(<u>id</u>, hint, created_at, updated_at, active, generated, call_id, mcp)
- `templates_resource`(<u>id</u>, html, name, description, created_at, updated_at, active, generated, mcp, call_id)
- `conversations_resource`(<u>id</u>, created_at, updated_at, end_reason, active, generated, call_id, mcp)
- `contents_resource`(<u>id</u>, content_id, created_at, updated_at, active, generated, mcp, call_id)
- `responses_resource`(created_at, updated_at, completed, <u>id</u>, option_id, question_id, active, generated, call_id, mcp)

### Other related tables
- `scenario_tree`(active, created_at, updated_at, <u>child_id</u>, <u>parent_id</u>, generated, mcp) - Hierarchical relationships (not a resource table)
- `draft_scenarios`(<u>draft_id</u>, <u>scenarios_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_scenario_flags`(<u>draft_id</u>, <u>scenario_flags_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_scenario_rubric_grade_agents`(<u>draft_id</u>, <u>scenario_rubric_grade_agents_id</u>, version, created_at, updated_at, generated, mcp, active)

## SQL/API Coverage Gaps
- `api_create_scenarios_v4` returns only the new resource `id`; it does not return metadata columns from `scenarios_resource` (created_at, updated_at, active, generated, mcp, call_id, group_id when present). If the UI needs those without a follow-up fetch, extend the SQL response or add a read endpoint.

## UI Resource Mapping

### Core Resources Used in Scenario Component
Based on `ScenarioFormState` type and actual component usage:

#### Single-Select Resources (stored as `_id`)
- **Names**: `name_id` → `scenario_names` → `names_resource`
- **Descriptions**: `description_id` → `scenario_descriptions` → `descriptions_resource`
- **Problem Statements**: `problem_statement_id` → `scenario_problem_statements` → `problem_statements_resource`

#### Multi-Select Resources (stored as `_ids`)
- **Departments**: `department_ids` → `scenario_departments` → `departments_resource`
- **Personas**: `persona_ids` → `scenario_personas` → `persona_artifact`
- **Documents**: `document_ids` → `scenario_documents` → `document_artifact`
- **Template Documents**: `template_document_ids` → `scenario_templates` → `templates_resource`
- **Parameters**: `parameter_ids` → `scenario_parameters` → `parameter_artifact`
- **Fields**: `field_ids` → `scenario_fields` → `field_artifact`
- **Images**: `image_ids` → `scenario_images` → `images_resource`
- **Objectives**: `objective_ids` → `scenario_objectives` → `objectives_resource` (with `idx` ordering)
- **Videos**: `video_ids` → `scenario_videos` → `videos_resource`
- **Questions**: `question_ids` → `scenario_questions` → `questions_resource`
- **Options**: `option_ids` → `scenario_options` → `options_resource` (linked to questions)
- **Hints**: `hint_ids` → `scenario_hints` → `hints_resource`
- **Conversations**: `conversation_ids` → `scenario_conversations` → `conversations_resource`
- **Content**: `content_ids` → `scenario_content` → `contents_resource`
- **Responses**: `response_ids` → `scenario_responses` → `responses_resource`

#### Flag Resources (stored as `_flag_id`)
- **Active**: `active_flag_id` → `scenario_flags` (flag_id + value=true) → `flags_resource` (name='active')
- **Objectives Enabled**: `objectives_enabled_flag_id` → `scenario_flags` → `flags_resource` (name='objectives_enabled')
- **Images Enabled**: `images_enabled_flag_id` → `scenario_flags` → `flags_resource` (name='images_enabled')
- **Video Enabled**: `video_enabled_flag_id` → `scenario_flags` → `flags_resource` (name='video_enabled')
- **Questions Enabled**: `questions_enabled_flag_id` → `scenario_flags` → `flags_resource` (name='questions_enabled')
- **Problem Statement Enabled**: `problem_statement_enabled_flag_id` → `scenario_flags` → `flags_resource` (name='problem_statement_enabled')

### Resource Relationships
- **Scenario-level resources**: `scenario_flags_resource`, `scenario_positions_resource`, `scenario_rubrics_resource`, `scenario_time_limits_resource` are managed at the scenario level but can be overridden at the simulation level via `simulation_scenario_*` tables.
- **Simulation context**: When scenarios are used in simulations, simulation-scenario relationship tables (`simulation_scenario_flags`, `simulation_scenario_positions`, etc.) allow per-simulation overrides of scenario-level settings.
- **Ordering**: Objectives use `idx` column in `scenario_objectives` to preserve ordering.
- **Randomization**: Range tables (`scenario_persona_ranges`, `scenario_document_ranges`, `scenario_parameter_ranges`, `scenario_field_ranges`) store min/max counts for randomization.

### Notes
- **IDs**: Use `<resource>_id` for single-select and `<resource>_ids` for multi-select resources (matching each resource component listed above).
- **Group relationship**: `scenario_artifact.group_id` provides the group relationship (redundant `scenario_groups` table removed).
- **Removed tables**: `scenario_video_images`, `scenario_scenario_flags` tables have been removed.
- **Non-resource tables**: `scenario_tree` is not a resource table and is not included in this spec (used for hierarchical relationships).

## Component Responsibilities

### Scenario.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `scenario` data and persist changes.
- Stores selected resources in local form state as IDs (e.g., `name_id`, `description_id`, `flag_ids`, `persona_ids`, `document_ids`, `objective_ids`, `problem_statement_id`).
- Delegates option rendering and selection to resource components, passing `<resource>_id` / `<resource>_ids` plus `<resource>_resource` payloads from the API.
- Handles multi-select resources: Personas, Documents, Objectives, Parameters, Fields, Departments, Images, Videos, Questions, Hints.
- Handles single-select resources: Names, Descriptions, ProblemStatements.
- Manages flag resources via `scenario_flags` junction table (flags like `active`, `objectives_enabled`, `images_enabled`, `video_enabled`, `questions_enabled`, `problem_statement_enabled`).
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Uses draft autosave to persist partial edits (draft ID stored in URL/search params).
- Supports generate/regenerate flows via `GenerateRegenerateModal`, emitting resource-type generation events and updating resource IDs on completion.
- Handles randomization ranges for personas, documents, parameters, and fields (via `scenario_persona_ranges`, `scenario_document_ranges`, `scenario_parameter_ranges`, `scenario_field_ranges`).

### Scenarios.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Scenario.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).
- Displays scenario metadata: name, description, problem statement, active status, department associations, objective counts, persona counts, simulation associations.

## SQL Resource Creation (api_create_scenarios_v4)
- **Parameters**: `agent_id, group_id, scenario_id, mcp`.
- **Behavior**:
  1. Validates tooling for the `scenario` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `scenarios_resource` (or `scenario_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `scenarios_id` in resource-only tables).

## Key API Endpoints

### List Operations
- `GET /api/v4/scenario/list` - Returns paginated list with filters, search, permissions
- Uses `api_list_scenarios_v4(profile_id)` SQL function
- Returns: scenarios array, objectives, fields, cohorts, personas, simulations, departments, options
- SQL file: `server/app/sql/v4/queries/scenario/get_scenarios_list_complete.sql`

### Detail Operations
- `GET /api/v4/scenario/{scenario_id}` - Returns full scenario detail
- Uses `api_get_scenario_detail_v4(scenario_id, profile_id, ...filters...)` SQL function
- Returns: scenario metadata, personas, documents, parameters, fields, departments, agents, simulations, objectives, problem_statements, images, videos, questions, objectives_history, document_details, parameters_detail
- SQL file: `server/app/sql/v4/queries/scenario/get_scenario_detail_complete.sql`
- Supports filtering by: departments, personas, documents, parameters, fields
- Supports search: persona_search, document_search, parameter_search
- Supports show selected filters: persona_show_selected, document_show_selected, parameter_show_selected, field_show_selected_by_param

### Create/Update Operations
- `POST /api/v4/scenario/create` - Creates new scenario artifact
- Uses `api_create_scenario_v4(...)` SQL function
- SQL file: `server/app/sql/v4/queries/scenario/create_scenario_complete.sql`
- `POST /api/v4/scenario/update` - Updates existing scenario
- Uses `api_update_scenario_v4(...)` SQL function
- SQL file: `server/app/sql/v4/queries/scenario/update_scenario_complete.sql`
- `POST /api/v4/scenario/duplicate` - Duplicates scenario with new IDs
- Uses `api_duplicate_scenario_v4(...)` SQL function
- SQL file: `server/app/sql/v4/queries/scenario/duplicate_scenario_complete.sql`

### Randomization Operations
- `POST /api/v4/scenario/randomize` - Creates randomized scenario variant
- Uses `api_randomize_scenario_v4(...)` SQL function
- SQL file: `server/app/sql/v4/queries/scenario/randomize_scenario_complete.sql`
- Uses range tables: `scenario_persona_ranges`, `scenario_document_ranges`, `scenario_parameter_ranges`, `scenario_field_ranges`

### Resource Creation Endpoints
- `POST /api/v4/resources/names` - Creates name resource
- `POST /api/v4/resources/descriptions` - Creates description resource
- `POST /api/v4/resources/problem_statements` - Creates problem statement resource
- `POST /api/v4/resources/objectives` - Creates objective resource
- `POST /api/v4/resources/scenario_flags` - Creates scenario flag resource
- All resource creation endpoints follow the pattern: `api_create_{resource}_v4(agent_id, group_id, ...resource_specific_params..., mcp)`
- All return: `{ id: uuid }` - the created resource ID

### Linking Operations (SQL functions)
- `api_insert_scenario_department_link_v4(scenario_id, department_id, ...)` - Links department to scenario
- `api_insert_scenario_persona_link_v4(scenario_id, persona_id, ...)` - Links persona to scenario
- `api_insert_scenario_document_link_v4(scenario_id, document_id, ...)` - Links document to scenario
- `api_insert_scenario_parameter_link_v4(scenario_id, parameter_id, ...)` - Links parameter to scenario
- `api_insert_scenario_image_link_v4(scenario_id, image_id, ...)` - Links image to scenario
- `api_insert_scenario_video_link_v4(scenario_id, video_id, ...)` - Links video to scenario
- `api_link_questions_to_scenario_v4(scenario_id, question_ids[], ...)` - Links questions to scenario
- All linking functions handle: `active`, `generated`, `mcp` flags, and proper junction table insertion

## Implementation Guidelines (resource-first)

### Resource Creation Flow
1. **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `scenario` in junction tables.
2. **Link to artifact**: After resource creation, insert into appropriate junction table (`scenario_names`, `scenario_descriptions`, etc.).
3. **Set junction metadata**: Always set `active`, `generated`, and `mcp` on each junction row.
4. **Handle ordering**: For ordered resources (objectives with `idx`), preserve ordering when updating.

### Form State Management
- **Use explicit IDs**: Persist `scenario_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Multi-select resources**: Use arrays (`persona_ids`, `document_ids`, `objective_ids`, `parameter_ids`, `field_ids`, `department_ids`).
- **Single-select resources**: Use single values (`name_id`, `description_id`, `problem_statement_id`).
- **Flag resources**: Use `scenario_flags` junction table with `flag_id` and `value` (boolean).

### Draft Workflow
- **Draft persistence**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.
- **Draft ID**: Store draft ID in URL/search params for autosave recovery.
- **Draft resources**: Draft-specific resources (`draft_scenario_flags`, `draft_scenario_rubric_grade_agents`) are used during draft state.

### Simulation Context
- **Scenario-level defaults**: Scenario resources (`scenario_flags_resource`, `scenario_positions_resource`, etc.) provide defaults.
- **Simulation overrides**: When scenarios are used in simulations, `simulation_scenario_*` tables allow per-simulation overrides.
- **Position management**: `scenario_positions_resource` stores position within a simulation context.

### Randomization
- **Range tables**: `scenario_persona_ranges`, `scenario_document_ranges`, `scenario_parameter_ranges`, `scenario_field_ranges` store min/max counts for randomization.
- **Randomization SQL**: `api_randomize_scenario_v4()` uses these ranges to generate randomized scenario variants.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.
- [ ] Multi-select resources use arrays (`_ids`), single-select use single values (`_id`).
- [ ] Flag resources use `scenario_flags` junction table with `flag_id` and `value`.
- [ ] Ordered resources (objectives) preserve `idx` ordering.
- [ ] Draft workflow properly handles draft-specific resources.
- [ ] Simulation context properly handles scenario-level defaults and simulation-level overrides.
