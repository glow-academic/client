# Artifact Component + SQL Resource-First Specs (Persona-Patterned)

This document defines resource-first specs for every artifact component **except personas**. Each spec mirrors the persona component pattern: resource IDs are the source of truth, resource objects provide display metadata, and SQL functions return all required IDs + resources + suggestions + show/required/agent fields. See `client/components/personas/COMPONENT_PATTERNS.md` for the baseline conventions these specs follow. (Persona is intentionally excluded because it already has a dedicated patterns doc.)

**Core rules applied in every spec below:**
- **Resource-first state:** local/draft state stores `{resource}_id`/`{resource}_ids` only.
- **Resource metadata:** UI reads `{resource}_resource`/`{resource}_resources` (and `{resource}s` arrays) for names, descriptions, labels, etc.
- **AI generation:** use `{resource}_agent_id` and `general_agent_id` to gate generation; the UI never infers ability from resource content.
- **Show/required flags:** use `show_{resource}` and `{resource}_required` from SQL to drive visibility and validation.
- **Drafts:** drafts store **artifact types**, not resource types; draft updates pass IDs only.

---

## Agent (artifact: `agent`)

**Component:** `client/components/agents/Agent.tsx`

**Primary SQL:** `server/app/sql/v4/agents/get_agent_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/agents/get`
- `/api/v4/agents/save`
- `/api/v4/agents/draft`
- Resource creation endpoints for reasoning levels, temperature levels, voices, prompts, and models.

**Resource-first contract (IDs are the state):**
- **Single-select resources:** `name_id`, `description_id`, `prompt_id`, `model_id`, `temperature_level_id`, `reasoning_level_id`, `instructions_id`, `active_flag_id`.
- **Multi-select resources:** `tool_ids`, `department_ids`, `voice_ids`.
- **Resource objects:** `name_resource`, `description_resource`, `prompt_resource`, `model_resource`, `temperature_level_resource`, `reasoning_level_resource`, `instructions_resource`, `flag_resource`, `tool_resources`, `department_resources`, `voice_resources`.
- **Suggestions/visibility:** `show_*`, `{resource}_suggestions`, `{resource}_required`, `{resource}_agent_id` for each resource above.

**Behavior & steps:**
- GenericForm + StepCard for basic info, tools, model, temperature, reasoning, voices, prompts, and instructions.
- Generation is enabled via `general_agent_id`, with websocket listeners for progress/complete/error.

---

## Auth (artifact: `auth`)

**Component:** `client/components/auth/Auth.tsx`

**Primary SQL:** `server/app/sql/v4/auth/get_auth_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/auth/get`
- `/api/v4/auth/save`
- `/api/v4/auth/draft`
- Resource creation endpoints for protocols.

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id`, `active_flag_id`.
- **Multi-select resources:** `protocol_ids`, `slug_ids`.
- **Resource objects:** `name_resource`, `description_resource`, `flag_resource`, `protocol_resources`, `slug_resources`.
- **Suggestions/visibility:** `show_*`, `{resource}_suggestions`, `{resource}_required`, `{resource}_agent_id` for name/description/protocols/slugs/flags.

**Behavior & steps:**
- GenericForm + StepCard for basic info, protocols, and slugs.
- Validation uses `{resource}_required` and validates ID presence only.

---

## Cohort (artifact: `cohort`)

**Component:** `client/components/cohorts/Cohort.tsx`

**Primary SQL:** `server/app/sql/v4/cohorts/get_cohort_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/cohorts/get`
- `/api/v4/cohorts/save`
- `/api/v4/cohorts/draft`
- Resource creation endpoints for flags.

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id`, `active_flag_id`.
- **Multi-select resources:** `department_ids`, `simulation_ids`.
- **Resource objects:** `name_resource`, `description_resource`, `flag_resource`, `department_resources`, `simulation_resources`.
- **Suggestions/visibility:** `show_*`, `{resource}_suggestions`, `{resource}_required`, `{resource}_agent_id` for name/description/departments/simulations/flags.

**Behavior & steps:**
- Basic info + departments + simulations, with optional flags generation.
- Draft payload always passes ID lists; SQL validates membership and access.

---

## Department (artifact: `department`)

**Component:** `client/components/departments/Department.tsx`

