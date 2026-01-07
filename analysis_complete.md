# Complete Graph Components & Artifacts/Resources Analysis

This document contains the complete analysis of:
1. Denormalizing 17 core graph components with junction tables
2. Converting all objects to artifacts with singular names
3. Converting all related tables to resources
4. Shared resources strategy for reusable UI components
5. Consolidated junction tables with type enums to reduce table explosion

**Key Concepts**:
- **Artifacts are singular**: All artifact enum values are singular (scenario, persona, document, field, profile)
- **Resources are plural**: Resources are the plural form of table names (personas, departments, emails, names)
- **Junction tables**: Follow `{artifact}_{resource}` pattern where artifact is singular and resource is plural (e.g., `scenario_personas`, `profile_departments`)
- **Artifacts can be resources**: An entity can be both an artifact (top-level, singular) AND a resource (when referenced by another artifact, plural). Example: `personas` table → artifact `persona` (singular), resource `personas` (plural when referenced by `scenario`)
- **Shared resources**: Resources that represent reusable UI components (colors, flags, icons, content) - see `analysis_shared_resources_strategy.md` for details
- **Consolidated junction tables**: When multiple junction tables would link the same artifact to the same resource type, consolidate into a single junction table with a `type` enum column (e.g., `scenario_flags` with `type_scenario_flags` enum, `eval_flags` with `type_eval_flags` enum, `simulation_domains` with `type_simulation_domains` enum)

---

# Graph Components Denormalization Analysis

## Overview

Analysis of the 17 core graph components from the `draft_resource_type` enum (excluding `benchmark` and `practice` as they are aliases for `scenario` and `eval`).

## Core 17 Graph Components

1. cohorts
2. simulations
3. scenarios
4. personas
5. documents
6. parameters
7. fields
8. agents
9. models
10. rubrics
11. evals
12. departments
13. providers
14. auth
15. keys
16. settings
17. profiles

**Note**: All 17 tables exist in the database.

## Current State: Fully Denormalized Objects

**Answer: 0 out of 17 objects are fully denormalized**

All 16 objects currently have attributes stored directly in the main table (beyond `id`, `created_at`, `updated_at`).

## Current Attribute Breakdown

| Object | Total Columns | Attribute Columns | Attributes |
|--------|--------------|-------------------|------------|
| agents | 7 | 4 | name, description, active, model_id |
| auth | 9 | 6 | name, description, active, auth_type, slug, icon_url |
| cohorts | 6 | 3 | title, description, active |
| departments | 6 | 3 | title, description, active |
| documents | 10 | 7 | name, active, description, template, document_domain_id, document_content |
| evals | 8 | 5 | name, description, active, dynamic, use_groups |
| fields | 7 | 4 | name, description, active, parameter_id |
| keys | 7 | 4 | key, active, name, description |
| models | 8 | 5 | name, description, active, value, provider_id |
| parameters | 11 | 8 | name, description, active, document_parameter, persona_parameter, scenario_parameter, video_parameter, simulation_parameter |
| personas | 9 | 6 | name, description, color, icon, active, instructions |
| providers | 7 | 4 | name, description, value, active |
| rubrics | 10 | 7 | name, description, points, pass_points, active, rubric_domain_id, artifact |
| scenarios | 15 | 12 | name, generated, active, objectives_enabled, images_enabled, video_enabled, questions_enabled, description, problem_statement_enabled, scenario_domain_id, video_domain_id, image_domain_id |
| settings | 23 | 21 | active, primary_color, accent, background, surface, success, warning, error, sidebar_background, sidebar_primary, chart1, chart2, chart3, chart4, chart5, guest_login_enabled, name, description, success_threshold, warning_threshold, danger_threshold |
| simulations | 9 | 6 | title, description, active, practice_simulation, simulation_text_domain_id, simulation_voice_domain_id |
| profiles | 8 | 5 | first_name, last_name, role, active, last_login |

## Existing Junction Tables

Many objects already have junction tables for **relationships** (many-to-many), but **not for attributes**:

### Examples of Existing Junction Tables:
- `scenario_departments` - links scenarios to departments
- `scenario_documents` - links scenarios to documents
- `scenario_personas` - links scenarios to personas
- `persona_departments` - links personas to departments
- `agent_departments` - links agents to departments
- `eval_agents` - links evals to agents
- `document_fields` - links documents to fields
- `parameter_departments` - links parameters to departments
- And many more...

**Total existing junction tables**: 92 tables (many are for relationships, not attributes)

## Junction Tables Summary by Object

| Object | Text Junctions | Boolean Junctions | Numeric Junctions | Enum Junctions | FK Junctions | Total |
|--------|---------------|-------------------|-------------------|----------------|--------------|-------|
| cohorts | 2 (name, description) | 1 (active) | 0 | 0 | 0 | 3 |
| simulations | 2 (name, description) | 2 (active, practice_simulation) | 0 | 0 | 2 (text_domain, voice_domain) | 6 |
| scenarios | 1 (name, description) | 6 (active, generated, objectives_enabled, images_enabled, video_enabled, questions_enabled, problem_statement_enabled) | 0 | 0 | 3 (domain, video_domain, image_domain) | 10 |
| personas | 4 (name, description, color, icon) | 1 (active) | 0 | 0 | 0 | 5 |
| documents | 3 (name, description, document_content) | 2 (active, template) | 0 | 0 | 1 (domain) | 6 |
| parameters | 2 (name, description) | 6 (active, document_parameter, persona_parameter, scenario_parameter, video_parameter, simulation_parameter) | 0 | 0 | 0 | 8 |
| fields | 2 (name, description) | 1 (active) | 0 | 0 | 1 (parameter) | 4 |
| agents | 2 (name, description) | 1 (active) | 0 | 0 | 1 (model) | 4 |
| models | 3 (name, description, value) | 1 (active) | 0 | 0 | 1 (provider) | 5 |
| rubrics | 2 (name, description) | 1 (active) | 2 (points, pass_points) | 1 (artifact) | 1 (domain) | 7 |
| evals | 2 (name, description) | 3 (active, dynamic, use_groups) | 0 | 0 | 0 | 5 |
| departments | 2 (name, description) | 1 (active) | 0 | 0 | 0 | 3 |
| providers | 3 (name, description, value) | 1 (active) | 0 | 0 | 0 | 4 |
| auth | 4 (name, description, slug, icon_url) | 1 (active) | 0 | 1 (auth_type) | 0 | 6 |
| keys | 3 (name, description, key) | 1 (active) | 0 | 0 | 0 | 4 |
| settings | 2 (name, description) + 13 colors | 2 (active, guest_login_enabled) | 3 (thresholds) | 0 | 0 | 20 |
| profiles | 2 (first_name, last_name) | 1 (active) | 0 | 1 (role) | 0 | 4 |
| **TOTAL** | **~60** | **~35** | **~5** | **~3** | **~10** | **~113** |

**Note**: Settings has 13 color attributes (primary_color, accent, background, surface, success, warning, error, sidebar_background, sidebar_primary, chart1-5) which each get their own junction table.

## Proposed Solution: DHH-Style Attribute Tables with Junction Tables

### Strategy: One Table Per Attribute Type (DHH Approach)

Following the DHH (David Heinemeier Hansson) "boring" approach - simple, straightforward, one table per attribute type. No shared attribute tables, just clean separation.

### 1. Attribute Tables (One Per Attribute Type)

#### Text Attribute Tables

```sql
-- Names table (used by 13 objects)
CREATE TABLE names (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX names_value_idx ON names(value);

-- Descriptions table (used by 16 objects)
CREATE TABLE descriptions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX descriptions_value_idx ON descriptions(value);

-- Note: Titles merged into names - cohorts, departments, simulations all use 'name' attribute

-- Slugs table (used by auth)
CREATE TABLE slugs (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX slugs_value_idx ON slugs(value);

-- Icon URLs table (used by auth)
CREATE TABLE icon_urls (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX icon_urls_value_idx ON icon_urls(value);

-- Colors table (used by personas, settings)
CREATE TABLE colors (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX colors_value_idx ON colors(value);

-- Icons table (used by personas)
CREATE TABLE icons (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX icons_value_idx ON icons(value);

-- Instructions table (used by personas)
CREATE TABLE instructions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX instructions_value_idx ON instructions(value);

-- Document content table (used by documents - renamed from 'content' to avoid conflict with existing content table)
CREATE TABLE document_contents (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX document_contents_value_idx ON document_contents(value);

-- Keys table (used by keys - note: keys table already exists, this would be for the 'key' attribute)
CREATE TABLE key_values (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX key_values_value_idx ON key_values(value);

-- Values table (used by models, providers)
CREATE TABLE values (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX values_value_idx ON values(value);

-- First names table (used by profiles)
CREATE TABLE first_names (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX first_names_value_idx ON first_names(value);

-- Last names table (used by profiles)
CREATE TABLE last_names (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX last_names_value_idx ON last_names(value);
```

#### Boolean Attribute Tables

```sql
-- Active flags table (used by all 17 objects)
CREATE TABLE active_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX active_flags_value_idx ON active_flags(value);

-- Template flags table (used by documents)
CREATE TABLE template_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX template_flags_value_idx ON template_flags(value);

-- Generated flags table (used by scenarios)
CREATE TABLE generated_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX generated_flags_value_idx ON generated_flags(value);

-- Dynamic flags table (used by evals)
CREATE TABLE dynamic_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX dynamic_flags_value_idx ON dynamic_flags(value);

-- Use groups flags table (used by evals)
CREATE TABLE use_groups_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX use_groups_flags_value_idx ON use_groups_flags(value);

-- Practice simulation flags table (used by simulations)
CREATE TABLE practice_simulation_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX practice_simulation_flags_value_idx ON practice_simulation_flags(value);

-- Guest login enabled flags table (used by settings)
CREATE TABLE guest_login_enabled_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX guest_login_enabled_flags_value_idx ON guest_login_enabled_flags(value);

-- Objectives enabled flags table (used by scenarios)
CREATE TABLE objectives_enabled_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX objectives_enabled_flags_value_idx ON objectives_enabled_flags(value);

-- Images enabled flags table (used by scenarios)
CREATE TABLE images_enabled_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX images_enabled_flags_value_idx ON images_enabled_flags(value);

-- Video enabled flags table (used by scenarios)
CREATE TABLE video_enabled_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX video_enabled_flags_value_idx ON video_enabled_flags(value);

-- Questions enabled flags table (used by scenarios)
CREATE TABLE questions_enabled_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX questions_enabled_flags_value_idx ON questions_enabled_flags(value);

-- Problem statement enabled flags table (used by scenarios)
CREATE TABLE problem_statement_enabled_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX problem_statement_enabled_flags_value_idx ON problem_statement_enabled_flags(value);

-- Parameter boolean flags (used by parameters)
CREATE TABLE document_parameter_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX document_parameter_flags_value_idx ON document_parameter_flags(value);

CREATE TABLE persona_parameter_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX persona_parameter_flags_value_idx ON persona_parameter_flags(value);

CREATE TABLE scenario_parameter_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX scenario_parameter_flags_value_idx ON scenario_parameter_flags(value);

CREATE TABLE video_parameter_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX video_parameter_flags_value_idx ON video_parameter_flags(value);

CREATE TABLE simulation_parameter_flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value BOOLEAN NOT NULL UNIQUE
);
CREATE INDEX simulation_parameter_flags_value_idx ON simulation_parameter_flags(value);
```

#### Numeric Attribute Tables

