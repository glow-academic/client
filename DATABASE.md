# Database Design & Architecture

This document serves as the comprehensive reference for database design, artifacts/resources structure, table schemas, and database-specific patterns in GLOW.

## Table of Contents

1. [Database Design Principles](#database-design-principles)
2. [Artifact/Resource/Junction Table Pattern](#artifactresourcejunction-table-pattern)
3. [Complete Artifact Catalog](#complete-artifact-catalog)
4. [Complete Resource Catalog](#complete-resource-catalog)
5. [Table Structure Reference](#table-structure-reference)
6. [Composite Types in `types` Schema](#composite-types-in-types-schema)
7. [Migration Patterns](#migration-patterns)
8. [Database-Specific Gotchas](#database-specific-gotchas)
9. [Schema Organization](#schema-organization)
10. [Database Query Patterns](#database-query-patterns)

---

## Database Design Principles

### BCNF Normalization (Chris Date Principles)

**Boyce-Codd Normal Form** - Third normal form with no transitive dependencies.

**Key Principles:**
- **Eliminate redundancy**: No duplicate data across tables
- **No transitive dependencies**: Attributes depend only on the primary key
- **Minimize nulls**: Use NOT NULL wherever possible
- **Referential integrity**: All foreign keys with proper constraints
- **Meaningful constraints**: CHECK constraints for business rules

**Example:**
```sql
-- ✅ Good: Normalized structure
CREATE TABLE agent_artifact (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    generated boolean NOT NULL DEFAULT false,
    mcp boolean NOT NULL DEFAULT false,
    group_id uuid NOT NULL REFERENCES groups(id)
);

-- Names stored separately, linked via junction table
CREATE TABLE names_resource (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    name text NOT NULL,
    -- ... other columns
);

CREATE TABLE agent_names (
    agent_id uuid NOT NULL REFERENCES agent_artifact(id) ON DELETE CASCADE,
    name_id uuid NOT NULL REFERENCES names_resource(id) ON DELETE CASCADE,
    active boolean NOT NULL DEFAULT true,
    -- ... other columns
    PRIMARY KEY (agent_id, name_id)
);
```

### No Nulls Policy

**Minimize nulls**: Use NOT NULL wherever possible, use DEFAULT clauses instead of allowing NULL.

**Patterns:**
- **Timestamps**: Always `NOT NULL DEFAULT now()`
- **Booleans**: Always `NOT NULL DEFAULT false` (or `true` if appropriate)
- **Arrays**: Use `ARRAY[]::uuid[]` instead of NULL
- **Text**: Use `''` (empty string) instead of NULL when appropriate
- **Optional fields**: Use separate tables or junction tables with `active` flags

**Example:**
```sql
-- ✅ Good: No nulls
CREATE TABLE names_resource (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    name text NOT NULL,  -- Never NULL
    created_at timestamptz NOT NULL DEFAULT now(),
    active boolean NOT NULL DEFAULT true,  -- Never NULL
    generated boolean NOT NULL DEFAULT false,  -- Never NULL
    call_id uuid NOT NULL  -- Required, never NULL
);

-- ❌ Bad: Nullable columns
CREATE TABLE names_resource (
    id uuid PRIMARY KEY,
    name text,  -- Could be NULL
    active boolean,  -- Could be NULL
    call_id uuid  -- Could be NULL
);
```

### Referential Integrity

**All relationships must have foreign key constraints** with appropriate CASCADE behavior.

**Patterns:**
- **Junction tables**: `ON DELETE CASCADE` (when artifact deleted, remove links)
- **Resource references**: `ON DELETE CASCADE` (when resource deleted, remove from artifacts)
- **Parent-child relationships**: `ON DELETE CASCADE` or `ON DELETE SET NULL` based on business logic

**Example:**
```sql
-- ✅ Good: Proper foreign keys with CASCADE
CREATE TABLE agent_names (
    agent_id uuid NOT NULL REFERENCES agent_artifact(id) ON DELETE CASCADE,
    name_id uuid NOT NULL REFERENCES names_resource(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, name_id)
);

-- When agent_artifact is deleted, all agent_names rows are automatically deleted
-- When names_resource is deleted, all agent_names rows referencing it are automatically deleted
```

---

## Artifact/Resource/Junction Table Pattern

### Overview

GLOW uses a **three-tier architecture** for organizing data:

1. **Artifacts** (17 core entities) - Base tables for core graph components
2. **Resources** (75+ reusable components) - Shared components used by artifacts
3. **Junction Tables** - Many-to-many relationships linking artifacts to resources

### 17 Core Artifacts

The following artifacts represent the core graph components in GLOW:

1. `agent` - AI agents with prompts, models, tools
2. `auth` - Authentication configurations
3. `cohort` - Student cohorts
4. `department` - Organizational departments
5. `document` - Document resources
6. `eval` - Evaluation configurations
7. `field` - Custom fields
8. `model` - AI models
9. `parameter` - Configuration parameters
10. `persona` - AI characters used in scenarios
11. `profile` - User profiles
12. `provider` - AI providers
13. `rubric` - Grading rubrics
14. `scenario` - Practice scenarios for learning
15. `setting` - System settings
16. `simulation` - Interactive simulation sessions
17. `tool` - Tools available to agents

### Artifact Tables Structure

**Standard Columns:**
- `id uuid` - Primary key (DEFAULT `uuidv7()`)
- `created_at timestamptz` - Creation timestamp (NOT NULL, DEFAULT `now()`)
- `updated_at timestamptz` - Last update timestamp (NOT NULL, DEFAULT `now()`)
- `generated boolean` - Whether artifact was AI-generated (NOT NULL, DEFAULT `false`)
- `mcp boolean` - Whether artifact was created via MCP (NOT NULL, DEFAULT `false`)
- `group_id uuid` - Group ID for traceability (NOT NULL, REFERENCES `groups(id)`)

**Example:**
```sql
CREATE TABLE agent_artifact (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    generated boolean NOT NULL DEFAULT false,
    mcp boolean NOT NULL DEFAULT false,
    group_id uuid NOT NULL REFERENCES groups(id)
);

CREATE INDEX agent_group_id_idx ON agent_artifact(group_id);
CREATE UNIQUE INDEX agent_group_id_unique ON agent_artifact(group_id);
CREATE INDEX idx_agents_mcp ON agent_artifact(mcp);
```

**All 17 artifact tables follow this exact structure.**

### Resource Tables Structure

**Standard Columns:**
- `id uuid` - Primary key (DEFAULT `uuidv7()`)
- `created_at timestamptz` - Creation timestamp (NOT NULL, DEFAULT `now()`)
- `updated_at timestamptz` - Last update timestamp (NOT NULL, DEFAULT `now()`)
- `active boolean` - Whether resource is active (NOT NULL, DEFAULT `true`)
- `generated boolean` - Whether resource was AI-generated (NOT NULL, DEFAULT `false`)
- `mcp boolean` - Whether resource was created via MCP (NOT NULL, DEFAULT `false`)
- `call_id uuid` - Call ID for traceability (NOT NULL, REFERENCES `calls(id)`)

**Resource-Specific Columns:**
Each resource table has additional columns specific to its type:
- `names_resource`: `name text NOT NULL`
- `colors_resource`: `name text NOT NULL`, `description text NOT NULL`, `hex_code text NOT NULL`
- `descriptions_resource`: `description text NOT NULL`
- `icons_resource`: `name text NOT NULL`, `description text NOT NULL`, `value text NOT NULL`
- etc.

**Example:**
```sql
CREATE TABLE names_resource (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    active boolean NOT NULL DEFAULT true,
    generated boolean NOT NULL DEFAULT false,
    call_id uuid NOT NULL REFERENCES calls(id),
    mcp boolean NOT NULL DEFAULT false
);

CREATE INDEX names_call_id_idx ON names_resource(call_id) WHERE call_id IS NOT NULL;
CREATE INDEX names_name_idx ON names_resource(name);
CREATE UNIQUE INDEX names_name_unique ON names_resource(name);
CREATE INDEX idx_names_mcp ON names_resource(mcp);
```

**⚠️ CRITICAL: All resource tables have `call_id NOT NULL`** - This is required for traceability and regeneration support.

### Junction Tables Structure

**Standard Columns:**
- `{artifact}_id uuid` - Foreign key to artifact table (NOT NULL, REFERENCES `{artifact}_artifact(id) ON DELETE CASCADE`)
- `{resource}_id uuid` - Foreign key to resource table (NOT NULL, REFERENCES `{resource}_resource(id) ON DELETE CASCADE`)
- `active boolean` - Whether link is active (NOT NULL, DEFAULT `true`)
- `created_at timestamptz` - Creation timestamp (NOT NULL, DEFAULT `now()`)
- `updated_at timestamptz` - Last update timestamp (NOT NULL, DEFAULT `now()`)
- `generated boolean` - Whether link was AI-generated (NOT NULL, DEFAULT `false`)
- `mcp boolean` - Whether link was created via MCP (NOT NULL, DEFAULT `false`)

**Primary Key:**
- Composite primary key: `PRIMARY KEY ({artifact}_id, {resource}_id)`

**⚠️ CRITICAL: Junction tables do NOT have `call_id`** - Only resource tables have `call_id`.

**Example:**
```sql
CREATE TABLE agent_names (
    agent_id uuid NOT NULL REFERENCES agent_artifact(id) ON DELETE CASCADE,
    name_id uuid NOT NULL REFERENCES names_resource(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    generated boolean NOT NULL DEFAULT false,
    mcp boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    PRIMARY KEY (agent_id, name_id)
);

CREATE INDEX agent_names_agent_id_idx ON agent_names(agent_id);
CREATE INDEX agent_names_name_id_idx ON agent_names(name_id);
CREATE INDEX idx_agent_names_generated ON agent_names(generated);
CREATE INDEX idx_agent_names_mcp ON agent_names(mcp);
```

**All junction tables follow this exact structure.**

### Artifact-Resource Mapping

The `artifact_resources` table defines which resources can be linked to which artifacts:

```sql
CREATE TABLE artifact_resources (
    artifact artifacts NOT NULL,
    resource resources NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (artifact, resource)
);
```

**Current Mappings:** 147 artifact-resource pairs (as of latest audit)

**Examples:**
- `persona` → `colors`, `departments`, `descriptions`, `examples`, `fields`, `flags`, `icons`, `instructions`, `names`, `parameters`
- `scenario` → `contents`, `conversations`, `departments`, `descriptions`, `documents`, `fields`, `flags`, `hints`, `images`, `names`, `objectives`, `options`, `parameters`, `personas`, `problem_statements`, `questions`, `responses`, `scenario_flags`, `templates`, `videos`
- `simulation` → `analyses`, `departments`, `descriptions`, `feedbacks`, `flags`, `improvements`, `names`, `scenario_flags`, `scenario_positions`, `scenario_rubrics`, `scenario_time_limits`, `scenarios`, `simulation_positions`, `strengths`, `times`
- etc.

---

## Complete Artifact Catalog

### Agent Artifact

**Table:** `agent_artifact`

**Associated Resources:**
- `departments` (multi-select)
- `descriptions` (single-select)
- `flags` (single-select)
- `instructions` (single-select)
- `models` (multi-select)
- `names` (single-select)
- `prompts` (single-select)
- `reasoning_levels` (single-select)
- `temperature_levels` (single-select)
- `voices` (single-select)

**Junction Tables:**
- `agent_departments`
- `agent_descriptions`
- `agent_flags`
- `agent_instructions`
- `agent_models`
- `agent_names`
- `agent_prompts`
- `agent_reasoning_levels`
- `agent_temperature_levels`
- `agent_voices`
- `agent_tools` (special: links to `tool_artifact`, not a resource)

**Use Cases:**
- AI agents with system prompts, models, tools, and configuration
- Agents can be linked to departments for scoping
- Agents have reasoning levels and temperature levels for LLM configuration

### Auth Artifact

**Table:** `auth_artifact`

**Associated Resources:**
- `descriptions` (single-select)
- `flags` (single-select)
- `items` (multi-select)
- `names` (single-select)
- `protocols` (multi-select)
- `slugs` (multi-select)

**Junction Tables:**
- `auth_descriptions`
- `auth_flags`
- `auth_items`
- `auth_names`
- `auth_protocols`
- `auth_slugs`

**Use Cases:**
- Authentication configurations for different protocols
- Supports multiple protocols, slugs, and items per auth configuration

### Cohort Artifact

**Table:** `cohort_artifact`

**Associated Resources:**
- `departments` (multi-select)
- `descriptions` (single-select)
- `flags` (single-select)
- `names` (single-select)
- `profiles` (multi-select, special: links to `profile_artifact`)
- `simulations` (multi-select, special: links to `simulation_artifact`)

**Junction Tables:**
- `cohort_departments`
- `cohort_descriptions`
- `cohort_flags`
- `cohort_names`
- `cohort_profiles`
- `cohort_simulations`

**Use Cases:**
- Student cohorts with linked profiles and simulations
- Cohorts can be scoped to departments

### Department Artifact

**Table:** `department_artifact`

**Associated Resources:**
- `descriptions` (single-select)
- `flags` (single-select)
- `names` (single-select)
- `settings` (multi-select, special: links to `setting_artifact`)

**Junction Tables:**
- `department_descriptions`
- `department_flags`
- `department_names`
- `department_settings`

**Use Cases:**
- Organizational departments
- Departments can have multiple settings configurations

### Document Artifact

**Table:** `document_artifact`

**Associated Resources:**
- `args` (multi-select)
- `args_outputs` (multi-select)
- `departments` (multi-select)
- `descriptions` (single-select)
- `fields` (multi-select)
- `flags` (single-select)
- `names` (single-select)
- `parameters` (multi-select)
- `templates` (multi-select)
- `uploads` (multi-select)

**Junction Tables:**
- `document_args`
- `document_args_outputs`
- `document_departments`
- `document_descriptions`
- `document_fields`
- `document_flags`
- `document_names`
- `document_parameters`
- `document_templates`
- `document_uploads_resource`

**Use Cases:**
- Document resources with templates, fields, and parameters
- Documents can have multiple uploads and args/args_outputs for tool definitions

### Eval Artifact

**Table:** `eval_artifact`

**Associated Resources:**
- `agents` (multi-select, special: links to `agent_artifact`)
- `analyses` (multi-select)
- `departments` (multi-select)
- `descriptions` (single-select)
- `feedbacks` (multi-select)
- `flags` (single-select)
- `group_positions` (multi-select)
- `groups` (multi-select, special: links to `groups` table)
- `names` (single-select)
- `rubrics` (multi-select, special: links to `rubric_artifact`)
- `run_positions` (multi-select)
- `runs` (multi-select, special: links to `runs` table)
- `times` (multi-select)

**Junction Tables:**
- `eval_agents`
- `eval_analyses`
- `eval_departments`
- `eval_descriptions`
- `eval_feedbacks`
- `eval_flags`
- `eval_group_positions`
- `eval_groups`
- `eval_names`
- `eval_rubrics`
- `eval_run_positions`
- `eval_runs`
- `eval_times`

**Use Cases:**
- Evaluation configurations with linked agents, rubrics, groups, and runs
- Evals track positions for groups and runs

### Field Artifact

**Table:** `field_artifact`

**Associated Resources:**
- `departments` (multi-select)
- `descriptions` (single-select)
- `flags` (single-select)
- `names` (single-select)
- `parameters` (multi-select)

**Junction Tables:**
- `field_departments`
- `field_descriptions`
- `field_flags`
- `field_names`
- `field_parameters`

**Use Cases:**
- Custom fields with parameters
- Fields can be scoped to departments

### Model Artifact

**Table:** `model_artifact`

**Associated Resources:**
- `departments` (multi-select)
- `descriptions` (single-select)
- `endpoints` (multi-select)
- `flags` (single-select)
- `keys` (multi-select, special: links to `keys` table, not a resource)
- `modalities` (multi-select)
- `names` (single-select)
- `pricing` (multi-select)
- `providers` (multi-select)
- `qualities` (multi-select)
- `reasoning_levels` (multi-select)
- `temperature_levels` (multi-select)
- `voices` (multi-select)

**Junction Tables:**
- `model_departments`
- `model_descriptions`
- `model_endpoints`
- `model_flags`
- `model_keys`
- `model_modalities`
- `model_names`
- `model_pricing`
- `model_providers`
- `model_qualities`
- `model_reasoning_levels`
- `model_temperature_levels`
- `model_voices`

**Use Cases:**
- AI models with endpoints, providers, pricing, and configuration
- Models support multiple modalities, qualities, reasoning levels, temperature levels, and voices

### Parameter Artifact

**Table:** `parameter_artifact`

**Associated Resources:**
- `departments` (multi-select)
- `descriptions` (single-select)
- `fields` (multi-select)
- `flags` (single-select)
- `names` (single-select)

**Junction Tables:**
- `parameter_departments`
- `parameter_descriptions`
- `parameter_fields`
- `parameter_flags`
- `parameter_names`

**Use Cases:**
- Configuration parameters with linked fields
- Parameters can be scoped to departments

### Persona Artifact

**Table:** `persona_artifact`

**Associated Resources:**
- `colors` (single-select)
- `departments` (multi-select)
- `descriptions` (single-select)
- `examples` (multi-select)
- `fields` (multi-select)
- `flags` (single-select)
- `icons` (single-select)
- `instructions` (single-select)
- `names` (single-select)
- `parameters` (multi-select)

**Junction Tables:**
- `persona_colors`
- `persona_departments`
- `persona_descriptions`
- `persona_examples`
- `persona_fields`
- `persona_flags`
- `persona_icons`
- `persona_instructions`
- `persona_names`
- `persona_parameters`

**Use Cases:**
- AI characters used in scenarios
- Personas have colors, icons, names, descriptions, instructions, and examples
- Personas can be scoped to departments and fields

### Profile Artifact

**Table:** `profile_artifact`

**Associated Resources:**
- `cohorts` (multi-select, special: links to `cohort_artifact`)
- `departments` (multi-select)
- `emails` (multi-select)
- `flags` (single-select)
- `names` (single-select)
- `request_limits` (multi-select)

**Junction Tables:**
- `profile_cohorts`
- `profile_departments`
- `profile_emails`
- `profile_flags`
- `profile_names`
- `profile_request_limits`

**Use Cases:**
- User profiles with linked cohorts, departments, and emails
- Profiles have request limits for rate limiting

### Provider Artifact

**Table:** `provider_artifact`

**Associated Resources:**
- `descriptions` (single-select)
- `flags` (single-select)
- `names` (single-select)
- `values` (multi-select)

**Junction Tables:**
- `provider_descriptions`
- `provider_flags`
- `provider_names`
- `provider_values`

**Use Cases:**
- AI providers with configuration values
- Providers are simple entities with names, descriptions, flags, and values

### Rubric Artifact

**Table:** `rubric_artifact`

**Associated Resources:**
- `departments` (multi-select)
- `descriptions` (single-select)
- `flags` (single-select)
- `names` (single-select)
- `points` (multi-select)
- `standard_groups` (multi-select)

**Junction Tables:**
- `rubric_departments`
- `rubric_descriptions`
- `rubric_flags`
- `rubric_names`
- `rubric_points`
- `rubric_standard_groups`

**Use Cases:**
- Grading rubrics with standard groups and points
- Rubrics can be scoped to departments

### Scenario Artifact

**Table:** `scenario_artifact`

**Associated Resources:**
- `contents` (multi-select)
- `conversations` (multi-select)
- `departments` (multi-select)
- `descriptions` (single-select)
- `documents` (multi-select)
- `fields` (multi-select)
- `flags` (single-select)
- `hints` (multi-select)
- `images` (multi-select)
- `names` (single-select)
- `objectives` (multi-select)
- `options` (multi-select)
- `parameters` (multi-select)
- `personas` (multi-select, special: links to `persona_artifact`)
- `problem_statements` (multi-select)
- `questions` (multi-select)
- `responses` (multi-select)
- `scenario_flags` (multi-select)
- `templates` (multi-select)
- `videos` (multi-select)

**Junction Tables:**
- `scenario_contents`
- `scenario_conversations`
- `scenario_departments`
- `scenario_descriptions`
- `scenario_documents`
- `scenario_fields`
- `scenario_flags`
- `scenario_hints`
- `scenario_images`
- `scenario_names`
- `scenario_objectives`
- `scenario_options`
- `scenario_parameters`
- `scenario_personas`
- `scenario_problem_statements`
- `scenario_questions`
- `scenario_responses`
- `scenario_scenario_flags`
- `scenario_templates`
- `scenario_videos`

**Use Cases:**
- Practice scenarios for learning with questions, options, objectives, personas, hints, and content
- Scenarios can have images, videos, documents, and templates
- Scenarios support conversations and responses

### Setting Artifact

**Table:** `setting_artifact`

**Associated Resources:**
- `auths` (multi-select)
- `colors` (multi-select)
- `default_accounts` (multi-select)
- `departments` (multi-select)
- `descriptions` (single-select)
- `flags` (single-select)
- `names` (single-select)
- `providers` (multi-select)
- `thresholds` (multi-select)

**Junction Tables:**
- `setting_auths`
- `setting_colors`
- `setting_default_accounts`
- `setting_departments`
- `setting_descriptions`
- `setting_flags`
- `setting_names`
- `setting_providers`
- `setting_thresholds`

**Use Cases:**
- System settings with auth configurations, providers, colors, and thresholds
- Settings can have default accounts and be scoped to departments

### Simulation Artifact

**Table:** `simulation_artifact`

**Associated Resources:**
- `analyses` (multi-select)
- `departments` (multi-select)
- `descriptions` (single-select)
- `feedbacks` (multi-select)
- `flags` (single-select)
- `improvements` (multi-select)
- `names` (single-select)
- `scenario_flags` (multi-select)
- `scenario_positions` (multi-select)
- `scenario_rubrics` (multi-select)
- `scenario_time_limits` (multi-select)
- `scenarios` (multi-select, special: links to `scenario_artifact`)
- `simulation_positions` (multi-select)
- `strengths` (multi-select)
- `times` (multi-select)

**Junction Tables:**
- `simulation_analyses`
- `simulation_departments`
- `simulation_descriptions`
- `simulation_feedbacks`
- `simulation_flags`
- `simulation_improvements`
- `simulation_names`
- `simulation_scenario_flags`
- `simulation_scenario_positions`
- `simulation_scenario_rubrics`
- `simulation_scenario_time_limits`
- `simulation_scenarios`
- `simulation_simulation_positions`
- `simulation_strengths`
- `simulation_times`

**Use Cases:**
- Interactive simulation sessions with linked scenarios
- Simulations track analyses, feedbacks, improvements, strengths, and times for grading
- Simulations have positions and time limits

### Tool Artifact

**Table:** `tool_artifact`

**Associated Resources:**
- `args` (multi-select)
- `args_outputs` (multi-select)
- `descriptions` (single-select)
- `domains` (multi-select)
- `names` (single-select)
- `templates` (multi-select)

**Junction Tables:**
- `tool_args`
- `tool_args_outputs`
- `tool_descriptions`
- `tool_domains`
- `tool_names`
- `tool_templates`

**Use Cases:**
- Tools available to agents with args, args_outputs, and templates
- Tools can be linked to domains for organization

---

## Complete Resource Catalog

### Shared Resources (Used by Multiple Artifacts)

These resources are shared across multiple artifacts:

#### Names Resource

**Table:** `names_resource`

**Columns:**
- Standard resource columns (`id`, `created_at`, `updated_at`, `active`, `generated`, `mcp`, `call_id`)
- `name text NOT NULL` - The name value

**Used By:** All 17 artifacts

**Junction Tables:** `{artifact}_names` for each artifact

**Special Considerations:**
- Names are unique per resource (`UNIQUE` constraint on `name`)
- Names can be AI-generated or manually entered
- Names are suggested based on usage in other artifacts

#### Descriptions Resource

**Table:** `descriptions_resource`

**Columns:**
- Standard resource columns
- `description text NOT NULL` - The description value

**Used By:** All 17 artifacts except `tool` (tool uses `descriptions` but it's a different pattern)

**Junction Tables:** `{artifact}_descriptions` for each artifact

**Special Considerations:**
- Descriptions are suggested based on usage in other artifacts
- Descriptions can be AI-generated

#### Flags Resource

**Table:** `flags_resource`

**Columns:**
- Standard resource columns
- `name text NOT NULL` - Flag name (e.g., "active", "public")
- `description text NOT NULL` - Flag description
- `icon_id uuid` - Optional icon reference

**Used By:** All 17 artifacts

**Junction Tables:** `{artifact}_flags` for each artifact

**Special Considerations:**
- Flags have a `value boolean` column in junction tables (not in resource table)
- Flags are used for boolean attributes (active, public, etc.)
- Flags can be AI-generated

#### Departments Resource

**Table:** `departments_resource`

**Columns:**
- Standard resource columns
- `department_id uuid NOT NULL` - References `department_artifact(id)`
- `group_id uuid` - Optional group reference

**Used By:** 13 artifacts (agent, cohort, department, document, eval, field, model, parameter, persona, profile, rubric, scenario, setting, simulation)

**Junction Tables:** `{artifact}_departments` for each artifact

**Special Considerations:**
- Departments are multi-select (artifacts can belong to multiple departments)
- Department links have `active` flag in junction tables
- Departments are used for scoping and access control

### Single-Artifact Resources

These resources are used by only one artifact:

#### Colors Resource

**Table:** `colors_resource`

**Columns:**
- Standard resource columns
- `name text NOT NULL` - Color name
- `description text NOT NULL` - Color description
- `hex_code text NOT NULL` - Hex color code

**Used By:** `persona`, `setting`

**Junction Tables:** `persona_colors`, `setting_colors`

**Special Considerations:**
- Colors are shared resources (same color can be used by multiple personas/settings)
- Colors have `UNIQUE` constraint on `hex_code`
- Colors are typically predefined, not AI-generated

#### Icons Resource

**Table:** `icons_resource`

**Columns:**
- Standard resource columns
- `name text NOT NULL` - Icon name
- `description text NOT NULL` - Icon description
- `value text NOT NULL` - Icon value (e.g., emoji or icon identifier)

**Used By:** `persona`

**Junction Tables:** `persona_icons`

**Special Considerations:**
- Icons are shared resources
- Icons are typically predefined, not AI-generated

#### Instructions Resource

**Table:** `instructions_resource`

**Columns:**
- Standard resource columns
- `template text NOT NULL` - Instruction template (Jinja template)

**Used By:** `agent`, `persona`

**Junction Tables:** `agent_instructions`, `persona_instructions`

**Special Considerations:**
- Instructions are Jinja templates
- Instructions can be AI-generated
- Instructions are suggested based on usage

### Multi-Artifact Resources

These resources are used by multiple artifacts but have artifact-specific patterns:

#### Examples Resource

**Table:** `examples_resource`

**Columns:**
- Standard resource columns
- `example text NOT NULL` - Example value
- `idx integer NOT NULL` - Example index/position

**Used By:** `persona`

**Junction Tables:** `persona_examples`

**Special Considerations:**
- Examples are ordered by `idx`
- Examples can be AI-generated
- Examples are suggested based on usage

#### Questions Resource

**Table:** `questions_resource`

**Columns:**
- Standard resource columns
- `question text NOT NULL` - Question text
- Additional columns for question metadata

**Used By:** `scenario`

**Junction Tables:** `scenario_questions`

**Special Considerations:**
- Questions are linked to scenarios
- Questions can have options, responses, and objectives

#### Options Resource

**Table:** `options_resource`

**Columns:**
- Standard resource columns
- `option text NOT NULL` - Option text
- Additional columns for option metadata

**Used By:** `scenario`

**Junction Tables:** `scenario_options`

**Special Considerations:**
- Options are linked to questions
- Options can be correct/incorrect

#### Responses Resource

**Table:** `responses_resource`

**Columns:**
- Standard resource columns
- `response text NOT NULL` - Response text
- Additional columns for response metadata

**Used By:** `scenario`

**Junction Tables:** `scenario_responses`

**Special Considerations:**
- Responses link questions to options
- Responses indicate correct answers

### Special Resources

#### Analyses Resource

**Table:** `analyses_resource`

**Columns:**
- Standard resource columns
- `content text NOT NULL` - Analysis content

**Used By:** `eval`, `simulation`

**Junction Tables:** `eval_analyses`, `simulation_analyses`

**Special Considerations:**
- Analyses are AI-generated feedback
- Analyses are linked to grades/evaluations

#### Feedbacks Resource

**Table:** `feedbacks_resource`

**Columns:**
- Standard resource columns
- `content text NOT NULL` - Feedback content

**Used By:** `eval`, `simulation`

**Junction Tables:** `eval_feedbacks`, `simulation_feedbacks`

**Special Considerations:**
- Feedbacks are AI-generated
- Feedbacks are linked to grades/evaluations

#### Improvements Resource

**Table:** `improvements_resource`

**Columns:**
- Standard resource columns
- `content text NOT NULL` - Improvement suggestion content

**Used By:** `simulation`

**Junction Tables:** `simulation_improvements`

**Special Considerations:**
- Improvements are AI-generated suggestions
- Improvements are linked to grades

#### Strengths Resource

**Table:** `strengths_resource`

**Columns:**
- Standard resource columns
- `content text NOT NULL` - Strength content

**Used By:** `simulation`

**Junction Tables:** `simulation_strengths`

**Special Considerations:**
- Strengths are AI-generated positive feedback
- Strengths are linked to grades

#### Times Resource

**Table:** `times_resource`

**Columns:**
- Standard resource columns
- `time interval` or `duration` - Time value

**Used By:** `eval`, `simulation`

**Junction Tables:** `eval_times`, `simulation_times`

**Special Considerations:**
- Times track duration or timing information
- Times are linked to evaluations and simulations

---

## Table Structure Reference

### Artifact Tables

**Standard Structure:**
```sql
CREATE TABLE {artifact}_artifact (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    generated boolean NOT NULL DEFAULT false,
    mcp boolean NOT NULL DEFAULT false,
    group_id uuid NOT NULL REFERENCES groups(id)
);

-- Standard Indexes
CREATE INDEX {artifact}_group_id_idx ON {artifact}_artifact(group_id);
CREATE UNIQUE INDEX {artifact}_group_id_unique ON {artifact}_artifact(group_id);
CREATE INDEX idx_{artifact}s_mcp ON {artifact}_artifact(mcp);
```

**All 17 artifact tables follow this exact structure.**

### Resource Tables

**Standard Structure:**
```sql
CREATE TABLE {resource}_resource (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    -- Resource-specific columns (e.g., name, description, content, etc.)
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    active boolean NOT NULL DEFAULT true,
    generated boolean NOT NULL DEFAULT false,
    call_id uuid NOT NULL REFERENCES calls(id),
    mcp boolean NOT NULL DEFAULT false
);

-- Standard Indexes
CREATE INDEX {resource}_call_id_idx ON {resource}_resource(call_id) WHERE call_id IS NOT NULL;
CREATE INDEX idx_{resource}_mcp ON {resource}_resource(mcp);
-- Resource-specific indexes (e.g., name, unique constraints, etc.)
```

**⚠️ CRITICAL: All resource tables have `call_id NOT NULL`**

### Junction Tables

**Standard Structure:**
```sql
CREATE TABLE {artifact}_{resource} (
    {artifact}_id uuid NOT NULL REFERENCES {artifact}_artifact(id) ON DELETE CASCADE,
    {resource}_id uuid NOT NULL REFERENCES {resource}_resource(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    generated boolean NOT NULL DEFAULT false,
    mcp boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    PRIMARY KEY ({artifact}_id, {resource}_id)
);

-- Standard Indexes
CREATE INDEX {artifact}_{resource}_{artifact}_id_idx ON {artifact}_{resource}({artifact}_id);
CREATE INDEX {artifact}_{resource}_{resource}_id_idx ON {artifact}_{resource}({resource}_id);
CREATE INDEX idx_{artifact}_{resource}_generated ON {artifact}_{resource}(generated);
CREATE INDEX idx_{artifact}_{resource}_mcp ON {artifact}_{resource}(mcp);
```

**⚠️ CRITICAL: Junction tables do NOT have `call_id` - only resource tables have `call_id`**

**Special Cases:**
- Some junction tables have additional columns (e.g., `agent_flags` has `value boolean`)
- Some junction tables don't have `active` column (rare, but exists)
- Some junction tables link to non-resource tables (e.g., `cohort_profiles` links to `profile_artifact`)

### Other Tables

**Groups Table:**
```sql
CREATE TABLE groups (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    trace_id text NOT NULL DEFAULT gen_trace_id(),
    -- Other columns
);
```

**Calls Table:**
```sql
CREATE TABLE calls (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    created_at timestamptz NOT NULL DEFAULT now(),
    tool_id uuid REFERENCES tool_artifact(id),
    run_id uuid REFERENCES runs(id),
    -- Other columns
);
```

**Runs Table:**
```sql
CREATE TABLE runs (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    created_at timestamptz NOT NULL DEFAULT now(),
    agent_id uuid REFERENCES agent_artifact(id),
    -- Other columns
);
```

---

## Composite Types in `types` Schema

### Purpose

Composite types provide **strongly typed nested structures** for API/WebSocket responses. They replace JSONB and ensure type safety at the database level.

### Naming Convention

**Pattern:** `types.q_{operation}_{resource}_v4_{item_name}`

**Examples:**
- `types.q_get_persona_v4_name_resource`
- `types.q_get_persona_v4_color_option`
- `types.q_list_agents_v4_agent`
- `types.q_get_scenario_v4_question`

### Versioning

**Always include version in type names** (e.g., `v5`) for future compatibility and migration support.

### Type Preservation

**Use native PostgreSQL types** (`uuid`, `timestamptz`) instead of `text` when possible:

```sql
-- ✅ Good: Native types
CREATE TYPE types.q_get_persona_v4_name_resource AS (
    id uuid,                -- Not text!
    name text,
    generated boolean,
    group_id uuid           -- Not text!
);

-- ❌ Bad: Stringified types
CREATE TYPE types.q_get_persona_v4_name_resource AS (
    id text,                -- Should be uuid
    name text,
    generated boolean,
    group_id text           -- Should be uuid
);
```

**When to use `text`:**
- Arrays of IDs for frontend compatibility: `department_ids text[]` (when frontend expects string arrays)
- Display-only fields: `actor_name text` (always a string, never a UUID)
- Enum-like values: `role text` (when representing enum values as strings)

### Type System Handling

**Automatic conversion:**
- `asyncpg` automatically converts PostgreSQL `uuid` → Python `UUID` objects
- `asyncpg` automatically converts PostgreSQL `timestamptz` → Python `datetime` objects
- Pydantic models validate and serialize these types correctly
- Use `model_dump(mode='json')` for caching to serialize UUIDs/timestamps to JSON

### Composite Type Structure

**Resource Composite Types Include:**
- `id uuid` - Resource ID
- Resource-specific fields (e.g., `name text`, `description text`, `hex_code text`)
- `generated boolean` - Whether resource was AI-generated
- `group_id uuid` (nullable) - Group ID for regeneration support

**Example:**
```sql
CREATE TYPE types.q_get_persona_v4_color_resource AS (
    id uuid,
    name text,
    description text,
    hex_code text,
    generated boolean,
    group_id uuid
);
```

---

## Migration Patterns

### Manual SQL Files

**Location:** `database/migrate/` folder

**Naming:** `{number}_{description}.sql` (e.g., `276_spec_alignment_cohorts_profiles_documents_evals_rubrics_scenarios_simulations_tools.sql`)

**No ORM migrations** - all migrations are manual SQL files.

### Idempotent Migrations

**Pattern:** `BEGIN; DROP FUNCTION; DROP TYPE; CREATE TYPE; CREATE FUNCTION; COMMIT;`

**Example:**
```sql
BEGIN;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_persona_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types if exists
DROP TYPE IF EXISTS types.q_get_persona_v4_name_resource CASCADE;
DROP TYPE IF EXISTS types.q_get_persona_v4_color_resource CASCADE;

-- Create types
CREATE TYPE types.q_get_persona_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean,
    group_id uuid
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_persona_v4(
    persona_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    -- ... return structure
)
LANGUAGE sql
STABLE
AS $$
    -- ... SQL body
$$;

COMMIT;
```

### Conditional DDL

**Pattern:** `DO $$ BEGIN ... END $$` blocks for conditional DDL

**Example:**
```sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'new_table') THEN
        CREATE TABLE new_table (
            id uuid PRIMARY KEY DEFAULT uuidv7(),
            -- ... columns
        );
        RAISE NOTICE 'Created new_table';
    ELSE
        RAISE NOTICE 'new_table already exists';
    END IF;
END $$;
```

### Migration Workflow

1. **Make schema changes** directly to the database (via migrations or direct SQL)
2. **Export updated schema**: `make export-db schema` to generate `schema.sql`
3. **Create migration file**: Create new SQL file in `database/migrate/` folder
4. **Write migration SQL**: Use `DO $$ BEGIN ... END $$` blocks for conditional DDL
5. **Apply migration**: `make migrate-db`
6. **Restart services**: `make stop && make run`

**Note:** Migrations are manual SQL files. Server uses asyncpg for all database operations. Database is the source of truth - `schema.sql` is generated from the live database.

---

## Database-Specific Gotchas

### Junction Table `active` Flag

**Pattern:** Most junction tables have an `active boolean` column, but some don't.

**Check before querying:**
```sql
-- ✅ Good: Check if active column exists
SELECT 
    {artifact}_id,
    {resource}_id
FROM {artifact}_{resource}
WHERE active = true  -- Only if column exists
  AND {artifact}_id = $1;
```

**Common pattern:** Use `active = true` filter when column exists, otherwise don't filter.

### `call_id` Tracking

**⚠️ CRITICAL: `call_id` is required on resources, NOT NULL**

**Pattern:**
- All resource tables have `call_id uuid NOT NULL REFERENCES calls(id)`
- Junction tables do NOT have `call_id`
- `call_id` links resources to the call that created them
- `call_id` enables regeneration support (via `calls.run_id → group_runs.group_id`)

**Query pattern:**
```sql
-- Get group_id for resource regeneration
SELECT gr.group_id
FROM {resource}_resource r
JOIN calls c ON c.id = r.call_id
JOIN message_calls mc ON mc.call_id = c.id
JOIN message_runs mr ON mr.message_id = mc.message_id
JOIN group_runs gr ON gr.run_id = mr.run_id
WHERE r.id = $1;
```

### `group_id` Tracking

**Pattern:**
- Artifact tables have `group_id uuid NOT NULL REFERENCES groups(id)`
- Resource composite types include `group_id uuid` (nullable) for regeneration support
- `group_id` is obtained via `resource.call_id → calls.run_id → group_runs.group_id`
- `group_id` enables regeneration workflows

**Query pattern:**
```sql
-- Get group_id for resource (for regeneration)
SELECT 
    r.id,
    r.name,
    r.generated,
    gr.group_id  -- From groups table via call chain
FROM {resource}_resource r
LEFT JOIN calls c ON c.id = r.call_id
LEFT JOIN message_calls mc ON mc.call_id = c.id
LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
WHERE r.id = $1;
```

### `generated` and `mcp` Flags

**Pattern:**
- Both flags are `boolean NOT NULL DEFAULT false`
- `generated`: Indicates if resource/artifact was AI-generated
- `mcp`: Indicates if resource/artifact was created via MCP (Model Context Protocol)
- Flags are on artifact tables, resource tables, and junction tables

**Query pattern:**
```sql
-- Filter by generated flag
SELECT *
FROM {resource}_resource
WHERE generated = true;

-- Filter by mcp flag
SELECT *
FROM {resource}_resource
WHERE mcp = true;
```

### Foreign Key CASCADE Behavior

**Pattern:**
- **Junction tables**: `ON DELETE CASCADE` (when artifact/resource deleted, remove links)
- **Resource references**: `ON DELETE CASCADE` (when resource deleted, remove from artifacts)
- **Parent-child relationships**: `ON DELETE CASCADE` or `ON DELETE SET NULL` based on business logic

**Example:**
```sql
-- ✅ Good: CASCADE on junction table
CREATE TABLE agent_names (
    agent_id uuid NOT NULL REFERENCES agent_artifact(id) ON DELETE CASCADE,
    name_id uuid NOT NULL REFERENCES names_resource(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, name_id)
);

-- When agent_artifact is deleted, all agent_names rows are automatically deleted
-- When names_resource is deleted, all agent_names rows referencing it are automatically deleted
```

### Index Patterns

**Standard Indexes:**

**Artifact Tables:**
- Primary key on `id`
- Index on `group_id`
- Unique index on `group_id` (if applicable)
- Index on `mcp`

**Resource Tables:**
- Primary key on `id`
- Index on `call_id` (partial: `WHERE call_id IS NOT NULL`)
- Index on `mcp`
- Resource-specific indexes (e.g., `name`, unique constraints)

**Junction Tables:**
- Composite primary key on `({artifact}_id, {resource}_id)`
- Index on `{artifact}_id`
- Index on `{resource}_id`
- Index on `generated`
- Index on `mcp`

**Example:**
```sql
-- Artifact table indexes
CREATE INDEX agent_group_id_idx ON agent_artifact(group_id);
CREATE UNIQUE INDEX agent_group_id_unique ON agent_artifact(group_id);
CREATE INDEX idx_agents_mcp ON agent_artifact(mcp);

-- Resource table indexes
CREATE INDEX names_call_id_idx ON names_resource(call_id) WHERE call_id IS NOT NULL;
CREATE INDEX names_name_idx ON names_resource(name);
CREATE UNIQUE INDEX names_name_unique ON names_resource(name);
CREATE INDEX idx_names_mcp ON names_resource(mcp);

-- Junction table indexes
CREATE INDEX agent_names_agent_id_idx ON agent_names(agent_id);
CREATE INDEX agent_names_name_id_idx ON agent_names(name_id);
CREATE INDEX idx_agent_names_generated ON agent_names(generated);
CREATE INDEX idx_agent_names_mcp ON agent_names(mcp);
```

---

## Schema Organization

### Public Schema

**Main application tables:**
- Artifact tables (`{artifact}_artifact`)
- Resource tables (`{resource}_resource`)
- Junction tables (`{artifact}_{resource}`)
- Other operational tables (`groups`, `calls`, `runs`, `messages`, etc.)

### Types Schema

**Composite types for API/WebSocket responses:**
- `types.q_{operation}_{resource}_v4_{item_name}`

**Purpose:**
- Strongly typed nested structures
- Replace JSONB with composite types
- Enable type generation from SQL introspection

### Enum Types

**Core Enums:**
- `artifacts` - 17 core artifacts
- `resources` - 75+ resources
- `agent_role` - Agent roles (hint, grade, simulation, etc.)
- `profile_role` - Profile roles (admin, superadmin, user, etc.)
- `message_role` - Message roles (user, assistant, system, developer)
- `pricing_type`, `feedback_type`, `message_feedback_type`, `modality_type`, `option_type`, `quality`, `reasoning_effort`, `tool_type`, `unit_category`, `voice`

**Usage:**
```sql
-- Strong enum comparisons
WHERE a.role = 'grade'::agent_role
WHERE p.role = 'superadmin'::profile_role
WHERE m.role = 'user'::message_role

-- Never compare enums to raw strings (weak comparison)
-- ❌ Bad: WHERE a.role = 'grade'  -- No cast!
```

### Function Organization

**PostgreSQL functions in SQL files:**
- Location: `server/app/sql/[resource]/[operation]_complete.sql`
- One SQL file per function
- Functions follow naming: `api_{operation}_{resource}_v4(...)`
- Functions use `RETURNS TABLE` with composite types

---

## Database Query Patterns

### Artifact Lookups with Resources

**Pattern:** Join artifact table with junction tables and resource tables

**Example:**
```sql
SELECT 
    a.id as agent_id,
    a.group_id,
    n.id as name_id,
    n.name,
    n.generated as name_generated,
    d.id as description_id,
    d.description,
    d.generated as description_generated
FROM agent_artifact a
LEFT JOIN agent_names an ON an.agent_id = a.id AND an.active = true
LEFT JOIN names_resource n ON n.id = an.name_id AND n.active = true
LEFT JOIN agent_descriptions ad ON ad.agent_id = a.id AND ad.active = true
LEFT JOIN descriptions_resource d ON d.id = ad.description_id AND d.active = true
WHERE a.id = $1;
```

### Resource Lookups with Suggestions

**Pattern:** Get resources with suggestions based on usage and generation

**Example:**
```sql
-- Get name suggestions (linked to personas + same group)
WITH name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pn.name_id ORDER BY pn.created_at DESC)
             FROM (
                 SELECT DISTINCT pn.name_id, MAX(pn.created_at) as created_at
                 FROM persona_names pn
                 JOIN names_resource n ON n.id = pn.name_id
                 WHERE pn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to personas (validated by usage)
                       pn.generated = false
                       OR
                       -- Option 2: OR linked to same group with generated=true
                       (
                           pn.generated = true
                           AND n.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = n.call_id
                                 AND gr.group_id = $1  -- Current group_id
                           )
                       )
                   )
                 GROUP BY pn.name_id
                 ORDER BY MAX(pn.created_at) DESC
                 LIMIT 20
             ) pn),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM (SELECT 1) x
    LIMIT 1
)
SELECT name_suggestions FROM name_suggestions_data;
```

### Junction Table Queries with Active Filtering

**Pattern:** Filter by `active` flag when column exists

**Example:**
```sql
-- Get active department links
SELECT 
    d.department_id,
    dept.group_id as department_group_id
FROM persona_departments d
JOIN department_artifact dept ON dept.id = d.department_id
WHERE d.persona_id = $1
  AND d.active = true  -- Filter by active flag
  AND EXISTS (
      -- Also check department has active flag
      SELECT 1 FROM department_flags df 
      JOIN flags_resource fl ON fl.id = df.flag_id
      WHERE df.department_id = d.department_id
        AND fl.name = 'active'
        AND df.value = true
        AND df.active = true
  );
```

### Composite Type Construction in SQL

**Pattern:** Use `ROW(...)::types.composite_type` to construct composite types

**Example:**
```sql
SELECT 
    a.id as agent_id,
    ROW(
        n.id,
        n.name,
        n.generated,
        gr.group_id  -- From groups table via call chain
    )::types.q_get_agent_v4_name_resource as name_resource
FROM agent_artifact a
LEFT JOIN agent_names an ON an.agent_id = a.id AND an.active = true
LEFT JOIN names_resource n ON n.id = an.name_id AND n.active = true
LEFT JOIN calls c ON c.id = n.call_id
LEFT JOIN message_calls mc ON mc.call_id = c.id
LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
WHERE a.id = $1;
```

### Array Aggregation Patterns

**Pattern:** Use `ARRAY_AGG(...)::types.composite_type[]` instead of `json_agg(...)`

**Example:**
```sql
-- ✅ Good: Composite type array
SELECT 
    a.id as agent_id,
    COALESCE(
        ARRAY_AGG(
            ROW(
                n.id,
                n.name,
                n.generated,
                gr.group_id
            )::types.q_get_agent_v4_name_resource
            ORDER BY an.created_at
        ) FILTER (WHERE n.id IS NOT NULL),
        '{}'::types.q_get_agent_v4_name_resource[]
    ) as names
FROM agent_artifact a
LEFT JOIN agent_names an ON an.agent_id = a.id AND an.active = true
LEFT JOIN names_resource n ON n.id = an.name_id AND n.active = true
LEFT JOIN calls c ON c.id = n.call_id
LEFT JOIN message_calls mc ON mc.call_id = c.id
LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
WHERE a.id = $1
GROUP BY a.id;

-- ❌ Bad: JSONB aggregation (NEVER ALLOWED)
SELECT 
    json_agg(
        jsonb_build_object(
            'id', n.id,
            'name', n.name
        )
    ) as names
FROM ...
```

---

## Summary

This document provides a comprehensive reference for database design in GLOW:

1. **17 Core Artifacts** - Base tables for core graph components
2. **75+ Resources** - Shared components used by artifacts
3. **147+ Artifact-Resource Pairs** - Mappings between artifacts and resources
4. **Standardized Table Structures** - Consistent patterns across all tables
5. **Composite Types** - Strongly typed nested structures (never JSONB)
6. **Migration Patterns** - Idempotent migrations with conditional DDL
7. **Database-Specific Gotchas** - Common pitfalls and solutions
8. **Query Patterns** - Standard patterns for common operations

**Key Principles:**
- BCNF normalization (Chris Date principles)
- No nulls policy (minimize nulls, use defaults)
- Referential integrity (foreign keys with CASCADE)
- Composite types (never JSONB)
- Type preservation (native PostgreSQL types)

**For general architectural patterns, see [AGENTS.md](./AGENTS.md).**
**For deployment and tech stack, see [README.md](./README.md).**