**Primary SQL:** `server/app/sql/v4/departments/get_department_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/departments/get`
- `/api/v4/departments/save`
- `/api/v4/departments/draft`
- Resource creation endpoints for flags and settings.

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id`, `active_flag_id`.
- **Multi-select resources:** `settings_ids`.
- **Resource objects:** `name_resource`, `description_resource`, `flag_resource`, `settings_resources`.
- **Suggestions/visibility:** `show_*`, `{resource}_suggestions`, `{resource}_required`, `{resource}_agent_id` for name/description/settings/flags.

**Behavior & steps:**
- Basic info + settings selection; active state is represented by a flag resource.
- Draft/save payload uses IDs only; UI never stores labels directly.

---

## Document (artifact: `document`)

**Component:** `client/components/documents/Document.tsx`

**Primary SQL:** `server/app/sql/v4/documents/get_document_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/documents/get`
- `/api/v4/documents/save`
- `/api/v4/documents/draft`
- Resource creation endpoints for names, descriptions, flags, departments, fields.

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id`, `active_flag_id`.
- **Multi-select resources:** `department_ids`, `field_ids`, `upload_ids`.
- **Resource objects:** `name_resource`, `description_resource`, `flag_resource`, `department_resources`, `field_resources`, `upload_resources`.
- **Suggestions/visibility:** `show_*`, `{resource}_suggestions`, `{resource}_required`, `{resource}_agent_id` for names/descriptions/departments/fields/uploads/flags.

**Behavior & steps:**
- GenericForm steps cover basic info, departments, fields, and uploads.
- Uploads are treated as resources (IDs + metadata); no inline file metadata should be stored in form state.

---

## Eval (artifact: `eval`)

**Component:** `client/components/evals/Eval.tsx`

**Primary SQL:** `server/app/sql/v4/evals/get_eval_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/evals/get`
- `/api/v4/evals/save`
- `/api/v4/evals/draft`

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id` (from SQL), `active_flag_id` (if provided by SQL), with resource objects for display.
- **Multi-select resources:** `department_ids`, `agent_ids`, `group_ids`, `rubric_ids`, `grade_agent_ids` (per-agent settings).
- **Resource objects:** `name_resource`, `description_resource`, `department_resources`, `agent_resources`, `group_resources`, `rubric_resources` (as returned by SQL).
- **Per-agent settings:** `agent_settings[agent_id] = { rubric_ids, grade_agent_ids }` should remain ID-only, with display metadata pulled from `rubrics`/`agents` arrays returned by SQL.

**Behavior & steps:**
- GenericForm steps: basic info, model runs, and groups.
- Drafts should be stored as IDs only (resource objects are display-only).
  - **Implementation note:** the component currently captures `name`/`description` as strings; align it to `name_id`/`description_id` for full resource-first parity.

---

## Field (artifact: `field`)

**Component:** `client/components/fields/Field.tsx`

**Primary SQL:** `server/app/sql/v4/fields/get_field_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/fields/get`
- `/api/v4/fields/save`
- `/api/v4/fields/draft`

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id`, `active_flag_id` (if present in SQL).
- **Multi-select resources:** `department_ids`, `conditional_parameter_ids` (based on parameter mapping).
- **Resource objects:** `department_resources`, `parameter_resources`, plus name/description resource objects when available.
- **Mappings:** `department_ids` and `parameter_ids` are represented as ID-only arrays; display labels come from `departments`/`parameters` arrays returned by SQL.

**Behavior & steps:**
- Basic info + parameter association (via `ParameterCardGrid`), with draft autosave.
- The component builds ID→label mappings for departments/parameters; those mappings must originate from resource objects.
  - **Implementation note:** the current SQL returns `name`/`description` strings for fields; to be fully resource-first, return `name_id`/`description_id` and resource objects.

---

## Model (artifact: `model`)

**Component:** `client/components/models/Model.tsx`