```sql
-- Points table (used by rubrics)
CREATE TABLE points (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value INTEGER NOT NULL UNIQUE
);
CREATE INDEX points_value_idx ON points(value);

-- Pass points table (used by rubrics)
CREATE TABLE pass_points (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value INTEGER NOT NULL UNIQUE
);
CREATE INDEX pass_points_value_idx ON pass_points(value);

-- Success thresholds table (used by settings)
CREATE TABLE success_thresholds (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value INTEGER NOT NULL UNIQUE
);
CREATE INDEX success_thresholds_value_idx ON success_thresholds(value);

-- Warning thresholds table (used by settings)
CREATE TABLE warning_thresholds (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value INTEGER NOT NULL UNIQUE
);
CREATE INDEX warning_thresholds_value_idx ON warning_thresholds(value);

-- Danger thresholds table (used by settings)
CREATE TABLE danger_thresholds (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value INTEGER NOT NULL UNIQUE
);
CREATE INDEX danger_thresholds_value_idx ON danger_thresholds(value);
```

#### Enum Attribute Tables

```sql
-- Auth types table (used by auth)
CREATE TABLE auth_types (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX auth_types_value_idx ON auth_types(value);

-- Artifacts table (used by rubrics)
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX artifacts_value_idx ON artifacts(value);

-- Profile roles table (used by profiles)
CREATE TABLE profile_roles (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TEXT NOT NULL UNIQUE
);
CREATE INDEX profile_roles_value_idx ON profile_roles(value);
```

#### Timestamp Attribute Tables

```sql
-- Last logins table (used by profiles)
CREATE TABLE last_logins (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value TIMESTAMPTZ NOT NULL UNIQUE
);
CREATE INDEX last_logins_value_idx ON last_logins(value);
```

### 2. Proposed Junction Tables

#### Pattern: `[object]_[attribute_type]`

Each junction table links an object to its specific attribute table. Simple, straightforward, boring DHH approach.

#### Text Attribute Junctions

```sql
-- Name junctions (13 objects use 'name')
CREATE TABLE cohort_names (cohort_id UUID REFERENCES cohorts(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (cohort_id, name_id));
CREATE TABLE scenario_names (scenario_id UUID REFERENCES scenarios(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (scenario_id, name_id));
CREATE TABLE persona_names (persona_id UUID REFERENCES personas(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (persona_id, name_id));
CREATE TABLE document_names (document_id UUID REFERENCES documents(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (document_id, name_id));
CREATE TABLE parameter_names (parameter_id UUID REFERENCES parameters(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (parameter_id, name_id));
CREATE TABLE field_names (field_id UUID REFERENCES fields(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (field_id, name_id));
CREATE TABLE agent_names (agent_id UUID REFERENCES agents(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (agent_id, name_id));
CREATE TABLE model_names (model_id UUID REFERENCES models(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (model_id, name_id));
CREATE TABLE rubric_names (rubric_id UUID REFERENCES rubrics(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (rubric_id, name_id));
CREATE TABLE eval_names (eval_id UUID REFERENCES evals(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (eval_id, name_id));
CREATE TABLE provider_names (provider_id UUID REFERENCES providers(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (provider_id, name_id));
CREATE TABLE auth_names (auth_id UUID REFERENCES auth(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (auth_id, name_id));
CREATE TABLE key_names (key_id UUID REFERENCES keys(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (key_id, name_id));
CREATE TABLE setting_names (settings_id UUID REFERENCES settings(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, name_id));

-- Name junctions (cohorts, departments, simulations use 'name' instead of 'title')
CREATE TABLE cohort_names (cohort_id UUID REFERENCES cohorts(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (cohort_id, name_id));
CREATE TABLE department_names (department_id UUID REFERENCES departments(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (department_id, name_id));
CREATE TABLE simulation_names (simulation_id UUID REFERENCES simulations(id), name_id UUID REFERENCES names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (simulation_id, name_id));

-- Description junctions (16 objects use 'description')
CREATE TABLE cohort_descriptions (cohort_id UUID REFERENCES cohorts(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (cohort_id, description_id));
CREATE TABLE simulation_descriptions (simulation_id UUID REFERENCES simulations(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (simulation_id, description_id));
CREATE TABLE scenario_descriptions (scenario_id UUID REFERENCES scenarios(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (scenario_id, description_id));
CREATE TABLE persona_descriptions (persona_id UUID REFERENCES personas(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (persona_id, description_id));
CREATE TABLE document_descriptions (document_id UUID REFERENCES documents(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (document_id, description_id));
CREATE TABLE parameter_descriptions (parameter_id UUID REFERENCES parameters(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (parameter_id, description_id));
CREATE TABLE field_descriptions (field_id UUID REFERENCES fields(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (field_id, description_id));
CREATE TABLE agent_descriptions (agent_id UUID REFERENCES agents(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (agent_id, description_id));
CREATE TABLE model_descriptions (model_id UUID REFERENCES models(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (model_id, description_id));
CREATE TABLE rubric_descriptions (rubric_id UUID REFERENCES rubrics(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (rubric_id, description_id));
CREATE TABLE eval_descriptions (eval_id UUID REFERENCES evals(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (eval_id, description_id));
CREATE TABLE department_descriptions (department_id UUID REFERENCES departments(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (department_id, description_id));
CREATE TABLE provider_descriptions (provider_id UUID REFERENCES providers(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (provider_id, description_id));
CREATE TABLE auth_descriptions (auth_id UUID REFERENCES auth(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (auth_id, description_id));
CREATE TABLE key_descriptions (key_id UUID REFERENCES keys(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (key_id, description_id));
CREATE TABLE setting_descriptions (settings_id UUID REFERENCES settings(id), description_id UUID REFERENCES descriptions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, description_id));

-- Other text attribute junctions
CREATE TABLE auth_slugs (auth_id UUID REFERENCES auth(id), slug_id UUID REFERENCES slugs(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (auth_id, slug_id));
CREATE TABLE auth_icon_urls (auth_id UUID REFERENCES auth(id), icon_url_id UUID REFERENCES icon_urls(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (auth_id, icon_url_id));
CREATE TABLE persona_colors (persona_id UUID REFERENCES personas(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (persona_id, color_id));
CREATE TABLE persona_icons (persona_id UUID REFERENCES personas(id), icon_id UUID REFERENCES icons(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (persona_id, icon_id));
CREATE TABLE persona_instructions (persona_id UUID REFERENCES personas(id), instruction_id UUID REFERENCES instructions(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (persona_id, instruction_id));
CREATE TABLE document_document_contents (document_id UUID REFERENCES documents(id), document_content_id UUID REFERENCES document_contents(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (document_id, document_content_id));
CREATE TABLE key_keys (key_id UUID REFERENCES keys(id), key_value_id UUID REFERENCES key_values(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (key_id, key_value_id));
CREATE TABLE model_values (model_id UUID REFERENCES models(id), value_id UUID REFERENCES values(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (model_id, value_id));
CREATE TABLE provider_values (provider_id UUID REFERENCES providers(id), value_id UUID REFERENCES values(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (provider_id, value_id));
CREATE TABLE profile_first_names (profile_id UUID REFERENCES profiles(id), first_name_id UUID REFERENCES first_names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (profile_id, first_name_id));
CREATE TABLE profile_last_names (profile_id UUID REFERENCES profiles(id), last_name_id UUID REFERENCES last_names(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (profile_id, last_name_id));

-- Settings color junctions (13 color attributes)
CREATE TABLE setting_primary_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
CREATE TABLE setting_accent_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
CREATE TABLE setting_background_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
CREATE TABLE setting_surface_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
CREATE TABLE setting_success_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
CREATE TABLE setting_warning_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
CREATE TABLE setting_error_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
CREATE TABLE setting_sidebar_background_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
CREATE TABLE setting_sidebar_primary_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
CREATE TABLE setting_chart1_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
CREATE TABLE setting_chart2_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
CREATE TABLE setting_chart3_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
CREATE TABLE setting_chart4_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
CREATE TABLE setting_chart5_colors (settings_id UUID REFERENCES settings(id), color_id UUID REFERENCES colors(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, color_id));
```

#### Boolean Flag Junctions

```sql
-- Active flag junctions (17 objects use 'active')
CREATE TABLE cohort_active_flags (cohort_id UUID REFERENCES cohorts(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (cohort_id, active_flag_id));
CREATE TABLE simulation_active_flags (simulation_id UUID REFERENCES simulations(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (simulation_id, active_flag_id));
CREATE TABLE scenario_active_flags (scenario_id UUID REFERENCES scenarios(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (scenario_id, active_flag_id));
CREATE TABLE persona_active_flags (persona_id UUID REFERENCES personas(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (persona_id, active_flag_id));
CREATE TABLE document_active_flags (document_id UUID REFERENCES documents(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (document_id, active_flag_id));
CREATE TABLE parameter_active_flags (parameter_id UUID REFERENCES parameters(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (parameter_id, active_flag_id));
CREATE TABLE field_active_flags (field_id UUID REFERENCES fields(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (field_id, active_flag_id));
CREATE TABLE agent_active_flags (agent_id UUID REFERENCES agents(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (agent_id, active_flag_id));
CREATE TABLE model_active_flags (model_id UUID REFERENCES models(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (model_id, active_flag_id));
CREATE TABLE rubric_active_flags (rubric_id UUID REFERENCES rubrics(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (rubric_id, active_flag_id));
CREATE TABLE eval_active_flags (eval_id UUID REFERENCES evals(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (eval_id, active_flag_id));
CREATE TABLE department_active_flags (department_id UUID REFERENCES departments(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (department_id, active_flag_id));
CREATE TABLE provider_active_flags (provider_id UUID REFERENCES providers(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (provider_id, active_flag_id));
CREATE TABLE auth_active_flags (auth_id UUID REFERENCES auth(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (auth_id, active_flag_id));
CREATE TABLE key_active_flags (key_id UUID REFERENCES keys(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (key_id, active_flag_id));
CREATE TABLE setting_active_flags (settings_id UUID REFERENCES settings(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, active_flag_id));
CREATE TABLE profile_active_flags (profile_id UUID REFERENCES profiles(id), active_flag_id UUID REFERENCES active_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (profile_id, active_flag_id));

-- Other boolean flag junctions
CREATE TABLE document_template_flags (document_id UUID REFERENCES documents(id), template_flag_id UUID REFERENCES template_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (document_id, template_flag_id));
CREATE TABLE scenario_generated_flags (scenario_id UUID REFERENCES scenarios(id), generated_flag_id UUID REFERENCES generated_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (scenario_id, generated_flag_id));
CREATE TABLE scenario_objectives_enabled_flags (scenario_id UUID REFERENCES scenarios(id), objectives_enabled_flag_id UUID REFERENCES objectives_enabled_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (scenario_id, objectives_enabled_flag_id));
CREATE TABLE scenario_images_enabled_flags (scenario_id UUID REFERENCES scenarios(id), images_enabled_flag_id UUID REFERENCES images_enabled_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (scenario_id, images_enabled_flag_id));
CREATE TABLE scenario_video_enabled_flags (scenario_id UUID REFERENCES scenarios(id), video_enabled_flag_id UUID REFERENCES video_enabled_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (scenario_id, video_enabled_flag_id));
CREATE TABLE scenario_questions_enabled_flags (scenario_id UUID REFERENCES scenarios(id), questions_enabled_flag_id UUID REFERENCES questions_enabled_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (scenario_id, questions_enabled_flag_id));
CREATE TABLE scenario_problem_statement_enabled_flags (scenario_id UUID REFERENCES scenarios(id), problem_statement_enabled_flag_id UUID REFERENCES problem_statement_enabled_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (scenario_id, problem_statement_enabled_flag_id));
CREATE TABLE eval_dynamic_flags (eval_id UUID REFERENCES evals(id), dynamic_flag_id UUID REFERENCES dynamic_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (eval_id, dynamic_flag_id));
CREATE TABLE eval_use_groups_flags (eval_id UUID REFERENCES evals(id), use_groups_flag_id UUID REFERENCES use_groups_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (eval_id, use_groups_flag_id));
CREATE TABLE simulation_practice_simulation_flags (simulation_id UUID REFERENCES simulations(id), practice_simulation_flag_id UUID REFERENCES practice_simulation_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (simulation_id, practice_simulation_flag_id));
CREATE TABLE setting_guest_login_enabled_flags (settings_id UUID REFERENCES settings(id), guest_login_enabled_flag_id UUID REFERENCES guest_login_enabled_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, guest_login_enabled_flag_id));

-- Parameter boolean flags
CREATE TABLE parameter_document_parameter_flags (parameter_id UUID REFERENCES parameters(id), document_parameter_flag_id UUID REFERENCES document_parameter_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (parameter_id, document_parameter_flag_id));
CREATE TABLE parameter_persona_parameter_flags (parameter_id UUID REFERENCES parameters(id), persona_parameter_flag_id UUID REFERENCES persona_parameter_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (parameter_id, persona_parameter_flag_id));
CREATE TABLE parameter_scenario_parameter_flags (parameter_id UUID REFERENCES parameters(id), scenario_parameter_flag_id UUID REFERENCES scenario_parameter_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (parameter_id, scenario_parameter_flag_id));
CREATE TABLE parameter_video_parameter_flags (parameter_id UUID REFERENCES parameters(id), video_parameter_flag_id UUID REFERENCES video_parameter_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (parameter_id, video_parameter_flag_id));
CREATE TABLE parameter_simulation_parameter_flags (parameter_id UUID REFERENCES parameters(id), simulation_parameter_flag_id UUID REFERENCES simulation_parameter_flags(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (parameter_id, simulation_parameter_flag_id));
```

