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