**Primary SQL:** `server/app/sql/v4/models/get_model_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/models/get`
- `/api/v4/models/save`
- `/api/v4/models/draft`

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id`, `active_flag_id`.
- **Multi-select resources:** `endpoint_ids`, `modality_ids`, `pricing_ids`, `quality_ids`, `reasoning_level_ids`, `temperature_level_ids`, `value_ids`, `voice_ids`.
- **Resource objects:** `name_resource`, `description_resource`, `flag_resource`, plus `endpoint_resources`, `modality_resources`, `pricing_resources`, `quality_resources`, `reasoning_level_resources`, `temperature_level_resources`, `value_resources`, `voice_resources`.
- **Suggestions/visibility:** each resource comes with `show_*`, `{resource}_suggestions`, `{resource}_required`, `{resource}_agent_id` from SQL.

**Behavior & steps:**
- GenericForm steps for basic info, endpoints, modalities, pricing/qualities, reasoning/temperature levels, values, and voices.

---

## Parameter (artifact: `parameter`)

**Component:** `client/components/parameters/Parameter.tsx`

**Primary SQL:** `server/app/sql/v4/parameters/get_parameter_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/parameters/get`
- `/api/v4/parameters/save`
- `/api/v4/parameters/draft`

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id`, `active_flag_id` (if returned), or explicit name/description resources from SQL.
- **Multi-select resources:** `department_ids`, `field_ids`.
- **Resource objects:** `department_resources`, `field_resources`.
- **Boolean flags:** `persona_parameter`, `document_parameter`, `scenario_parameter`, `simulation_parameter`, `video_parameter` (stored in `parameter_flags` table, not junction tables).
- **Connections:** `field_connections` should remain ID-based (field_id + active/default states), with labels derived from `fields` resources.

**Behavior & steps:**
- Basic info + department/field associations; persona/document/scenario/simulation/video support uses boolean flags only (no junction tables).
  - **Implementation note:** `get_parameter_complete.sql` currently returns `name`/`description` strings; the resource-first target is to return `name_id`/`description_id` plus resource objects.

---

## Profile (artifact: `profile`)

**Component:** `client/components/staff/Profile.tsx`

**Primary SQL:** `server/app/sql/v4/profile/get_profile_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/profile/get`
- `/api/v4/profile/save`

**Resource-first contract:**
- **Single-select resources:** `first_name_id`, `last_name_id`, `active_flag_id`, `request_limit_id`.
- **Multi-select resources:** `department_ids`, `email_ids`.
- **Resource objects:** `first_name_resource`, `last_name_resource`, `department_resources`, `email_resources`, `request_limit_resource`, `flag_resource`.
- **Suggestions/visibility:** `show_*`, `{resource}_suggestions`, `{resource}_required`, `{resource}_agent_id` (where applicable).

**Behavior & steps:**
- Staff profile edit uses IDs for names/emails/departments; display labels come from resource objects.

---

## Provider (artifact: `provider`)

**Component:** `client/components/providers/Provider.tsx`

**Primary SQL:** `server/app/sql/v4/providers/get_provider_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/providers/get`
- `/api/v4/providers/save`
- `/api/v4/providers/draft`

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id`, `active_flag_id`.
- **Resource objects:** `name_resource`, `description_resource`, `flag_resource`.
- **Suggestions/visibility:** standard `show_*`, `{resource}_suggestions`, `{resource}_required`, `{resource}_agent_id` for name/description/flags.

**Behavior & steps:**
- Basic info with active flag; uses resource pickers for name/description/flags.

---

## Rubric (artifact: `rubric`)

**Component:** `client/components/rubrics/Rubric.tsx`

**Primary SQL:** `server/app/sql/v4/rubrics/get_rubric_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/rubrics/get`
- `/api/v4/rubrics/save`
- `/api/v4/rubrics/draft`

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id`, `active_flag_id` (if present in SQL).
- **Multi-select resources:** `department_ids`, `standard_group_ids`, `standard_ids`.
- **Resource objects:** `name_resource`, `description_resource`, `department_resources`, `standard_group_resources`, `standard_resources`.
- **Structured resources:** standards and groups are treated as resources with IDs, positions, and points; UI edits by referencing IDs only.

**Behavior & steps:**
- Step 1 basic info (name/description/departments).
- Steps 2–4 edit standard groups and standards; UI should always bind to resource IDs (never raw text literals).

---

## Scenario (artifact: `scenario`)

**Component:** `client/components/scenarios/Scenario.tsx`