#### Numeric Value Junctions

```sql
CREATE TABLE rubric_points (rubric_id UUID REFERENCES rubrics(id), point_id UUID REFERENCES points(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (rubric_id, point_id));
CREATE TABLE rubric_pass_points (rubric_id UUID REFERENCES rubrics(id), pass_point_id UUID REFERENCES pass_points(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (rubric_id, pass_point_id));
CREATE TABLE setting_success_thresholds (settings_id UUID REFERENCES settings(id), success_threshold_id UUID REFERENCES success_thresholds(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, success_threshold_id));
CREATE TABLE setting_warning_thresholds (settings_id UUID REFERENCES settings(id), warning_threshold_id UUID REFERENCES warning_thresholds(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, warning_threshold_id));
CREATE TABLE setting_danger_thresholds (settings_id UUID REFERENCES settings(id), danger_threshold_id UUID REFERENCES danger_thresholds(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (settings_id, danger_threshold_id));
```

#### Enum Value Junctions

```sql
CREATE TABLE auth_auth_types (auth_id UUID REFERENCES auth(id), auth_type_id UUID REFERENCES auth_types(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (auth_id, auth_type_id));
CREATE TABLE rubric_artifacts (rubric_id UUID REFERENCES rubrics(id), artifact_id UUID REFERENCES artifacts(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (rubric_id, artifact_id));
CREATE TABLE profile_roles (profile_id UUID REFERENCES profiles(id), profile_role_id UUID REFERENCES profile_roles(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (profile_id, profile_role_id));
```

#### Foreign Key Junctions (Already Graph Relationships)

```sql
-- These convert foreign keys to junction tables (already graph relationships)
CREATE TABLE agent_models (agent_id UUID REFERENCES agents(id), model_id UUID REFERENCES models(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (agent_id, model_id));
CREATE TABLE model_providers (model_id UUID REFERENCES models(id), provider_id UUID REFERENCES providers(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (model_id, provider_id));
CREATE TABLE field_parameters (field_id UUID REFERENCES fields(id), parameter_id UUID REFERENCES parameters(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (field_id, parameter_id));
CREATE TABLE document_domains (document_id UUID REFERENCES documents(id), domain_id UUID REFERENCES domains(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (document_id, domain_id));
CREATE TABLE scenario_domains (scenario_id UUID REFERENCES scenarios(id), domain_id UUID REFERENCES domains(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (scenario_id, domain_id));
CREATE TABLE scenario_video_domains (scenario_id UUID REFERENCES scenarios(id), domain_id UUID REFERENCES domains(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (scenario_id, domain_id));
CREATE TABLE scenario_image_domains (scenario_id UUID REFERENCES scenarios(id), domain_id UUID REFERENCES domains(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (scenario_id, domain_id));
CREATE TABLE rubric_domains (rubric_id UUID REFERENCES rubrics(id), domain_id UUID REFERENCES domains(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (rubric_id, domain_id));
CREATE TABLE simulation_text_domains (simulation_id UUID REFERENCES simulations(id), domain_id UUID REFERENCES domains(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (simulation_id, domain_id));
CREATE TABLE simulation_voice_domains (simulation_id UUID REFERENCES simulations(id), domain_id UUID REFERENCES domains(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (simulation_id, domain_id));
```

#### Timestamp Junctions

```sql
CREATE TABLE profile_last_logins (profile_id UUID REFERENCES profiles(id), last_login_id UUID REFERENCES last_logins(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (profile_id, last_login_id));
```

### 3. Junction Table Summary

**Total Proposed Junction Tables**: ~120-130 tables

**Breakdown by Type**:
- Text attribute junctions: ~60 tables
- Boolean flag junctions: ~35 tables
- Numeric value junctions: ~5 tables
- Enum value junctions: ~3 tables
- Foreign key junctions: ~10 tables
- Timestamp junctions: ~1 table

**Attribute Tables**: ~30 tables (one per attribute type)
1. Text: names, descriptions, slugs, icon_urls, colors, icons, instructions, document_contents, key_values, values, first_names, last_names
2. Boolean: active_flags, template_flags, generated_flags, dynamic_flags, use_groups_flags, practice_simulation_flags, guest_login_enabled_flags, objectives_enabled_flags, images_enabled_flags, video_enabled_flags, questions_enabled_flags, problem_statement_enabled_flags, document_parameter_flags, persona_parameter_flags, scenario_parameter_flags, video_parameter_flags, simulation_parameter_flags
3. Numeric: points, pass_points, success_thresholds, warning_thresholds, danger_thresholds
4. Enum: auth_types, artifacts, profile_roles
5. Timestamp: last_logins

### 4. Migration Strategy

For each object:

1. **Create attribute tables** (one per attribute type, if they don't exist)
   - `names`, `descriptions`, `titles`, `active_flags`, etc.
   - Each attribute type gets its own table

2. **Create junction tables** for each attribute type
   - Pattern: `[object]_[attribute_type]` (e.g., `cohort_names`, `scenario_active_flags`)

3. **Migrate data** from main table to attribute tables + junction tables
   - Insert unique values into attribute tables (with deduplication via UNIQUE constraint)
   - Create junction table entries linking objects to attribute values

4. **Update application code** to use junction tables instead of direct columns
   - Update SQL queries to JOIN through junction tables
   - Update API endpoints to read/write through junction tables

5. **Drop old columns** from main tables
   - After migration is complete and verified

6. **Update SQL queries** to join through junction tables
   - Example: `SELECT c.id, n.value as name FROM cohorts c JOIN cohort_names cn ON c.id = cn.cohort_id JOIN names n ON cn.name_id = n.id`

### 5. Benefits of DHH Approach

1. **Simplicity**: One table per attribute type - easy to understand and reason about
2. **Deduplication**: Identical values stored once (via UNIQUE constraint on value column)
3. **Type Safety**: Each attribute type has its own table, enforcing type consistency
4. **Graph Structure**: All attributes become graph nodes, enabling graph queries
5. **Boring**: No clever abstractions, just straightforward tables and junctions
6. **Maintainability**: Easy to see what attributes exist, easy to add new ones

### 6. Estimated Tables Needed

**Total Attribute Tables**: ~29 tables (one per attribute type)

**Total Junction Tables**: ~120-130 tables

**Breakdown by Type**:
- Text attribute tables: ~12 tables (names, descriptions, slugs, icon_urls, colors, icons, instructions, document_contents, key_values, values, first_names, last_names)
- Boolean flag tables: ~17 tables (active_flags, template_flags, generated_flags, dynamic_flags, use_groups_flags, practice_simulation_flags, guest_login_enabled_flags, objectives_enabled_flags, images_enabled_flags, video_enabled_flags, questions_enabled_flags, problem_statement_enabled_flags, document_parameter_flags, persona_parameter_flags, scenario_parameter_flags, video_parameter_flags, simulation_parameter_flags)
- Numeric value tables: ~5 tables (points, pass_points, success_thresholds, warning_thresholds, danger_thresholds)
- Enum value tables: ~3 tables (auth_types, artifacts, profile_roles)
- Timestamp tables: ~1 table (last_logins)

### 7. Challenges

1. **Query Complexity**: Every query would require multiple JOINs
   - Example: Getting a cohort with name requires: `cohorts → cohort_names → text_values`
   - Getting all attributes requires multiple JOINs per attribute

2. **Performance**: Junction tables add overhead for simple lookups
   - Indexes needed on all junction tables
   - Query planner needs to optimize multiple JOINs

3. **Type Safety**: Need to ensure attribute types match (text vs boolean vs numeric)
   - Junction table naming convention helps (e.g., `cohort_names` → text_values)
   - Application code must enforce type constraints

4. **Default Values**: How to handle defaults when attributes are in junction tables?
   - Could use LEFT JOINs with COALESCE for defaults
   - Or create default attribute values in shared tables

5. **Single Values**: Most attributes are single-value (not arrays), so junction tables may be overkill
   - Current design assumes one value per object per attribute type
   - Junction tables enforce this via PRIMARY KEY on (object_id, attribute_type)

6. **Code Changes**: Massive refactoring of all SQL queries and application code
   - All SELECT queries need JOINs
   - All INSERT/UPDATE queries need to manage junction tables
   - API endpoints need to handle attribute updates differently

7. **Migration Complexity**: Data migration for 17 tables with varying attribute counts
   - Need to extract unique values and create shared attribute entries
   - Need to create junction table entries for all existing data
   - Need to verify data integrity before dropping old columns

8. **Value Deduplication**: Attribute tables deduplicate values via UNIQUE constraint
   - Need to handle case sensitivity (e.g., "Name" vs "name")
   - Need to handle whitespace normalization
   - Need to handle NULL values (if allowed)
   - Each attribute table has its own UNIQUE constraint on the value column

9. **Many Tables**: DHH approach creates many tables (~150 total)
   - ~30 attribute tables
   - ~120-130 junction tables
   - Need good naming conventions and documentation
   - Database schema becomes large but very explicit

### 6. Alternative Approach: Hybrid Model

Instead of full denormalization, consider:

1. **Keep simple attributes** (name, description, active) in main tables
2. **Use junction tables** only for:
   - Multi-value attributes (arrays)
   - Relationships to other graph components
   - Complex nested structures
   - Attributes that need versioning/history

This would reduce the number of junction tables needed while still achieving graph-like structure for relationships.

## Recommendations

1. **Current State**: The system already uses junction tables effectively for **relationships** between graph components
2. **Full Denormalization**: Moving all attributes to junction tables would be a massive undertaking with questionable benefits
3. **Graph Structure**: The current structure already supports graph relationships via junction tables
4. **Focus**: Consider denormalizing only:
   - Multi-value attributes that are currently stored as arrays
   - Complex nested structures
   - Attributes that need versioning or history tracking

## Conclusion

- **Fully denormalized objects**: 0 out of 17
- **Attribute tables needed**: ~30 tables (one per attribute type - DHH approach)
- **Junction tables needed for full denormalization**: ~120-130 tables
- **Effort required**: Very high (migration + code refactoring)
- **Benefit**: 
  - ✅ True graph structure for all attributes
  - ✅ Value deduplication and consistency
  - ✅ Enables graph queries across attributes
  - ✅ Simple, straightforward approach (DHH style)
  - ❌ Increased query complexity
  - ❌ Performance overhead for simple lookups
  - ❌ Many tables to manage (~150 total)
- **Recommendation**: 
  - **If graph structure is critical**: Proceed with attribute tables + junction tables (DHH approach)
  - **If performance and simplicity are priorities**: Keep current hybrid approach (attributes in main tables, relationships via junction tables)
  - **Hybrid option**: Denormalize only multi-value or complex attributes, keep simple single-value attributes in main tables

## Next Steps

If proceeding with full denormalization:

1. **Phase 1**: Create shared attribute tables (`text_values`, `boolean_flags`, `numeric_values`, `enum_values`, `timestamp_values`)
2. **Phase 2**: Create junction tables for one object at a time (start with simplest: `cohorts`)
3. **Phase 3**: Migrate data for one object, test thoroughly
4. **Phase 4**: Update application code for migrated object
5. **Phase 5**: Repeat phases 2-4 for remaining objects
6. **Phase 6**: Drop old columns after all objects migrated

**Estimated Timeline**: 2-4 weeks per object (17 objects = 34-68 weeks total)



---


# Shared Resources Strategy

## Overview

Resources represent reusable UI components. When multiple artifacts use the same resource type, they can share the same UI component. This document outlines the strategy for merging similar resources into shared resource tables.

## Key Principles

1. **Resources are reusable UI components**: If multiple artifacts use the same resource type, they share the same UI component
2. **Resource attributes are distinct**: Name/description on resources are distinct from artifact name/description - they represent different setups
3. **Shared resources enable consistent UI**: Same resource type = same UI component across all artifacts

## Shared Resource Tables

### 1. Colors Resource

**Purpose**: Unified color resource used by `settings` and `personas` artifacts

**Table**: `colors`
- `id` (UUID, primary key)
- `name` (text) - distinct from artifact name
- `description` (text) - distinct from artifact description
- `hex_code` (text) - hex color code (e.g., "#FF5733")
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Junction Tables**:
- `setting_colors` - links `settings` artifact to `colors` resource
- `persona_colors` - links `personas` artifact to `colors` resource

**Replaces**:
- `setting_primary_colors`, `setting_accent_colors`, `setting_background_colors`, etc. → all use `colors` resource
- `persona_colors` → uses `colors` resource

**UI Component**: Single color picker/display component used across settings and personas

### 2. Flags Resource

**Purpose**: Unified boolean flag resource used across all artifacts

**Table**: `flags`
- `id` (UUID, primary key)
- `name` (text) - distinct from artifact name (e.g., "active", "generated", "practice")
- `description` (text) - distinct from artifact description
- `icon_id` (UUID, foreign key to `icons`) - icon for the flag
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Junction Tables**:
- `artifact_flags` - generic junction table linking any artifact to flags
  - `artifact_id` (UUID)
  - `artifact_type` (text/enum) - which artifact (scenario, document, persona, etc.)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (enum) - type of flag for this artifact (e.g., `type_scenario_flags` enum: 'active', 'objectives_enabled', 'images_enabled', 'video_enabled', 'questions_enabled', 'problem_statement_enabled')
  - `value` (boolean) - the actual flag value
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - CHECK constraint: `type` must be valid for `artifact_type`

**Type Enums** (centralized naming schema):
- `type_scenario_flags` - enum for scenario flag types: 'active', 'objectives_enabled', 'images_enabled', 'video_enabled', 'questions_enabled', 'problem_statement_enabled'
- `type_eval_flags` - enum for eval flag types: 'active', 'dynamic', 'groups'
- `type_document_flags` - enum for document flag types: 'active', 'template'
- `type_parameter_flags` - enum for parameter flag types: 'active', 'document_parameter', 'persona_parameter', 'scenario_parameter', 'video_parameter', 'simulation_parameter'
- `type_simulation_flags` - enum for simulation flag types: 'active', 'practice'
- And so on for each artifact that needs flag type distinction

**Flag Pruning/Renaming**:
- ❌ Remove: `scenario_generated_flags` (pruned)
- ✅ Rename: `eval_use_groups_flags` → `eval_groups_flags` (use_groups → groups)
- ✅ Rename: `simulation_practice_simulation_flags` → `simulation_practice_flags` (practice_simulation → practice)

**Replaces All Boolean Flag Tables**:
- `cohort_active_flags` → `artifact_flags` with flag name "active"
- `scenario_active_flags` → `artifact_flags` with flag name "active"
- `scenario_generated_flags` → ❌ REMOVED
- `persona_active_flags` → `artifact_flags` with flag name "active"
- `document_active_flags` → `artifact_flags` with flag name "active"
- `parameter_active_flags` → `artifact_flags` with flag name "active"
- `field_active_flags` → `artifact_flags` with flag name "active"
- `agent_active_flags` → `artifact_flags` with flag name "active"
- `model_active_flags` → `artifact_flags` with flag name "active"
- `rubric_active_flags` → `artifact_flags` with flag name "active"
- `eval_active_flags` → `artifact_flags` with flag name "active"
- `eval_dynamic_flags` → `artifact_flags` with flag name "dynamic"
- `eval_groups_flags` → `artifact_flags` with flag name "groups" (renamed from use_groups)
- `simulation_practice_flags` → `artifact_flags` with flag name "practice" (renamed from practice_simulation)
- `department_active_flags` → `artifact_flags` with flag name "active"
- `provider_active_flags` → `artifact_flags` with flag name "active"
- `auth_active_flags` → `artifact_flags` with flag name "active"
- `key_active_flags` → `artifact_flags` with flag name "active"
- `setting_active_flags` → `artifact_flags` with flag name "active"
- `setting_guest_login_enabled_flags` → `artifact_flags` with flag name "guest_login_enabled"
- `scenario_objectives_enabled_flags` → `artifact_flags` with flag name "objectives_enabled"
- `scenario_images_enabled_flags` → `artifact_flags` with flag name "images_enabled"
- `scenario_video_enabled_flags` → `artifact_flags` with flag name "video_enabled"
- `scenario_questions_enabled_flags` → `artifact_flags` with flag name "questions_enabled"
- `scenario_problem_statement_enabled_flags` → `artifact_flags` with flag name "problem_statement_enabled"
- `document_template_flags` → `artifact_flags` with flag name "template"
- `parameter_document_parameter_flags` → `artifact_flags` with flag name "document_parameter"
- `parameter_persona_parameter_flags` → `artifact_flags` with flag name "persona_parameter"
- `parameter_scenario_parameter_flags` → `artifact_flags` with flag name "scenario_parameter"
- `parameter_video_parameter_flags` → `artifact_flags` with flag name "video_parameter"
- `parameter_simulation_parameter_flags` → `artifact_flags` with flag name "simulation_parameter"

**UI Component**: Single flag toggle/checkbox component with icon, used across all artifacts

### 3. Icons Resource

**Purpose**: Unified icon resource used by `personas` and `flags` artifacts

**Table**: `icons`
- `id` (UUID, primary key)
- `name` (text) - distinct from artifact name
- `description` (text) - distinct from artifact description
- `value` (text) - icon identifier/value (e.g., "user", "check", "star")
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Junction Tables**:
- `persona_icons` - links `personas` artifact to `icons` resource
- `flag_icons` - links `flags` artifact to `icons` resource (via `flags.icon_id` foreign key)

**Replaces**:
- `persona_icons` → uses `icons` resource
- Flag icons → uses `icons` resource via `flags.icon_id`

**UI Component**: Single icon picker/display component used across personas and flags

### 4. Content Resource (Merged)

**Purpose**: Unified content resource - merge `document_content` with existing `content` table

**Existing Table**: `content`
- `id` (UUID, primary key)
- `content` (text) - the actual content text
- `tool_call_id` (UUID, nullable, foreign key to `calls`)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Junction Tables**:
- `message_content` - already exists, links `messages` to `content`
- `document_content` - NEW, links `documents` artifact to `content` resource
  - `document_id` (UUID, foreign key to `documents`)
  - `content_id` (UUID, foreign key to `content`)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

**Replaces**:
- `document_document_contents` → `document_content` junction table linking to `content` resource

**UI Component**: Single content display/editor component used across messages and documents

## Resource Mapping Updates

### Colors Resource Usage

**Settings Artifact**:
- `setting_primary_colors` → Resource: `colors` (via `setting_colors` with type="primary")
- `setting_accent_colors` → Resource: `colors` (via `setting_colors` with type="accent")
- `setting_background_colors` → Resource: `colors` (via `setting_colors` with type="background")
- `setting_surface_colors` → Resource: `colors` (via `setting_colors` with type="surface")
- `setting_success_colors` → Resource: `colors` (via `setting_colors` with type="success")
- `setting_warning_colors` → Resource: `colors` (via `setting_colors` with type="warning")
- `setting_error_colors` → Resource: `colors` (via `setting_colors` with type="error")
- `setting_sidebar_background_colors` → Resource: `colors` (via `setting_colors` with type="sidebar_background")
- `setting_sidebar_primary_colors` → Resource: `colors` (via `setting_colors` with type="sidebar_primary")
- `setting_chart1_colors` → Resource: `colors` (via `setting_colors` with type="chart1")
- `setting_chart2_colors` → Resource: `colors` (via `setting_colors` with type="chart2")
- `setting_chart3_colors` → Resource: `colors` (via `setting_colors` with type="chart3")
- `setting_chart4_colors` → Resource: `colors` (via `setting_colors` with type="chart4")
- `setting_chart5_colors` → Resource: `colors` (via `setting_colors` with type="chart5")

**Persona Artifact**:
- `persona_colors` → Resource: `colors` (via `persona_colors` junction table)

### Flags Resource Usage

All artifacts use the unified `flags` resource via artifact-specific junction tables with `type` enum columns:

**Cohort Artifact**:
- `cohort_flags` junction table with `type` enum (`type_cohort_flags`: 'active')
  - `cohort_id` (UUID, foreign key to `cohorts`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_cohort_flags` enum)
  - `value` (boolean)

**Scenario Artifact**:
- `scenario_flags` junction table with `type` enum (`type_scenario_flags`: 'active', 'objectives_enabled', 'images_enabled', 'video_enabled', 'questions_enabled', 'problem_statement_enabled')
  - `scenario_id` (UUID, foreign key to `scenarios`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_scenario_flags` enum)
  - `value` (boolean)
  - ❌ `scenario_generated_flags` → REMOVED

**Persona Artifact**:
- `persona_flags` junction table with `type` enum (`type_persona_flags`: 'active')
  - `persona_id` (UUID, foreign key to `personas`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_persona_flags` enum)
  - `value` (boolean)

**Document Artifact**:
- `document_flags` junction table with `type` enum (`type_document_flags`: 'active', 'template')
  - `document_id` (UUID, foreign key to `documents`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_document_flags` enum)
  - `value` (boolean)

**Parameter Artifact**:
- `parameter_flags` junction table with `type` enum (`type_parameter_flags`: 'active', 'document_parameter', 'persona_parameter', 'scenario_parameter', 'video_parameter', 'simulation_parameter')
  - `parameter_id` (UUID, foreign key to `parameters`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_parameter_flags` enum)
  - `value` (boolean)

**Field Artifact**:
- `field_flags` junction table with `type` enum (`type_field_flags`: 'active')
  - `field_id` (UUID, foreign key to `fields`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_field_flags` enum)
  - `value` (boolean)

**Agent Artifact**:
- `agent_flags` junction table with `type` enum (`type_agent_flags`: 'active')
  - `agent_id` (UUID, foreign key to `agents`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_agent_flags` enum)
  - `value` (boolean)

**Model Artifact**:
- `model_flags` junction table with `type` enum (`type_model_flags`: 'active')
  - `model_id` (UUID, foreign key to `models`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_model_flags` enum)
  - `value` (boolean)

**Rubric Artifact**:
- `rubric_flags` junction table with `type` enum (`type_rubric_flags`: 'active')
  - `rubric_id` (UUID, foreign key to `rubrics`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_rubric_flags` enum)
  - `value` (boolean)

**Eval Artifact**:
- `eval_flags` junction table with `type` enum (`type_eval_flags`: 'active', 'dynamic', 'groups')
  - `eval_id` (UUID, foreign key to `evals`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_eval_flags` enum)
  - `value` (boolean)

**Simulation Artifact**:
- `simulation_flags` junction table with `type` enum (`type_simulation_flags`: 'active', 'practice')
  - `simulation_id` (UUID, foreign key to `simulations`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_simulation_flags` enum)
  - `value` (boolean)

**Department Artifact**:
- `department_flags` junction table with `type` enum (`type_department_flags`: 'active')
  - `department_id` (UUID, foreign key to `departments`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_department_flags` enum)
  - `value` (boolean)

**Provider Artifact**:
- `provider_flags` junction table with `type` enum (`type_provider_flags`: 'active')
  - `provider_id` (UUID, foreign key to `providers`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_provider_flags` enum)
  - `value` (boolean)

**Auth Artifact**:
- `auth_flags` junction table with `type` enum (`type_auth_flags`: 'active')
  - `auth_id` (UUID, foreign key to `auth`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_auth_flags` enum)
  - `value` (boolean)

**Key Artifact**:
- `key_flags` junction table with `type` enum (`type_key_flags`: 'active')
  - `key_id` (UUID, foreign key to `keys`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_key_flags` enum)
  - `value` (boolean)

**Setting Artifact**:
- `setting_flags` junction table with `type` enum (`type_setting_flags`: 'active', 'guest_login_enabled')
  - `setting_id` (UUID, foreign key to `settings`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_setting_flags` enum)
  - `value` (boolean)

### Icons Resource Usage

**Persona Artifact**:
- `persona_icons` → Resource: `icons` (via `persona_icons` junction table)

**Flags Resource**:
- `flags.icon_id` → Resource: `icons` (via foreign key)

### Content Resource Usage

**Document Artifact**:
- `document_document_contents` → Resource: `content` (via `document_content` junction table)

**Message Artifact** (already exists):
- `message_content` → Resource: `content` (via `message_content` junction table)

## Benefits

1. **Consistent UI**: Same resource type = same UI component across all artifacts
2. **Reduced duplication**: Single source of truth for colors, flags, icons, content
3. **Easier maintenance**: Update UI component once, affects all artifacts
4. **Better type safety**: Shared resources enable better type checking
5. **Simplified queries**: Single table to query instead of many flag tables

## Migration Considerations

1. **Flags migration**: Need to migrate all boolean flag columns to `artifact_flags` junction table
2. **Colors migration**: Need to migrate color columns to `colors` table and create junction entries
3. **Icons migration**: Need to migrate icon columns to `icons` table
4. **Content migration**: Need to migrate `document.content` column to `content` table and create `document_content` junction entries
5. **Flag pruning**: Remove `scenario_generated_flags` entirely
6. **Flag renaming**: Update flag names (use_groups → groups, practice_simulation → practice)

## Example Queries

### Get all flags for a scenario:
```sql
SELECT f.*, af.value
FROM flags f
JOIN artifact_flags af ON f.id = af.flag_id
WHERE af.artifact_type = 'scenario'
  AND af.artifact_id = $1;
```

### Get all colors for settings:
```sql
SELECT c.*, sc.type
FROM colors c
JOIN setting_colors sc ON c.id = sc.color_id
WHERE sc.setting_id = $1;
```

### Get content for a document:
```sql
SELECT c.*
FROM content c
JOIN document_content dc ON c.id = dc.content_id
WHERE dc.document_id = $1;
```



---


# Artifacts/Resources Analysis - Summary

## Overview

This collection of documents analyzes what it would take to make all 17 top-level graph components artifacts (with singular names), and all tables related to them resources.

## Document Collection

1. **Part 1: Current State** (`analysis_artifacts_resources_part1_current_state.md`)
   - Current artifacts enum (8 values)
   - Current resources enum (31 values)
   - Current tables using artifacts/resources
   - Current pattern summary

2. **Part 2: Mapping Objects to Artifacts** (`analysis_artifacts_resources_part2_mapping_objects_to_artifacts.md`)
   - Mapping 17 core objects to artifacts
   - Proposed artifact names (all singular)
   - Conflict analysis (field resource vs field artifact)
   - Updated artifacts enum proposal (21 artifacts)

3. **Part 3: Mapping Tables to Resources** (`analysis_artifacts_resources_part3_mapping_tables_to_resources.md`)
   - Mapping all related tables to resources
   - Resource naming convention
   - Detailed mapping for each of the 17 artifacts
   - Estimated ~200+ resources needed

4. **Part 4: Migration Strategy** (`analysis_artifacts_resources_part4_migration_strategy.md`)
   - Migration phases
   - Challenges (enum limitations, large number of resources)
   - Estimated effort (4-6 weeks)
   - Alternative approach (table-based resources)

## Key Findings

### Artifacts
- **Current**: 8 artifacts
- **Proposed**: 21 artifacts (8 existing + 13 new)
- **New artifacts**: cohort, simulation, persona, parameter, field, model, eval, department, provider, auth, key, setting, profile

### Resources
- **Current**: 31 resources
- **Proposed**: ~200+ resources
- **Breakdown**: ~100+ junction table resources + ~100+ attribute resources (from denormalization)

### Key Concepts
1. **Artifacts are singular**: All artifact enum values are singular (scenario, persona, document, field, profile)
2. **Resources are plural**: Resources are the plural form of table names (personas, departments, emails, names)
3. **Junction table pattern**: Junction tables follow `{artifact}_{resource}` where artifact is singular and resource is plural (e.g., `scenario_personas`, `profile_departments`)
4. **Artifacts can be resources**: An entity can be both an artifact (top-level, singular) AND a resource (when referenced by another artifact, plural). Example: `personas` table → artifact `persona` (singular), resource `personas` (plural when referenced by `scenario`)
5. **Database table names**: Database table names are typically plural (e.g., `documents`, `fields`, `personas`), artifact enum values are singular (e.g., `document`, `field`, `persona`)

### Challenges
1. **Enum limitations**: PostgreSQL doesn't easily support adding 200+ enum values
2. **Large scope**: Massive migration affecting entire codebase
3. **Type safety**: Enum approach maintains type safety but is inflexible

### Recommendations
1. **Hybrid approach**: Keep artifacts as enum (small, stable), consider resources as table (large, growing)
2. **Phased rollout**: Add artifacts/resources incrementally
3. **Comprehensive testing**: Test each addition thoroughly

## Related Documents

- **Denormalization Analysis**: `analysis_graph_components_denormalization.md`
  - Analysis of denormalizing 17 objects with junction tables
  - ~29 attribute tables + ~120-130 junction tables

## Next Steps

1. Review all 4 parts of the analysis
2. Decide on approach (enum vs table for resources)
3. Resolve field conflict (rename resource to document_field)
4. Plan phased migration strategy
5. Begin implementation



---


# Artifacts/Resources Analysis - Part 1: Current State

## Overview

Analysis of what it would take to make all 17 top-level graph components artifacts (with singular names), and all tables related to them resources.

## Current Artifacts Enum

The `artifacts` enum currently contains:
- `agent`
- `chat`
- `document`
- `grade`
- `message`
- `rubric`
- `run`
- `scenario`

**Total**: 8 artifacts

## Current Resources Enum

The `resources` enum currently contains:
- `analysis`
- `answer`
- `content`
- `conversation`
- `debug_info`
- `developer_instruction`
- `document`
- `feedback`
- `field`
- `fields`
- `hint`
- `html`
- `image`
- `improvement`
- `objective`
- `option`
- `parameters`
- `problem_statement`
- `prompt`
- `question`
- `response`
- `schema`
- `schema_field`
- `schema_field_item`
- `standard_group`
- `strength`
- `template`
- `template_array_item`
- `template_value`
- `times`
- `video`

**Total**: 31 resources

## Current Tables Using Artifacts/Resources

### Tables with `artifact` column:
- `domains` - Links artifacts to agents (artifact enum + agent_id)
- `rubrics` - Has artifact enum column

### Tables with `resource` column:
- `resource_schemas` - Links resources to schemas (resource enum + schema_id)
- `resource_tools` - Links resources to tools (resource enum + tool_id)

## Current Domains Table Structure

```sql
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    artifact artifacts NOT NULL,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(artifact, agent_id)
);
```

**Purpose**: Links artifacts to agents. Each domain represents an agent's capability in a specific artifact type.

## Current Resource Schemas Table Structure

```sql
CREATE TABLE resource_schemas (
    resource resources NOT NULL,
    schema_id UUID NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (resource, schema_id)
);
```

**Purpose**: Links resources to schemas. Defines which schemas can be used for which resources.

## Current Resource Tools Table Structure

```sql
CREATE TABLE resource_tools (
    resource resources NOT NULL,
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (resource, tool_id)
);
```

**Purpose**: Links resources to tools. Defines which tools can operate on which resources.

## Current Pattern Summary

1. **Artifacts** = Top-level entities (scenario, document, message, etc.)
2. **Resources** = Sub-entities or attributes of artifacts (problem_statement, objective, content, etc.)
3. **Domains** = Links artifacts to agents (which agents can work with which artifacts)
4. **Resource Schemas** = Links resources to schemas (which schemas define which resources)
5. **Resource Tools** = Links resources to tools (which tools operate on which resources)

## Key Observations

1. **Artifacts are singular**: All artifact enum values are singular (scenario, document, persona, profile)
2. **Resources are plural**: Resources are the plural form of table names (personas, departments, emails, names)
3. **Junction table pattern**: Junction tables follow `{artifact}_{resource}` where artifact is singular and resource is plural (e.g., `scenario_personas`, `profile_departments`)
4. **Artifacts can be resources**: A table/entity can be both an artifact (top-level, singular name) AND a resource (when referenced by another artifact, plural name). For example:
   - `personas` table → artifact: `persona` (singular)
   - `personas` table → resource: `personas` (plural, when referenced by `scenario` artifact via `scenario_personas` junction table)
5. **Database table names**: Database table names are typically plural (e.g., `documents`, `fields`, `personas`), artifact enum values are singular (e.g., `document`, `field`, `persona`)
6. **Not all top-level objects are artifacts**: Only 8 artifacts exist, but we have 17 core graph components
7. **Resources map to artifact sub-entities**: Resources represent things that belong to artifacts (e.g., `personas` resource belongs to `scenario` artifact via `scenario_personas` junction table)



---


# Artifacts/Resources Analysis - Part 2: Mapping 17 Objects to Artifacts

## Overview

Mapping the 17 core graph components to artifacts (with singular names).

## Current 17 Core Graph Components

1. cohorts
2. simulations
3. scenarios (already an artifact)
4. personas
5. documents (already an artifact)
6. parameters
7. fields
8. agents (already an artifact)
9. models
10. rubrics (already an artifact)
11. evals
12. departments
13. providers
14. auth
15. keys
16. settings
17. profiles

## Proposed Artifact Mappings

### Already Artifacts (8)
- `scenario` ✅
- `document` ✅
- `agent` ✅
- `rubric` ✅
- `message` ✅ (not in 17, but exists)
- `grade` ✅ (not in 17, but exists)
- `run` ✅ (not in 17, but exists)
- `chat` ✅ (not in 17, but exists)

### Need to Add as Artifacts (9 from 17)

| Current Object | Proposed Artifact Name | Rationale |
|----------------|------------------------|------------|
| cohorts | `cohort` | Singular form |
| simulations | `simulation` | Singular form |
| personas | `persona` | Singular form |
| parameters | `parameter` | Singular form |
| fields | `field` | Singular form (note: 'field' already exists as resource) |
| models | `model` | Singular form |
| evals | `eval` | Singular form |
| departments | `department` | Singular form |
| providers | `provider` | Singular form |
| auth | `auth` | Already singular |
| keys | `key` | Singular form |
| settings | `setting` | Singular form |
| profiles | `profile` | Singular form |

### Artifacts Can Also Be Resources

**Important**: An entity can be both an artifact AND a resource. This is not a conflict - it's the intended design.

**Examples**:
- `document` is an artifact (top-level entity in `documents` table)
- `document` is also a resource when referenced by `scenario` artifact (via `scenario_documents` junction table)
- `persona` is an artifact (top-level entity in `personas` table)
- `persona` is also a resource when referenced by `scenario` artifact (via `scenario_personas` junction table)
- `field` is an artifact (top-level entity in `fields` table)
- `field` is also a resource when referenced by `document` artifact (via `document_fields` junction table)

**Pattern**: When an artifact is referenced by another artifact through a junction table, it becomes a resource of that referencing artifact.

### Naming Clarification

- **Artifact names**: Always singular (`document`, `field`, `persona`)
- **Database table names**: May be plural (`documents`, `fields`, `personas`) - this is fine, artifact enum values are singular
- **Resource names**: Usually singular, but can be plural for collections (`fields`, `parameters`)

## Updated Artifacts Enum (Proposed)

After adding all 17 objects as artifacts:

```sql
CREATE TYPE artifacts AS ENUM (
    'agent',        -- ✅ existing
    'auth',         -- ➕ new
    'chat',         -- ✅ existing
    'cohort',       -- ➕ new
    'department',   -- ➕ new
    'document',     -- ✅ existing
    'eval',         -- ➕ new
    'field',        -- ➕ new (also exists as resource - this is intentional)
    'grade',        -- ✅ existing
    'key',          -- ➕ new
    'message',      -- ✅ existing
    'model',        -- ➕ new
    'parameter',    -- ➕ new
    'persona',      -- ➕ new
    'profile',      -- ➕ new
    'provider',     -- ➕ new
    'rubric',       -- ✅ existing
    'run',          -- ✅ existing
    'scenario',     -- ✅ existing
    'setting',      -- ➕ new
    'simulation'    -- ➕ new
);
```

**Total**: 21 artifacts (8 existing + 13 new)

## Migration Considerations

### 1. Field Conflict Resolution

**Recommendation**: Rename resource `field` to `document_field` to avoid conflict with artifact `field`.

**Impact**:
- Update `resource_schemas` table
- Update `resource_tools` table
- Update all SQL queries referencing `'field'::resources`
- Update enum: Remove `field`, add `document_field`

### 2. Singular Name Consistency

All artifacts should be singular:
- ✅ `cohort` (not cohorts)
- ✅ `simulation` (not simulations)
- ✅ `persona` (not personas)
- ✅ `parameter` (not parameters)
- ✅ `field` (not fields)
- ✅ `model` (not models)
- ✅ `eval` (not evals)
- ✅ `department` (not departments)
- ✅ `provider` (not providers)
- ✅ `key` (not keys)
- ✅ `setting` (not settings)
- ✅ `profile` (not profiles)

### 3. Table Name vs Artifact Name

Current table names are plural (e.g., `cohorts`, `simulations`), but artifacts are singular. This is fine - table names can remain plural while artifact enum values are singular.

## Next Steps

See Part 3 for mapping all related tables to resources.



---


# Artifacts/Resources Analysis - Part 3: Mapping Tables to Resources

## Overview

Mapping all tables related to the 17 core graph components to resources. Each table that belongs to an artifact becomes a resource.

## Mapping Strategy

**Key Concept**: 
- **Artifacts** = Singular form of strong entity table names (`scenario`, `persona`, `department`, `profile`)
- **Resources** = Plural form of table names (`personas`, `departments`, `emails`, `names`)
- **Junction tables** = `{artifact}_{resource}` pattern where artifact is singular and resource is plural (e.g., `scenario_personas`, `profile_departments`)
- **Shared Resources** = Resources that represent reusable UI components, shared across multiple artifacts (e.g., `colors`, `flags`, `icons`, `content`)

1. **Junction tables** → Resources are the referenced table names in plural form (e.g., `cohort_departments` junction table → resource is `departments`, from `departments` table)
2. **Attribute tables** → Resources are the attribute table names in plural form (e.g., `names` table → resource is `names`)
3. **Related entity tables** → Resources are the table names in plural form (e.g., `objectives` table → resource is `objectives`)
4. **Sub-entity tables** → Resources are the table names in plural form (e.g., `auth_items` table → resource is `auth_items`)
5. **Artifacts as resources**: When an artifact table is referenced by another artifact, the table name (plural) becomes the resource (e.g., `documents` table (artifact `document`) → resource is `documents` when referenced by `scenario`)
6. **Shared resources**: Resources that can be reused across artifacts (see `analysis_shared_resources_strategy.md` for details):
   - `colors` - shared by `settings` and `personas`
   - `flags` - unified boolean flags used by all artifacts
   - `icons` - shared by `personas` and `flags`
   - `content` - shared by `documents` and `messages` (merged with existing `content` table)

## Important: Artifacts Can Be Resources

**Key Concept**: An entity can be both an artifact (top-level strong entity table, singular name) AND a resource (when its table is referenced by another artifact, plural name).

**Examples**:
- `personas` table → artifact: `persona` (singular)
- `personas` table → resource: `personas` (plural, when referenced by `scenario` via `scenario_personas` junction table)
- `documents` table → artifact: `document` (singular)
- `documents` table → resource: `documents` (plural, when referenced by `scenario` via `scenario_documents` junction table)
- `fields` table → artifact: `field` (singular)
- `fields` table → resource: `fields` (plural, when referenced by `document` via `document_fields` junction table)

**Pattern**: 
- Artifacts = Singular form of strong entity table names (`scenario`, `persona`, `document`, `field`, `profile`)
- Resources = Plural form of table names (`personas`, `departments`, `emails`, `names`, `fields`)
- Junction tables = `{artifact_singular}_{resource_plural}` (e.g., `scenario_personas` links `scenario` artifact to `personas` resource)

## Resource Naming Convention

- **Plural form**: Resources are always plural, matching the actual table names (e.g., `departments` table → `departments` resource)
- **Table-based**: Resources come from actual table names (e.g., `departments` table → `departments` resource)
- **Artifact tables as resources**: When an artifact table is referenced, use its table name (plural) as the resource (e.g., `personas` table (artifact `persona`) → `personas` resource)
- **Junction table pattern**: Junction tables follow `{artifact_singular}_{resource_plural}` pattern (e.g., `scenario_personas` links `scenario` artifact to `personas` resource)

## Mapping by Artifact

### 1. Cohort Artifact

**Artifact**: `cohort` (from `cohorts` table)

**Tables to map**:
- `cohorts` (main table - artifact itself)
- `cohort_departments` → Resource: `departments` (from `departments` table)
- `cohort_profiles` → Resource: `profiles` (from `profiles` table, artifact `profile`)
- `cohort_simulations` → Resource: `simulations` (from `simulations` table, artifact `simulation`)
- `cohort_names` (from denormalization) → Resource: `names` (from `names` table)
- `cohort_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `cohort_active_flags` (from denormalization) → Resource: `active_flags` (from `active_flags` table)

**Proposed Resources**:
- `departments` (from `departments` table)
- `profiles` (from `profiles` table, also an artifact `profile`)
- `simulations` (from `simulations` table, also an artifact `simulation`)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `active_flags` (from `active_flags` table)

### 2. Simulation Artifact

**Artifact**: `simulation` (from `simulations` table)

**Tables to map**:
- `simulations` (main table - artifact itself)
- `simulation_departments` → Resource: `departments` (from `departments` table)
- `simulation_scenarios` → Resource: `scenarios` (from `scenarios` table, artifact `scenario`)
- `simulation_scenarios_rubric_grade_agents` → Resource: `rubric_grade_agents` (from `rubric_grade_agents` table)
- `simulation_attempts` → Resource: `simulation_attempts` (from `simulation_attempts` table)
- `simulation_names` (from denormalization) → Resource: `names` (from `names` table)
- `simulation_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `simulation_flags` → Resource: `flags` (from `flags` table, shared resource, consolidated junction table with `type_simulation_flags` enum: 'active', 'practice')
- `simulation_domains` → Resource: `domains` (from `domains` table, consolidated junction table with `type_simulation_domains` enum: 'text', 'voice')

**Proposed Resources**:
- `departments` (from `departments` table)
- `scenarios` (from `scenarios` table, also an artifact `scenario`)
- `rubric_grade_agents` (from `rubric_grade_agents` table)
- `simulation_attempts` (from `simulation_attempts` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `flags` (from `flags` table, shared resource - via `simulation_flags` junction table with `type_simulation_flags` enum)
- `domains` (from `domains` table - via `simulation_domains` junction table with `type_simulation_domains` enum)

### 3. Scenario Artifact (Already Exists)

**Artifact**: `scenario` (from `scenarios` table)

**Tables to map**:
- `scenarios` (main table - artifact itself)
- `scenario_departments` → Resource: `departments` (from `departments` table)
- `scenario_documents` → Resource: `documents` (from `documents` table, artifact `document`)
- `scenario_document_ranges` → Resource: `scenario_document_ranges` (from `scenario_document_ranges` table)
- `scenario_personas` → Resource: `personas` (from `personas` table, artifact `persona`)
- `scenario_persona_ranges` → Resource: `scenario_persona_ranges` (from `scenario_persona_ranges` table)
- `scenario_parameters` → Resource: `parameters` (from `parameters` table, artifact `parameter`)
- `scenario_parameter_ranges` → Resource: `scenario_parameter_ranges` (from `scenario_parameter_ranges` table)
- `scenario_fields` → Resource: `fields` (from `fields` table, artifact `field`)
- `scenario_field_ranges` → Resource: `scenario_field_ranges` (from `scenario_field_ranges` table)
- `scenario_objectives` → Resource: `objectives` (from `objectives` table)
- `scenario_problem_statements` → Resource: `problem_statements` (from `problem_statements` table)
- `scenario_questions` → Resource: `questions` (from `questions` table)
- `scenario_images` → Resource: `images` (from `images` table)
- `scenario_videos` → Resource: `videos` (from `videos` table)
- `scenario_templates` → Resource: `templates` (from `templates` table)
- `scenario_groups` → Resource: `groups` (from `groups` table)
- `scenario_time_limits` → Resource: `scenario_time_limits` (from `scenario_time_limits` table)
- `scenario_tree` → Resource: `scenario_tree` (from `scenario_tree` table)
- `scenario_video_images` → Resource: `scenario_video_images` (from `scenario_video_images` table)
- `scenario_options` → Resource: `options` (from `options` table)
- `scenario_names` (from denormalization) → Resource: `names` (from `names` table)
- `scenario_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `scenario_flags` → Resource: `flags` (from `flags` table, shared resource, consolidated junction table with `type_scenario_flags` enum: 'active', 'objectives_enabled', 'images_enabled', 'video_enabled', 'questions_enabled', 'problem_statement_enabled')
- ❌ `scenario_generated_flags` → REMOVED (pruned)
- `scenario_domains` → Resource: `domains` (from `domains` table, consolidated junction table with `type_scenario_domains` enum: 'default', 'video', 'image')

**Proposed Resources**:
- `departments` (from `departments` table)
- `documents` (from `documents` table, also an artifact `document`)
- `scenario_document_ranges`, `scenario_persona_ranges`, `scenario_parameter_ranges`, `scenario_field_ranges` (from range tables)
- `personas` (from `personas` table, also an artifact `persona`)
- `parameters` (from `parameters` table, also an artifact `parameter`)
- `fields` (from `fields` table, also an artifact `field`)
- `objectives`, `problem_statements`, `questions`, `images`, `videos`, `templates`, `options` (from respective tables)
- `groups` (from `groups` table)
- `scenario_time_limits`, `scenario_tree`, `scenario_video_images` (from scenario-specific tables)
- `names`, `descriptions` (from attribute tables)
- `flags` (from `flags` table, shared resource - via `scenario_flags` junction table with `type_scenario_flags` enum)
- `domains` (from `domains` table - via `scenario_domains` junction table with `type_scenario_domains` enum)

### 4. Persona Artifact

**Artifact**: `persona` (from `personas` table)

**Tables to map**:
- `personas` (main table - artifact itself)
- `persona_departments` → Resource: `departments` (from `departments` table)
- `persona_examples` → Resource: `examples` (from `examples` table)
- `persona_fields` → Resource: `fields` (from `fields` table, artifact `field`)
- `persona_names` (from denormalization) → Resource: `names` (from `names` table)
- `persona_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `persona_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource)
- `persona_icons` (from denormalization) → Resource: `icons` (from `icons` table, shared resource)
- `persona_instructions` (from denormalization) → Resource: `instructions` (from `instructions` table)
- `persona_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")

**Proposed Resources**:
- `departments` (from `departments` table)
- `examples` (from `examples` table)
- `fields` (from `fields` table, also an artifact `field`)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `colors` (from `colors` table, shared resource - used by settings and personas)
- `icons` (from `icons` table, shared resource - used by personas and flags)
- `instructions` (from `instructions` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)

### 5. Document Artifact (Already Exists)

**Artifact**: `document` (from `documents` table)

**Tables to map**:
- `documents` (main table - artifact itself)
- `document_departments` → Resource: `departments` (from `departments` table)
- `document_fields` → Resource: `fields` (from `fields` table, artifact `field`)
- `document_groups` → Resource: `groups` (from `groups` table)
- `document_html` → Resource: `html` (from `html` table - note: `html` is singular table name)
- `document_schemas` → Resource: `schemas` (from `schemas` table)
- `document_templates` → Resource: `templates` (from `templates` table)
- `document_tree` → Resource: `document_tree` (from `document_tree` table)
- `document_uploads` → Resource: `uploads` (from `uploads` table)
- `document_names` (from denormalization) → Resource: `names` (from `names` table)
- `document_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `document_document_contents` (from denormalization) → Resource: `content` (from `content` table, shared resource - merged with existing `content` table)
- `document_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `document_template_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="template")
- `document_domains` → Resource: `domains` (from `domains` table)

**Proposed Resources**:
- `departments` (from `departments` table)
- `fields` (from `fields` table, also an artifact `field`)
- `groups` (from `groups` table)
- `html` (from `html` table - singular table name)
- `schemas` (from `schemas` table)
- `templates` (from `templates` table)
- `document_tree` (from `document_tree` table)
- `uploads` (from `uploads` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `content` (from `content` table, shared resource - merged with existing `content` table, used by documents and messages)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `domains` (from `domains` table)

### 6. Parameter Artifact

**Artifact**: `parameter` (from `parameters` table)

**Tables to map**:
- `parameters` (main table - artifact itself)
- `parameter_departments` → Resource: `departments` (from `departments` table)
- `parameter_names` (from denormalization) → Resource: `names` (from `names` table)
- `parameter_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `parameter_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `parameter_document_parameter_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="document_parameter")
- `parameter_persona_parameter_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="persona_parameter")
- `parameter_scenario_parameter_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="scenario_parameter")
- `parameter_video_parameter_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="video_parameter")
- `parameter_simulation_parameter_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="simulation_parameter")