**Primary SQL:** `server/app/sql/v4/scenarios/get_scenario_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/scenarios/get`
- `/api/v4/scenarios/save`
- `/api/v4/scenarios/draft`
- Resource creation endpoints for names, descriptions, problem statements, objectives, flags.

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id`, `problem_statement_id`, plus feature flags (`active_flag_id`, `objectives_enabled_flag_id`, `images_enabled_flag_id`, `video_enabled_flag_id`, `questions_enabled_flag_id`, `problem_statement_enabled_flag_id`).
- **Multi-select resources:** `persona_ids`, `document_ids`, `template_document_ids`, `parameter_ids`, `field_ids`, `objective_ids`.
- **Resource objects:** `name_resource`, `description_resource`, `problem_statement_resource`, `objective_resources`, `flag_resources`, plus `persona_resources`, `document_resources`, `parameter_resources`, `field_resources`.
- **Suggestions/visibility:** `show_*`, `{resource}_suggestions`, `{resource}_required`, `{resource}_agent_id` for names/descriptions/problem statements/objectives/flags.

**Behavior & steps:**
- Multi-step scenario builder: basic info, persona/document/parameter/field linking, content sections.
- Draft state stores IDs only; resource text is always read from resource objects.

---

## Setting (artifact: `setting`)

**Component:** `client/components/settings/Setting.tsx`

**Primary SQL:** `server/app/sql/v4/settings/get_setting_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/settings/get`
- `/api/v4/settings/save`
- `/api/v4/settings/draft`

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id`, `active_flag_id`.
- **Multi-select resources:** `department_ids`, `color_ids`, `auth_ids`, `provider_ids`, `key_ids`.
- **Resource objects:** `name_resource`, `description_resource`, `flag_resource`, `department_resources`, `color_resources`, `auth_resources`, `provider_resources`, `key_resources`.
- **Suggestions/visibility:** `show_*`, `{resource}_suggestions`, `{resource}_required`, `{resource}_agent_id` across all resources.

**Behavior & steps:**
- Settings editor uses step-based layout with resource pickers for each linked resource type.

---

## Simulation (artifact: `simulation`)

**Component:** `client/components/simulations/Simulation.tsx`

**Primary SQL:** `server/app/sql/v4/simulations/get_simulation_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/simulations/get`
- `/api/v4/simulations/save`
- `/api/v4/simulations/draft`
- Resource creation endpoints for flags, scenario flags, and scenario positions.

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id`, `active_flag_id`.
- **Multi-select resources:** `scenario_ids`, `scenario_flag_ids`.
- **Resource objects:** `name_resource`, `description_resource`, `flag_resource`, `scenario_resources`, `scenario_flag_resources`, `scenario_position_resources`.
- **Suggestions/visibility:** `show_*`, `{resource}_suggestions`, `{resource}_required`, `{resource}_agent_id` for flags/scenario flags/positions.

**Behavior & steps:**
- Simulation config ties scenarios to positions and flags; selection is always resource ID based.

---

## Tool (artifact: `tool`)

**Component:** `client/components/tools/Tool.tsx`

**Primary SQL:** `server/app/sql/v4/tools/get_tool_complete.sql`

**Endpoints used by component (server actions):**
- `/api/v4/tools/get`
- `/api/v4/tools/save`
- `/api/v4/tools/draft`
- Resource creation endpoints for args and args outputs.

**Resource-first contract:**
- **Single-select resources:** `name_id`, `description_id`, `active_flag_id` (if available in SQL).
- **Multi-select resources:** `args_ids`, `args_outputs_ids`.
- **Resource objects:** `name_resource`, `description_resource`, `flag_resource`, `args_resources`, `args_outputs_resources`.
- **Structured resources:** `input_args_fields`/`output_args_outputs` should be derived from `args_*` resources and always tracked by ID.

**Behavior & steps:**
- Tool editor uses pickers for args and outputs; all mappings remain ID-based.
  - **Implementation note:** the component currently captures `name`/`description` strings; align it to `name_id`/`description_id` to match the SQL resource fields.

---

## Additional Notes

- All specs assume **no JSONB** in SQL return payloads; composite types and arrays should be used to return nested resource objects.
- If any artifact still uses string fields in UI, the desired state is to map those to `{resource}_id` values (resource-first) and rely on resource objects for display.
- Use singular artifact names for drafts (`artifactType = "agent"`, etc.) and plural resource names for resource arrays (`names`, `descriptions`, `tools`, etc.).