**Proposed Resources**:
- `departments` (from `departments` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)

### 7. Field Artifact

**Artifact**: `field` (from `fields` table)

**Tables to map**:
- `fields` (main table - artifact itself)
- `field_departments` → Resource: `departments` (from `departments` table)
- `field_conditional_parameters` → Resource: `field_conditional_parameters` (from `field_conditional_parameters` table, which references `parameters` table)
- `field_names` (from denormalization) → Resource: `names` (from `names` table)
- `field_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `field_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `field_parameters` → Resource: `parameters` (from `parameters` table, artifact `parameter`)

**Proposed Resources**:
- `departments` (from `departments` table)
- `field_conditional_parameters` (from `field_conditional_parameters` table, references `parameters`)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `parameters` (from `parameters` table, also an artifact `parameter`)

**Note**: `field` is both an artifact (singular) and a resource (plural `fields`). When `field` artifact is referenced by `document` artifact via `document_fields` junction table, the resource is `fields`.

### 8. Agent Artifact (Already Exists)

**Artifact**: `agent` (from `agents` table)

**Tables to map**:
- `agents` (main table - artifact itself)
- `agent_departments` → Resource: `departments` (from `departments` table)
- `agent_prompts` → Resource: `prompts` (from `prompts` table)
- `agent_department_prompts` → Resource: `agent_department_prompts` (from `agent_department_prompts` table)
- `agent_developer_instructions` → Resource: `developer_instructions` (from `developer_instructions` table)
- `agent_tools` → Resource: `tools` (from `tools` table)
- `agent_reasoning_levels` → Resource: `model_reasoning_levels` (from `model_reasoning_levels` table)
- `agent_temperature_levels` → Resource: `model_temperature_levels` (from `model_temperature_levels` table)
- `agent_voices` → Resource: `model_voices` (from `model_voices` table)
- `agent_names` (from denormalization) → Resource: `names` (from `names` table)
- `agent_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `agent_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `agent_models` → Resource: `models` (from `models` table, artifact `model`)

**Proposed Resources**:
- `departments` (from `departments` table)
- `prompts` (from `prompts` table)
- `agent_department_prompts` (from `agent_department_prompts` table)
- `developer_instructions` (from `developer_instructions` table)
- `tools` (from `tools` table)
- `model_reasoning_levels` (from `model_reasoning_levels` table)
- `model_temperature_levels` (from `model_temperature_levels` table)
- `model_voices` (from `model_voices` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `models` (from `models` table, also an artifact `model`)

### 9. Model Artifact

**Artifact**: `model` (from `models` table)

**Tables to map**:
- `models` (main table - artifact itself)
- `model_departments` → Resource: `departments` (from `departments` table)
- `model_endpoints` → Resource: `model_endpoints` (from `model_endpoints` table)
- `model_modalities` → Resource: `model_modalities` (from `model_modalities` table)
- `model_pricing` → Resource: `model_pricing` (from `model_pricing` table)
- `model_qualities` → Resource: `model_qualities` (from `model_qualities` table)
- `model_reasoning_levels` → Resource: `model_reasoning_levels` (from `model_reasoning_levels` table)
- `model_temperature_levels` → Resource: `model_temperature_levels` (from `model_temperature_levels` table)
- `model_voices` → Resource: `model_voices` (from `model_voices` table)
- `model_names` (from denormalization) → Resource: `names` (from `names` table)
- `model_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `model_values` (from denormalization) → Resource: `values` (from `values` table)
- `model_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `model_providers` → Resource: `providers` (from `providers` table, artifact `provider`)

**Proposed Resources**:
- `departments` (from `departments` table)
- `model_endpoints` (from `model_endpoints` table)
- `model_modalities` (from `model_modalities` table)
- `model_pricing` (from `model_pricing` table)
- `model_qualities` (from `model_qualities` table)
- `model_reasoning_levels` (from `model_reasoning_levels` table)
- `model_temperature_levels` (from `model_temperature_levels` table)
- `model_voices` (from `model_voices` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `values` (from `values` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `providers` (from `providers` table, also an artifact `provider`)

### 10. Rubric Artifact (Already Exists)

**Artifact**: `rubric` (from `rubrics` table)

**Tables to map**:
- `rubrics` (main table - artifact itself)
- `rubric_departments` → Resource: `departments` (from `departments` table)
- `rubric_groups` → Resource: `groups` (from `groups` table)
- `rubric_standard_groups` → Resource: `standard_groups` (from `standard_groups` table)
- `rubric_grade_agents` → Resource: `rubric_grade_agents` (from `rubric_grade_agents` table)
- `rubric_grade_agents_audio` → Resource: `rubric_grade_agents_audio` (from `rubric_grade_agents_audio` table)
- `rubric_names` (from denormalization) → Resource: `names` (from `names` table)
- `rubric_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `rubric_points` (from denormalization) → Resource: `points` (from `points` table)
- `rubric_pass_points` (from denormalization) → Resource: `pass_points` (from `pass_points` table)
- `rubric_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `rubric_artifacts` (from denormalization) → Resource: `artifacts` (from artifacts enum - note: enum name is plural)
- `rubric_domains` → Resource: `domains` (from `domains` table)

**Proposed Resources**:
- `departments` (from `departments` table)
- `groups` (from `groups` table)
- `standard_groups` (from `standard_groups` table)
- `rubric_grade_agents` (from `rubric_grade_agents` table)
- `rubric_grade_agents_audio` (from `rubric_grade_agents_audio` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `points` (from `points` table - via `rubric_points` junction table with `type_rubric_points` enum: 'total', 'pass')
- `flags` (from `flags` table, shared resource - via `rubric_flags` junction table with `type_rubric_flags` enum)
- `artifacts` (from artifacts enum)
- `domains` (from `domains` table)

### 11. Eval Artifact

**Artifact**: `eval` (from `evals` table)

**Tables to map**:
- `evals` (main table - artifact itself)
- `eval_departments` → Resource: `departments` (from `departments` table)
- `eval_agents` → Resource: `agents` (from `agents` table, artifact `agent`)
- `eval_groups` → Resource: `groups` (from `groups` table)
- `eval_groups_rubric_grade_agents` → Resource: `rubric_grade_agents` (from `rubric_grade_agents` table)
- `eval_runs` → Resource: `runs` (from `runs` table, artifact `run`)
- `eval_runs_rubric_grade_agents` → Resource: `rubric_grade_agents` (from `rubric_grade_agents` table)
- `eval_attempts` → Resource: `eval_attempts` (from `eval_attempts` table)
- `eval_names` (from denormalization) → Resource: `names` (from `names` table)
- `eval_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `eval_flags` → Resource: `flags` (from `flags` table, shared resource, consolidated junction table with `type_eval_flags` enum: 'active', 'dynamic', 'groups')

**Proposed Resources**:
- `departments` (from `departments` table)
- `agents` (from `agents` table, also an artifact `agent`)
- `groups` (from `groups` table)
- `rubric_grade_agents` (from `rubric_grade_agents` table)
- `runs` (from `runs` table, also an artifact `run`)
- `eval_attempts` (from `eval_attempts` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)

### 12. Department Artifact

**Artifact**: `department` (from `departments` table)

**Tables to map**:
- `departments` (main table - artifact itself)
- `department_settings` → Resource: `settings` (from `settings` table, artifact `setting`)
- `department_names` (from denormalization) → Resource: `names` (from `names` table)
- `department_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `department_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")

**Proposed Resources**:
- `settings` (from `settings` table, also an artifact `setting`)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `active_flags` (from `active_flags` table)

### 13. Provider Artifact

**Artifact**: `provider` (from `providers` table)

**Tables to map**:
- `providers` (main table - artifact itself)
- `provider_endpoints` → Resource: `provider_endpoints` (from `provider_endpoints` table)
- `provider_names` (from denormalization) → Resource: `names` (from `names` table)
- `provider_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `provider_values` (from denormalization) → Resource: `values` (from `values` table)
- `provider_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")

**Proposed Resources**:
- `provider_endpoints` (from `provider_endpoints` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `values` (from `values` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)

### 14. Auth Artifact

**Artifact**: `auth` (from `auth` table)

**Tables to map**:
- `auth` (main table - artifact itself)
- `auth_items` → Resource: `auth_items` (from `auth_items` table)
- `auth_names` (from denormalization) → Resource: `names` (from `names` table)
- `auth_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `auth_slugs` (from denormalization) → Resource: `slugs` (from `slugs` table)
- `auth_icon_urls` (from denormalization) → Resource: `icon_urls` (from `icon_urls` table)
- `auth_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `auth_auth_types` (from denormalization) → Resource: `auth_types` (from `auth_types` table)

**Proposed Resources**:
- `auth_items` (from `auth_items` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `slugs` (from `slugs` table)
- `icon_urls` (from `icon_urls` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `auth_types` (from `auth_types` table)

### 15. Key Artifact

**Artifact**: `key` (from `keys` table)

**Tables to map**:
- `keys` (main table - artifact itself)
- `key_names` (from denormalization) → Resource: `names` (from `names` table)
- `key_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `key_keys` (from denormalization) → Resource: `key_values` (from `key_values` table)
- `key_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")

**Proposed Resources**:
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `key_values` (from `key_values` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)

### 16. Setting Artifact

**Artifact**: `setting` (from `settings` table)

**Tables to map**:
- `settings` (main table - artifact itself)
- `setting_auths` → Resource: `auth` (from `auth` table, artifact `auth` - note: `auth` is singular table name)
- `setting_auth_keys` → Resource: `setting_auth_keys` (from `setting_auth_keys` table)
- `setting_auth_values` → Resource: `setting_auth_values` (from `setting_auth_values` table)
- `setting_providers` → Resource: `providers` (from `providers` table, artifact `provider`)
- `setting_provider_keys` → Resource: `setting_provider_keys` (from `setting_provider_keys` table)
- `settings_default_account` → Resource: `settings_default_account` (from `settings_default_account` table)
- `settings_default_department` → Resource: `settings_default_department` (from `settings_default_department` table)
- `settings_default_guest` → Resource: `settings_default_guest` (from `settings_default_guest` table)
- `setting_names` (from denormalization) → Resource: `names` (from `names` table)
- `setting_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `setting_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `setting_guest_login_enabled_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="guest_login_enabled")
- `setting_primary_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="primary")
- `setting_accent_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="accent")
- `setting_background_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="background")
- `setting_surface_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="surface")
- `setting_success_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="success")
- `setting_warning_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="warning")
- `setting_error_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="error")
- `setting_sidebar_background_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="sidebar_background")
- `setting_sidebar_primary_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="sidebar_primary")
- `setting_chart1_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="chart1")
- `setting_chart2_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="chart2")
- `setting_chart3_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="chart3")
- `setting_chart4_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="chart4")
- `setting_chart5_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="chart5")
- `setting_success_thresholds` (from denormalization) → Resource: `success_thresholds` (from `success_thresholds` table)
- `setting_warning_thresholds` (from denormalization) → Resource: `warning_thresholds` (from `warning_thresholds` table)
- `setting_danger_thresholds` (from denormalization) → Resource: `danger_thresholds` (from `danger_thresholds` table)

**Proposed Resources**: ~15+ unique resources for settings (many junction tables reference same resources)
- `auth` (from `auth` table, also an artifact `auth` - singular table name)
- `setting_auth_keys`, `setting_auth_values` (from setting junction tables)
- `providers` (from `providers` table, also an artifact `provider`)
- `setting_provider_keys` (from setting junction table)
- `settings_default_account`, `settings_default_department`, `settings_default_guest` (from settings default tables)
- `names`, `descriptions` (from attribute tables)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `colors` (from `colors` table, shared resource - used by settings and personas)
- `success_thresholds`, `warning_thresholds`, `danger_thresholds` (from threshold tables)

### 17. Profile Artifact

**Artifact**: `profile` (from `profiles` table)

**Tables to map**:
- `profiles` (main table - artifact itself)
- `profile_departments` → Resource: `departments` (from `departments` table)
- `profile_emails` → Resource: `profile_emails` (from `profile_emails` table)
- `profile_activity` → Resource: `profile_activity` (from `profile_activity` table)
- `profile_request_limits` → Resource: `profile_request_limits` (from `profile_request_limits` table)
- `profile_first_names` (from denormalization) → Resource: `first_names` (from `first_names` table)
- `profile_last_names` (from denormalization) → Resource: `last_names` (from `last_names` table)
- `profile_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `profile_roles` (from denormalization) → Resource: `profile_roles` (from `profile_roles` table or enum)
- `profile_last_logins` (from denormalization) → Resource: `last_logins` (from `last_logins` table)

**Proposed Resources**:
- `departments` (from `departments` table)
- `profile_emails` (from `profile_emails` table)
- `profile_activity` (from `profile_activity` table)
- `profile_request_limits` (from `profile_request_limits` table)
- `first_names` (from `first_names` table)
- `last_names` (from `last_names` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `profile_roles` (from `profile_roles` table/enum)
- `last_logins` (from `last_logins` table)

## Summary

**Total Resources Needed**: ~200+ resources (estimated)

**Breakdown**:
- Junction table resources: ~100+
- Attribute resources (from denormalization): ~100+
- Existing resources that can be reused: ~10-15

## Next Steps

See Part 4 for migration strategy.



---


# Artifacts/Resources Analysis - Part 4: Migration Strategy

## Overview

Migration strategy to convert all 17 top-level graph components to artifacts, and all related tables to resources.

## Migration Phases

### Phase 1: Prepare Artifacts Enum

1. **Add new artifacts to enum**:
   ```sql
   ALTER TYPE artifacts ADD VALUE 'cohort';
   ALTER TYPE artifacts ADD VALUE 'simulation';
   ALTER TYPE artifacts ADD VALUE 'persona';
   ALTER TYPE artifacts ADD VALUE 'parameter';
   ALTER TYPE artifacts ADD VALUE 'field';
   ALTER TYPE artifacts ADD VALUE 'model';
   ALTER TYPE artifacts ADD VALUE 'eval';
   ALTER TYPE artifacts ADD VALUE 'department';
   ALTER TYPE artifacts ADD VALUE 'provider';
   ALTER TYPE artifacts ADD VALUE 'auth';
   ALTER TYPE artifacts ADD VALUE 'key';
   ALTER TYPE artifacts ADD VALUE 'setting';
   ALTER TYPE artifacts ADD VALUE 'profile';
   ```

2. **Resolve field conflict**:
   - Rename existing `field` resource to `document_field`
   - Update all references to `'field'::resources` to `'document_field'::resources`

### Phase 2: Add Resources to Enum

Add all new resources to the `resources` enum. This is a large operation - estimate ~200+ new resources.

**Note**: PostgreSQL doesn't support adding multiple enum values in one statement, so this will require many `ALTER TYPE` statements.

**Alternative**: Drop and recreate the enum (requires downtime):
```sql
-- 1. Create new enum with all values
CREATE TYPE resources_new AS ENUM (...all values...);

-- 2. Update all columns to use new enum
ALTER TABLE resource_schemas ALTER COLUMN resource TYPE resources_new USING resource::text::resources_new;
ALTER TABLE resource_tools ALTER COLUMN resource TYPE resources_new USING resource::text::resources_new;

-- 3. Drop old enum and rename new one
DROP TYPE resources;
ALTER TYPE resources_new RENAME TO resources;
```

### Phase 3: Update Domains Table

The `domains` table already supports the artifacts enum, so no changes needed. New artifacts will automatically work with domains.

### Phase 4: Update Resource Schemas and Resource Tools

Add entries to `resource_schemas` and `resource_tools` for new resources as needed.

### Phase 5: Update Application Code

1. **Update SQL queries** to use new artifact/resource enum values
2. **Update API endpoints** to handle new artifacts
3. **Update type definitions** (TypeScript, Python) to include new enum values

## Challenges

### 1. Enum Value Addition Limitation

PostgreSQL doesn't support adding multiple enum values in one transaction easily. Options:
- Add one at a time (slow but safe)
- Drop and recreate enum (faster but requires downtime)

### 2. Large Number of Resources

~200+ new resources need to be added. This is a massive enum.

**Consideration**: Should resources be a table instead of an enum?
- **Pros**: Easier to add new resources, no enum limitations
- **Cons**: Loses type safety, requires JOINs

### 3. Backward Compatibility

Existing code references artifacts/resources as enums. Need to ensure:
- All SQL queries updated
- All application code updated
- All migrations tested

### 4. Data Migration

No data migration needed for artifacts/resources themselves (they're enums, not data). But need to:
- Update all references in code
- Update all SQL queries
- Test thoroughly

## Estimated Effort

- **Phase 1** (Add artifacts): 1-2 days
- **Phase 2** (Add resources): 3-5 days (due to enum limitations)
- **Phase 3** (Update domains): 0 days (no changes needed)
- **Phase 4** (Update resource tables): 1-2 days
- **Phase 5** (Update application code): 2-4 weeks
- **Testing**: 1-2 weeks

**Total**: ~4-6 weeks

## Recommendations

1. **Consider table-based resources**: Instead of enum, use a `resources` table with `artifact_id` foreign key
2. **Phased rollout**: Add artifacts/resources incrementally, not all at once
3. **Comprehensive testing**: Test each artifact/resource addition thoroughly
4. **Documentation**: Document all new artifacts/resources and their relationships

## Alternative Approach: Table-Based Resources

Instead of enum, use tables:

```sql
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name TEXT NOT NULL UNIQUE,
    artifact_id UUID NOT NULL REFERENCES artifacts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Benefits**:
- Easy to add new artifacts/resources
- No enum limitations
- Can add metadata to artifacts/resources

**Drawbacks**:
- Requires JOINs instead of enum checks
- Less type safety
- More complex queries

## Conclusion

Converting all 17 objects to artifacts and all tables to resources is a significant undertaking. The enum approach has limitations (especially for resources), but maintains type safety. The table approach is more flexible but requires more complex queries.

**Recommendation**: Start with a hybrid approach - keep artifacts as enum (small, stable set), but consider making resources a table (large, growing set).

