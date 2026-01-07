# Database Migration Plan: Artifacts & Resources Architecture

## Executive Summary

This migration plan transforms the current database schema to implement a unified artifacts/resources architecture. The goal is to:

1. **Denormalize** all 17 core graph components by moving attributes to junction tables
2. **Convert** all top-level objects to artifacts (singular names)
3. **Convert** all related tables to resources (plural names)
4. **Implement** shared resources for reusable UI components (colors, flags, icons, content)
5. **Consolidate** junction tables using type enums to reduce table explosion

**Timeline**: This is a major migration that should be executed in phases with careful testing at each step.

---

## Part 1: Current State Analysis

### 17 Core Graph Components

The following 17 tables represent the core graph components in the system:

1. `cohorts`
2. `simulations`
3. `scenarios`
4. `personas`
5. `documents`
6. `parameters`
7. `fields`
8. `agents`
9. `models`
10. `rubrics`
11. `evals`
12. `departments`
13. `providers`
14. `auth`
15. `keys`
16. `settings`
17. `profiles`

### Current Denormalization Status

**0 out of 17 objects are fully denormalized.** All objects currently have attributes stored directly in the main table (beyond `id`, `created_at`, `updated_at`).

### Current Table Structures and Attributes

#### Scenarios Table
**Current Columns:**
- `id`, `created_at`, `updated_at` (standard)
- `name` (text)
- `generated` (boolean) - **TO BE PRUNED**
- `active` (boolean)
- `objectives_enabled` (boolean)
- `images_enabled` (boolean)
- `video_enabled` (boolean)
- `questions_enabled` (boolean)
- `problem_statement_enabled` (boolean)
- `description` (text)
- `scenario_domain_id` (uuid, FK to domains)
- `video_domain_id` (uuid, FK to domains)
- `image_domain_id` (uuid, FK to domains)

**Attributes to Denormalize:**
- Flags: `active`, `objectives_enabled`, `images_enabled`, `video_enabled`, `questions_enabled`, `problem_statement_enabled`
- Domains: `scenario_domain_id`, `video_domain_id`, `image_domain_id`
- Text attributes: `name`, `description`

#### Evals Table
**Current Columns:**
- `id`, `created_at`, `updated_at` (standard)
- `name` (text)
- `description` (text)
- `active` (boolean)
- `dynamic` (boolean)
- `use_groups` (boolean) - **TO BE RENAMED to `groups`**

**Attributes to Denormalize:**
- Flags: `active`, `dynamic`, `use_groups` (rename to `groups`)
- Text attributes: `name`, `description`

#### Simulations Table
**Current Columns:**
- `id`, `created_at`, `updated_at` (standard)
- `title` (text) - **TO BE RENAMED to `name`**
- `description` (text)
- `active` (boolean)
- `practice_simulation` (boolean) - **TO BE RENAMED to `practice`**
- `simulation_text_domain_id` (uuid, FK to domains)
- `simulation_voice_domain_id` (uuid, FK to domains)

**Attributes to Denormalize:**
- Flags: `active`, `practice_simulation` (rename to `practice`)
- Domains: `simulation_text_domain_id`, `simulation_voice_domain_id`
- Text attributes: `title` (rename to `name`), `description`

#### Rubrics Table
**Current Columns:**
- `id`, `created_at`, `updated_at` (standard)
- `name` (text)
- `description` (text)
- `points` (integer) - **TO BE CONSOLIDATED with `pass_points`**
- `pass_points` (integer) - **TO BE CONSOLIDATED with `points`**
- `active` (boolean)
- `rubric_domain_id` (uuid, FK to domains)
- `artifact` (artifacts enum)

**Attributes to Denormalize:**
- Flags: `active`
- Points: `points`, `pass_points` (consolidate into single `points` resource with type enum)
- Domains: `rubric_domain_id`
- Text attributes: `name`, `description`

#### Documents Table
**Current Columns:**
- `id`, `created_at`, `updated_at` (standard)
- `name` (text)
- `description` (text)
- `active` (boolean)
- `template` (boolean)
- `classified` (boolean) - **TO BE PRUNED**
- `content` (text) - **TO BE MERGED with existing `content` table**
- `document_domain_id` (uuid, FK to domains)

**Attributes to Denormalize:**
- Flags: `active`, `template`
- Content: `content` (merge with existing `content` table)
- Domains: `document_domain_id`
- Text attributes: `name`, `description`

#### Personas Table
**Current Columns:**
- `id`, `created_at`, `updated_at` (standard)
- `name` (text)
- `description` (text)
- `color` (text) - **TO BE MOVED to shared `colors` resource**
- `icon` (text) - **TO BE MOVED to shared `icons` resource**
- `active` (boolean)
- `instructions` (text)

**Attributes to Denormalize:**
- Flags: `active`
- Colors: `color` (move to shared `colors` resource)
- Icons: `icon` (move to shared `icons` resource)
- Text attributes: `name`, `description`, `instructions`

#### Settings Table
**Current Columns:**
- `id`, `created_at`, `updated_at` (standard)
- `name` (text)
- `description` (text)
- `active` (boolean)
- `guest_login_enabled` (boolean)
- `primary_color` (text) - **TO BE MOVED to shared `colors` resource**
- `accent` (text) - **TO BE MOVED to shared `colors` resource**
- `background` (text) - **TO BE MOVED to shared `colors` resource**
- `surface` (text) - **TO BE MOVED to shared `colors` resource**
- `success` (text) - **TO BE MOVED to shared `colors` resource**
- `warning` (text) - **TO BE MOVED to shared `colors` resource**
- `error` (text) - **TO BE MOVED to shared `colors` resource**
- `sidebar_background` (text) - **TO BE MOVED to shared `colors` resource**
- `sidebar_primary` (text) - **TO BE MOVED to shared `colors` resource**
- `chart1` (text) - **TO BE MOVED to shared `colors` resource**
- `chart2` (text) - **TO BE MOVED to shared `colors` resource**
- `chart3` (text) - **TO BE MOVED to shared `colors` resource**
- `chart4` (text) - **TO BE MOVED to shared `colors` resource**
- `chart5` (text) - **TO BE MOVED to shared `colors` resource**
- `success_threshold` (integer)
- `warning_threshold` (integer)
- `danger_threshold` (integer)

**Attributes to Denormalize:**
- Flags: `active`, `guest_login_enabled`
- Colors: All color columns (move to shared `colors` resource)
- Text attributes: `name`, `description`
- Thresholds: `success_threshold`, `warning_threshold`, `danger_threshold`

#### Profiles Table
**Current Columns:**
- `id`, `created_at`, `updated_at` (standard)
- `first_name` (text) - **TO BE CONVERTED to `profile_names` junction table with type='first'**
- `last_name` (text) - **TO BE CONVERTED to `profile_names` junction table with type='last'**
- `role` (profile_role enum)
- `active` (boolean)
- `last_login` (timestamptz)

**Attributes to Denormalize:**
- Flags: `active`
- Names: `first_name`, `last_name` → convert to `profile_names` junction table with `type_profile_names` enum ('first', 'last', 'full')
  - 'full' type concatenates first + ' ' + last
- Other: `role`, `last_login`

#### Other Tables
Similar patterns exist for:
- `cohorts`: `title` (rename to `name`), `description`, `active`
- `parameters`: `name`, `description`, `active`, plus boolean flags for parameter types
- `fields`: `name`, `description`, `active`, `parameter_id` (FK → convert to `parameter_fields` junction table)
- `agents`: `name`, `description`, `active`, `model_id` (FK → convert to `agent_models` junction table)
- `models`: `name`, `description`, `active`, `value`, `provider_id` (FK → convert to `model_providers` junction table)
- `departments`: `title` (rename to `name`), `description`, `active`
- `providers`: `name`, `description`, `value`, `active`
- `auth`: `name`, `description`, `active`, `auth_type`, `slug`, `icon_url`
- `keys`: `key`, `active`, `name`, `description`

### Existing Junction Tables

**92+ junction tables exist**, mostly for relationships (many-to-many), not for attributes. Examples:
- `scenario_departments`, `scenario_documents`, `scenario_personas` (relationships)
- `persona_departments`, `agent_departments` (relationships)
- `document_fields`, `parameter_departments` (relationships)

**No consolidated flag/domain/point junction tables exist yet.**

---

## Part 2: Core Concepts

### Artifacts
- **Definition**: Top-level, strong entity tables with singular names
- **Examples**: `scenario`, `persona`, `document`, `field`, `profile`, `cohort`, `simulation`, `parameter`, `agent`, `model`, `rubric`, `eval`, `department`, `provider`, `auth`, `key`, `setting`
- **Current State**: 8 artifacts exist in enum, need to add 9 more
- **Target State**: All 17 core objects become artifacts

### Resources
- **Definition**: Sub-entities or attributes that belong to artifacts, with plural names matching table names
- **Examples**: `personas`, `departments`, `emails`, `names`, `descriptions`, `colors`, `flags`, `icons`, `content`
- **Pattern**: Resources are the plural form of table names (e.g., `departments` table → `departments` resource)

### Junction Tables
- **Pattern**: `{artifact}_{resource}` where artifact is singular and resource is plural
- **Examples**: `scenario_personas`, `profile_departments`, `document_fields`
- **Consolidation**: When multiple junction tables link the same artifact to the same resource type, use a single junction table with a `type` enum column

### Type Enums
- **Naming Schema**: `type_{artifact}_{resource}` (e.g., `type_scenario_flags`, `type_eval_flags`, `type_simulation_domains`)
- **Purpose**: Distinguish between different types of the same resource for an artifact
- **Rule**: Only add `type` column when multiple types are needed (if only one type exists, no type needed)

---

## Part 3: Migration Phases

### Phase 1: Pruning and Renaming

This phase cleans up the current schema by removing unused columns and renaming columns to match our naming conventions.

#### 1.1 Prune Unused Columns

**Remove unused columns:**
```sql
-- Remove scenario.generated column
ALTER TABLE scenarios DROP COLUMN IF EXISTS generated;

-- Remove document.classified column
ALTER TABLE documents DROP COLUMN IF EXISTS classified;
```

#### 1.2 Rename Columns for Consistency

**Rename `title` to `name` in cohorts:**
```sql
ALTER TABLE cohorts RENAME COLUMN title TO name;
```

**Rename `title` to `name` in simulations:**
```sql
ALTER TABLE simulations RENAME COLUMN title TO name;
```

**Rename `title` to `name` in departments:**
```sql
ALTER TABLE departments RENAME COLUMN title TO name;
```

**Rename `use_groups` to `groups` in evals:**
```sql
ALTER TABLE evals RENAME COLUMN use_groups TO groups;
```

**Rename `practice_simulation` to `practice` in simulations:**
```sql
ALTER TABLE simulations RENAME COLUMN practice_simulation TO practice;
```

#### 1.3 Verify Pruning Complete

After pruning and renaming, verify:
- [ ] `scenario.generated` column removed
- [ ] All `title` columns renamed to `name`
- [ ] `eval.use_groups` renamed to `groups`
- [ ] `simulation.practice_simulation` renamed to `practice`

---

### Phase 2: Create Shared Resource Tables

#### 2.1 Create `colors` Table
```sql
CREATE TABLE colors (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    hex_code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX colors_hex_code_idx ON colors(hex_code);
```

**Junction Tables**:
- `setting_colors` (with `type` column: 'primary', 'accent', 'background', 'surface', 'success', 'warning', 'error', 'sidebar_background', 'sidebar_primary', 'chart1', 'chart2', 'chart3', 'chart4', 'chart5')
- `persona_colors`

#### 2.2 Create `flags` Table
```sql
CREATE TABLE flags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon_id UUID REFERENCES icons(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX flags_name_idx ON flags(name);
CREATE INDEX flags_icon_id_idx ON flags(icon_id);
```

#### 2.3 Create `icons` Table
```sql
CREATE TABLE icons (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX icons_value_idx ON icons(value);
```

#### 2.4 Extend `content` Table
The `content` table already exists. Add `document_content` junction table:
```sql
CREATE TABLE document_content (
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (document_id, content_id)
);

CREATE INDEX document_content_document_id_idx ON document_content(document_id);
CREATE INDEX document_content_content_id_idx ON document_content(content_id);
```

#### 2.5 Create `names` Table (Shared Attribute)
```sql
CREATE TABLE names (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX names_name_idx ON names(name);
```

#### 2.6 Create `descriptions` Table (Shared Attribute)
```sql
CREATE TABLE descriptions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 2.7 Create `points` Table (For Rubrics)
```sql
CREATE TABLE points (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    value INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX points_value_idx ON points(value);
```

#### 2.8 Create `thresholds` Table (For Settings)
```sql
CREATE TABLE thresholds (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    value INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX thresholds_value_idx ON thresholds(value);
```

---

### Phase 3: Create Type Enums

#### 3.1 Flag Type Enums
```sql
CREATE TYPE type_scenario_flags AS ENUM (
    'active', 'objectives_enabled', 'images_enabled', 
    'video_enabled', 'questions_enabled', 'problem_statement_enabled'
);

CREATE TYPE type_eval_flags AS ENUM ('active', 'dynamic', 'groups');

CREATE TYPE type_document_flags AS ENUM ('active', 'template');

CREATE TYPE type_parameter_flags AS ENUM (
    'active', 'document_parameter', 'persona_parameter', 
    'scenario_parameter', 'video_parameter', 'simulation_parameter'
);

CREATE TYPE type_simulation_flags AS ENUM ('active', 'practice');

CREATE TYPE type_cohort_flags AS ENUM ('active');
CREATE TYPE type_persona_flags AS ENUM ('active');
CREATE TYPE type_field_flags AS ENUM ('active');
CREATE TYPE type_agent_flags AS ENUM ('active');
CREATE TYPE type_model_flags AS ENUM ('active');
CREATE TYPE type_rubric_flags AS ENUM ('active');
CREATE TYPE type_department_flags AS ENUM ('active');
CREATE TYPE type_provider_flags AS ENUM ('active');
CREATE TYPE type_auth_flags AS ENUM ('active');
CREATE TYPE type_key_flags AS ENUM ('active');
CREATE TYPE type_setting_flags AS ENUM ('active', 'guest_login_enabled');
CREATE TYPE type_profile_flags AS ENUM ('active');
```

#### 3.2 Domain Type Enums
```sql
CREATE TYPE type_simulation_domains AS ENUM ('text', 'voice');

CREATE TYPE type_scenario_domains AS ENUM ('default', 'video', 'image');
```

#### 3.3 Point Type Enums
```sql
CREATE TYPE type_rubric_points AS ENUM ('total', 'pass');
```

#### 3.4 Color Type Enums
```sql
CREATE TYPE type_setting_colors AS ENUM (
    'primary', 'accent', 'background', 'surface', 'success', 
    'warning', 'error', 'sidebar_background', 'sidebar_primary', 
    'chart1', 'chart2', 'chart3', 'chart4', 'chart5'
);
```

#### 3.5 Threshold Type Enums
```sql
CREATE TYPE type_setting_thresholds AS ENUM ('success', 'warning', 'danger');
```

#### 3.6 Profile Name Type Enums
```sql
CREATE TYPE type_profile_names AS ENUM ('first', 'last', 'full');
```

---

### Phase 4: Create Consolidated Junction Tables

#### 4.1 Flag Junction Tables

For each artifact, create a consolidated flag junction table:

```sql
-- Scenario Flags
CREATE TABLE scenario_flags (
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    flag_id UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
    type type_scenario_flags NOT NULL,
    value BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (scenario_id, flag_id, type)
);

CREATE INDEX scenario_flags_scenario_id_idx ON scenario_flags(scenario_id);
CREATE INDEX scenario_flags_flag_id_idx ON scenario_flags(flag_id);
CREATE INDEX scenario_flags_type_idx ON scenario_flags(type);

-- Eval Flags
CREATE TABLE eval_flags (
    eval_id UUID NOT NULL REFERENCES evals(id) ON DELETE CASCADE,
    flag_id UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
    type type_eval_flags NOT NULL,
    value BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (eval_id, flag_id, type)
);

CREATE INDEX eval_flags_eval_id_idx ON eval_flags(eval_id);
CREATE INDEX eval_flags_flag_id_idx ON eval_flags(flag_id);
CREATE INDEX eval_flags_type_idx ON eval_flags(type);

-- Document Flags
CREATE TABLE document_flags (
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    flag_id UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
    type type_document_flags NOT NULL,
    value BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (document_id, flag_id, type)
);

CREATE INDEX document_flags_document_id_idx ON document_flags(document_id);
CREATE INDEX document_flags_flag_id_idx ON document_flags(flag_id);
CREATE INDEX document_flags_type_idx ON document_flags(type);

-- Parameter Flags
CREATE TABLE parameter_flags (
    parameter_id UUID NOT NULL REFERENCES parameters(id) ON DELETE CASCADE,
    flag_id UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
    type type_parameter_flags NOT NULL,
    value BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (parameter_id, flag_id, type)
);

CREATE INDEX parameter_flags_parameter_id_idx ON parameter_flags(parameter_id);
CREATE INDEX parameter_flags_flag_id_idx ON parameter_flags(flag_id);
CREATE INDEX parameter_flags_type_idx ON parameter_flags(type);

-- Simulation Flags
CREATE TABLE simulation_flags (
    simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    flag_id UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
    type type_simulation_flags NOT NULL,
    value BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (simulation_id, flag_id, type)
);

CREATE INDEX simulation_flags_simulation_id_idx ON simulation_flags(simulation_id);
CREATE INDEX simulation_flags_flag_id_idx ON simulation_flags(flag_id);
CREATE INDEX simulation_flags_type_idx ON simulation_flags(type);

-- Similar tables for: cohort_flags, persona_flags, field_flags, agent_flags, 
-- model_flags, rubric_flags, department_flags, provider_flags, auth_flags, 
-- key_flags, setting_flags, profile_flags
```

#### 4.2 Domain Junction Tables
```sql
-- Simulation Domains
CREATE TABLE simulation_domains (
    simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    type type_simulation_domains NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (simulation_id, domain_id, type)
);

CREATE INDEX simulation_domains_simulation_id_idx ON simulation_domains(simulation_id);
CREATE INDEX simulation_domains_domain_id_idx ON simulation_domains(domain_id);
CREATE INDEX simulation_domains_type_idx ON simulation_domains(type);

-- Scenario Domains
CREATE TABLE scenario_domains (
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    type type_scenario_domains NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (scenario_id, domain_id, type)
);

CREATE INDEX scenario_domains_scenario_id_idx ON scenario_domains(scenario_id);
CREATE INDEX scenario_domains_domain_id_idx ON scenario_domains(domain_id);
CREATE INDEX scenario_domains_type_idx ON scenario_domains(type);
```

#### 4.3 Point Junction Tables
```sql
-- Rubric Points
CREATE TABLE rubric_points (
    rubric_id UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
    point_id UUID NOT NULL REFERENCES points(id) ON DELETE CASCADE,
    type type_rubric_points NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (rubric_id, point_id, type)
);

CREATE INDEX rubric_points_rubric_id_idx ON rubric_points(rubric_id);
CREATE INDEX rubric_points_point_id_idx ON rubric_points(point_id);
CREATE INDEX rubric_points_type_idx ON rubric_points(type);
```

#### 4.4 Color Junction Tables
```sql
-- Setting Colors
CREATE TABLE setting_colors (
    setting_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
    color_id UUID NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
    type type_setting_colors NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (setting_id, color_id, type)
);

CREATE INDEX setting_colors_setting_id_idx ON setting_colors(setting_id);
CREATE INDEX setting_colors_color_id_idx ON setting_colors(color_id);
CREATE INDEX setting_colors_type_idx ON setting_colors(type);

-- Persona Colors
CREATE TABLE persona_colors (
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    color_id UUID NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (persona_id, color_id)
);

CREATE INDEX persona_colors_persona_id_idx ON persona_colors(persona_id);
CREATE INDEX persona_colors_color_id_idx ON persona_colors(color_id);
```

#### 4.5 Icon Junction Tables
```sql
-- Persona Icons
CREATE TABLE persona_icons (
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    icon_id UUID NOT NULL REFERENCES icons(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (persona_id, icon_id)
);

CREATE INDEX persona_icons_persona_id_idx ON persona_icons(persona_id);
CREATE INDEX persona_icons_icon_id_idx ON persona_icons(icon_id);
```

#### 4.6 Threshold Junction Tables
```sql
-- Setting Thresholds
CREATE TABLE setting_thresholds (
    setting_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
    threshold_id UUID NOT NULL REFERENCES thresholds(id) ON DELETE CASCADE,
    type type_setting_thresholds NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (setting_id, threshold_id, type)
);

CREATE INDEX setting_thresholds_setting_id_idx ON setting_thresholds(setting_id);
CREATE INDEX setting_thresholds_threshold_id_idx ON setting_thresholds(threshold_id);
CREATE INDEX setting_thresholds_type_idx ON setting_thresholds(type);
```

#### 4.7 Profile Names Junction Table (With Type Enum)
```sql
-- Profile Names
CREATE TABLE profile_names (
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name_id UUID NOT NULL REFERENCES names(id) ON DELETE CASCADE,
    type type_profile_names NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (profile_id, name_id, type)
);

CREATE INDEX profile_names_profile_id_idx ON profile_names(profile_id);
CREATE INDEX profile_names_name_id_idx ON profile_names(name_id);
CREATE INDEX profile_names_type_idx ON profile_names(type);
```

#### 4.8 Foreign Key Junction Tables

Convert foreign keys to junction tables:

```sql
-- Parameter Fields (from fields.parameter_id)
CREATE TABLE parameter_fields (
    parameter_id UUID NOT NULL REFERENCES parameters(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (parameter_id, field_id)
);

CREATE INDEX parameter_fields_parameter_id_idx ON parameter_fields(parameter_id);
CREATE INDEX parameter_fields_field_id_idx ON parameter_fields(field_id);

-- Agent Models (from agents.model_id)
CREATE TABLE agent_models (
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (agent_id, model_id)
);

CREATE INDEX agent_models_agent_id_idx ON agent_models(agent_id);
CREATE INDEX agent_models_model_id_idx ON agent_models(model_id);

-- Model Providers (from models.provider_id)
CREATE TABLE model_providers (
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (model_id, provider_id)
);

CREATE INDEX model_providers_model_id_idx ON model_providers(model_id);
CREATE INDEX model_providers_provider_id_idx ON model_providers(provider_id);
```

#### 4.9 Attribute Junction Tables

For each artifact, create junction tables for names and descriptions:

```sql
-- Scenario Names
CREATE TABLE scenario_names (
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    name_id UUID NOT NULL REFERENCES names(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (scenario_id, name_id)
);

CREATE INDEX scenario_names_scenario_id_idx ON scenario_names(scenario_id);
CREATE INDEX scenario_names_name_id_idx ON scenario_names(name_id);

-- Scenario Descriptions
CREATE TABLE scenario_descriptions (
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    description_id UUID NOT NULL REFERENCES descriptions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (scenario_id, description_id)
);

CREATE INDEX scenario_descriptions_scenario_id_idx ON scenario_descriptions(scenario_id);
CREATE INDEX scenario_descriptions_description_id_idx ON scenario_descriptions(description_id);

-- Similar for all other artifacts: persona_names, persona_descriptions, 
-- document_names, document_descriptions, etc.
```

---

### Phase 5: Migrate Data

#### 5.1 Migrate Flags

**Step 1: Insert flag definitions into `flags` table:**
```sql
INSERT INTO flags (id, name, description, created_at, updated_at) VALUES
    (uuidv7(), 'active', 'Active flag', NOW(), NOW()),
    (uuidv7(), 'objectives_enabled', 'Objectives enabled', NOW(), NOW()),
    (uuidv7(), 'images_enabled', 'Images enabled', NOW(), NOW()),
    (uuidv7(), 'video_enabled', 'Video enabled', NOW(), NOW()),
    (uuidv7(), 'questions_enabled', 'Questions enabled', NOW(), NOW()),
    (uuidv7(), 'problem_statement_enabled', 'Problem statement enabled', NOW(), NOW()),
    (uuidv7(), 'dynamic', 'Dynamic flag', NOW(), NOW()),
    (uuidv7(), 'groups', 'Groups flag', NOW(), NOW()),
    (uuidv7(), 'template', 'Template flag', NOW(), NOW()),
    (uuidv7(), 'practice', 'Practice flag', NOW(), NOW()),
    (uuidv7(), 'guest_login_enabled', 'Guest login enabled', NOW(), NOW()),
    (uuidv7(), 'document_parameter', 'Document parameter flag', NOW(), NOW()),
    (uuidv7(), 'persona_parameter', 'Persona parameter flag', NOW(), NOW()),
    (uuidv7(), 'scenario_parameter', 'Scenario parameter flag', NOW(), NOW()),
    (uuidv7(), 'video_parameter', 'Video parameter flag', NOW(), NOW()),
    (uuidv7(), 'simulation_parameter', 'Simulation parameter flag', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
```

**Step 2: Migrate scenario flags:**
```sql
-- Migrate scenario.active
INSERT INTO scenario_flags (scenario_id, flag_id, type, value, created_at, updated_at)
SELECT 
    s.id,
    f.id,
    'active'::type_scenario_flags,
    s.active,
    s.created_at,
    s.updated_at
FROM scenarios s
CROSS JOIN flags f
WHERE f.name = 'active';

-- Migrate scenario.objectives_enabled
INSERT INTO scenario_flags (scenario_id, flag_id, type, value, created_at, updated_at)
SELECT 
    s.id,
    f.id,
    'objectives_enabled'::type_scenario_flags,
    s.objectives_enabled,
    s.created_at,
    s.updated_at
FROM scenarios s
CROSS JOIN flags f
WHERE f.name = 'objectives_enabled';

-- Similar for images_enabled, video_enabled, questions_enabled, problem_statement_enabled
```

**Step 3: Migrate eval flags:**
```sql
-- Migrate eval.active
INSERT INTO eval_flags (eval_id, flag_id, type, value, created_at, updated_at)
SELECT 
    e.id,
    f.id,
    'active'::type_eval_flags,
    e.active,
    e.created_at,
    e.updated_at
FROM evals e
CROSS JOIN flags f
WHERE f.name = 'active';

-- Migrate eval.dynamic
INSERT INTO eval_flags (eval_id, flag_id, type, value, created_at, updated_at)
SELECT 
    e.id,
    f.id,
    'dynamic'::type_eval_flags,
    e.dynamic,
    e.created_at,
    e.updated_at
FROM evals e
CROSS JOIN flags f
WHERE f.name = 'dynamic';

-- Migrate eval.groups (renamed from use_groups)
INSERT INTO eval_flags (eval_id, flag_id, type, value, created_at, updated_at)
SELECT 
    e.id,
    f.id,
    'groups'::type_eval_flags,
    e.groups,
    e.created_at,
    e.updated_at
FROM evals e
CROSS JOIN flags f
WHERE f.name = 'groups';
```

**Step 4: Migrate simulation flags:**
```sql
-- Migrate simulation.active
INSERT INTO simulation_flags (simulation_id, flag_id, type, value, created_at, updated_at)
SELECT 
    s.id,
    f.id,
    'active'::type_simulation_flags,
    s.active,
    s.created_at,
    s.updated_at
FROM simulations s
CROSS JOIN flags f
WHERE f.name = 'active';

-- Migrate simulation.practice (renamed from practice_simulation)
INSERT INTO simulation_flags (simulation_id, flag_id, type, value, created_at, updated_at)
SELECT 
    s.id,
    f.id,
    'practice'::type_simulation_flags,
    s.practice,
    s.created_at,
    s.updated_at
FROM simulations s
CROSS JOIN flags f
WHERE f.name = 'practice';
```

**Step 5: Migrate all other artifact flags** (similar pattern for documents, parameters, personas, etc.)

#### 5.2 Migrate Domains

**Step 1: Migrate simulation domains:**
```sql
-- Migrate simulation_text_domain_id
INSERT INTO simulation_domains (simulation_id, domain_id, type, created_at, updated_at)
SELECT 
    s.id,
    s.simulation_text_domain_id,
    'text'::type_simulation_domains,
    s.created_at,
    s.updated_at
FROM simulations s
WHERE s.simulation_text_domain_id IS NOT NULL;

-- Migrate simulation_voice_domain_id
INSERT INTO simulation_domains (simulation_id, domain_id, type, created_at, updated_at)
SELECT 
    s.id,
    s.simulation_voice_domain_id,
    'voice'::type_simulation_domains,
    s.created_at,
    s.updated_at
FROM simulations s
WHERE s.simulation_voice_domain_id IS NOT NULL;
```

**Step 2: Migrate scenario domains:**
```sql
-- Migrate scenario_domain_id
INSERT INTO scenario_domains (scenario_id, domain_id, type, created_at, updated_at)
SELECT 
    s.id,
    s.scenario_domain_id,
    'default'::type_scenario_domains,
    s.created_at,
    s.updated_at
FROM scenarios s
WHERE s.scenario_domain_id IS NOT NULL;

-- Migrate video_domain_id
INSERT INTO scenario_domains (scenario_id, domain_id, type, created_at, updated_at)
SELECT 
    s.id,
    s.video_domain_id,
    'video'::type_scenario_domains,
    s.created_at,
    s.updated_at
FROM scenarios s
WHERE s.video_domain_id IS NOT NULL;

-- Migrate image_domain_id
INSERT INTO scenario_domains (scenario_id, domain_id, type, created_at, updated_at)
SELECT 
    s.id,
    s.image_domain_id,
    'image'::type_scenario_domains,
    s.created_at,
    s.updated_at
FROM scenarios s
WHERE s.image_domain_id IS NOT NULL;
```

#### 5.3 Migrate Points

**Step 1: Insert point values into `points` table:**
```sql
-- Insert unique point values from rubrics
INSERT INTO points (id, value, created_at, updated_at)
SELECT DISTINCT
    uuidv7(),
    r.points,
    MIN(r.created_at),
    MAX(r.updated_at)
FROM rubrics r
WHERE r.points IS NOT NULL
GROUP BY r.points
ON CONFLICT DO NOTHING;

-- Insert unique pass_point values from rubrics
INSERT INTO points (id, value, created_at, updated_at)
SELECT DISTINCT
    uuidv7(),
    r.pass_points,
    MIN(r.created_at),
    MAX(r.updated_at)
FROM rubrics r
WHERE r.pass_points IS NOT NULL
GROUP BY r.pass_points
ON CONFLICT DO NOTHING;
```

**Step 2: Migrate rubric points:**
```sql
-- Migrate rubric.points
INSERT INTO rubric_points (rubric_id, point_id, type, created_at, updated_at)
SELECT 
    r.id,
    p.id,
    'total'::type_rubric_points,
    r.created_at,
    r.updated_at
FROM rubrics r
JOIN points p ON p.value = r.points
WHERE r.points IS NOT NULL;

-- Migrate rubric.pass_points
INSERT INTO rubric_points (rubric_id, point_id, type, created_at, updated_at)
SELECT 
    r.id,
    p.id,
    'pass'::type_rubric_points,
    r.created_at,
    r.updated_at
FROM rubrics r
JOIN points p ON p.value = r.pass_points
WHERE r.pass_points IS NOT NULL;
```

#### 5.4 Migrate Colors

**Step 1: Insert color values into `colors` table:**
```sql
-- Migrate setting colors
INSERT INTO colors (id, name, description, hex_code, created_at, updated_at)
SELECT DISTINCT
    uuidv7(),
    'primary',
    'Primary color',
    s.primary_color,
    MIN(s.created_at),
    MAX(s.updated_at)
FROM settings s
WHERE s.primary_color IS NOT NULL
GROUP BY s.primary_color
ON CONFLICT DO NOTHING;

-- Similar for all other color types: accent, background, surface, success, warning, error, 
-- sidebar_background, sidebar_primary, chart1, chart2, chart3, chart4, chart5

-- Migrate persona colors
INSERT INTO colors (id, name, description, hex_code, created_at, updated_at)
SELECT DISTINCT
    uuidv7(),
    'persona_color',
    'Persona color',
    p.color,
    MIN(p.created_at),
    MAX(p.updated_at)
FROM personas p
WHERE p.color IS NOT NULL
GROUP BY p.color
ON CONFLICT DO NOTHING;
```

**Step 2: Create junction table entries:**
```sql
-- Migrate setting colors
INSERT INTO setting_colors (setting_id, color_id, type, created_at, updated_at)
SELECT 
    s.id,
    c.id,
    'primary'::type_setting_colors,
    s.created_at,
    s.updated_at
FROM settings s
JOIN colors c ON c.hex_code = s.primary_color AND c.name = 'primary'
WHERE s.primary_color IS NOT NULL;

-- Similar for all other color types...

-- Migrate persona colors
INSERT INTO persona_colors (persona_id, color_id, created_at, updated_at)
SELECT 
    p.id,
    c.id,
    p.created_at,
    p.updated_at
FROM personas p
JOIN colors c ON c.hex_code = p.color AND c.name = 'persona_color'
WHERE p.color IS NOT NULL;
```

#### 5.5 Migrate Icons

**Step 1: Insert icon values into `icons` table:**
```sql
-- Migrate persona icons
INSERT INTO icons (id, name, description, value, created_at, updated_at)
SELECT DISTINCT
    uuidv7(),
    'persona_icon',
    'Persona icon',
    p.icon,
    MIN(p.created_at),
    MAX(p.updated_at)
FROM personas p
WHERE p.icon IS NOT NULL
GROUP BY p.icon
ON CONFLICT DO NOTHING;
```

**Step 2: Create junction table entries:**
```sql
-- Migrate persona icons
INSERT INTO persona_icons (persona_id, icon_id, created_at, updated_at)
SELECT 
    p.id,
    i.id,
    p.created_at,
    p.updated_at
FROM personas p
JOIN icons i ON i.value = p.icon AND i.name = 'persona_icon'
WHERE p.icon IS NOT NULL;
```

#### 5.6 Migrate Content

**Step 1: Insert document content into `content` table:**
```sql
-- Migrate document.content
INSERT INTO content (id, content, created_at, updated_at)
SELECT 
    uuidv7(),
    d.content,
    d.created_at,
    d.updated_at
FROM documents d
WHERE d.content IS NOT NULL AND d.content != '';
```

**Step 2: Create junction table entries:**
```sql
-- Migrate document content
INSERT INTO document_content (document_id, content_id, created_at, updated_at)
SELECT 
    d.id,
    c.id,
    d.created_at,
    d.updated_at
FROM documents d
JOIN content c ON c.content = d.content
WHERE d.content IS NOT NULL AND d.content != '';
```

#### 5.7 Migrate Thresholds

**Step 1: Insert threshold values into `thresholds` table:**
```sql
-- Insert unique threshold values from settings
INSERT INTO thresholds (id, value, created_at, updated_at)
SELECT DISTINCT
    uuidv7(),
    s.success_threshold,
    MIN(s.created_at),
    MAX(s.updated_at)
FROM settings s
WHERE s.success_threshold IS NOT NULL
GROUP BY s.success_threshold
ON CONFLICT DO NOTHING;

INSERT INTO thresholds (id, value, created_at, updated_at)
SELECT DISTINCT
    uuidv7(),
    s.warning_threshold,
    MIN(s.created_at),
    MAX(s.updated_at)
FROM settings s
WHERE s.warning_threshold IS NOT NULL
GROUP BY s.warning_threshold
ON CONFLICT DO NOTHING;

INSERT INTO thresholds (id, value, created_at, updated_at)
SELECT DISTINCT
    uuidv7(),
    s.danger_threshold,
    MIN(s.created_at),
    MAX(s.updated_at)
FROM settings s
WHERE s.danger_threshold IS NOT NULL
GROUP BY s.danger_threshold
ON CONFLICT DO NOTHING;
```

**Step 2: Create junction table entries:**
```sql
-- Migrate setting.success_threshold
INSERT INTO setting_thresholds (setting_id, threshold_id, type, created_at, updated_at)
SELECT 
    s.id,
    t.id,
    'success'::type_setting_thresholds,
    s.created_at,
    s.updated_at
FROM settings s
JOIN thresholds t ON t.value = s.success_threshold
WHERE s.success_threshold IS NOT NULL;

-- Migrate setting.warning_threshold
INSERT INTO setting_thresholds (setting_id, threshold_id, type, created_at, updated_at)
SELECT 
    s.id,
    t.id,
    'warning'::type_setting_thresholds,
    s.created_at,
    s.updated_at
FROM settings s
JOIN thresholds t ON t.value = s.warning_threshold
WHERE s.warning_threshold IS NOT NULL;

-- Migrate setting.danger_threshold
INSERT INTO setting_thresholds (setting_id, threshold_id, type, created_at, updated_at)
SELECT 
    s.id,
    t.id,
    'danger'::type_setting_thresholds,
    s.created_at,
    s.updated_at
FROM settings s
JOIN thresholds t ON t.value = s.danger_threshold
WHERE s.danger_threshold IS NOT NULL;
```

#### 5.8 Migrate Profile Names

**Step 1: Insert profile names into `names` table:**
```sql
-- Insert unique first names
INSERT INTO names (id, name, created_at, updated_at)
SELECT DISTINCT
    uuidv7(),
    p.first_name,
    MIN(p.created_at),
    MAX(p.updated_at)
FROM profiles p
WHERE p.first_name IS NOT NULL AND p.first_name != ''
GROUP BY p.first_name
ON CONFLICT DO NOTHING;

-- Insert unique last names
INSERT INTO names (id, name, created_at, updated_at)
SELECT DISTINCT
    uuidv7(),
    p.last_name,
    MIN(p.created_at),
    MAX(p.updated_at)
FROM profiles p
WHERE p.last_name IS NOT NULL AND p.last_name != ''
GROUP BY p.last_name
ON CONFLICT DO NOTHING;

-- Insert unique full names (first + ' ' + last)
INSERT INTO names (id, name, created_at, updated_at)
SELECT DISTINCT
    uuidv7(),
    TRIM(p.first_name || ' ' || p.last_name),
    MIN(p.created_at),
    MAX(p.updated_at)
FROM profiles p
WHERE p.first_name IS NOT NULL AND p.first_name != ''
  AND p.last_name IS NOT NULL AND p.last_name != ''
GROUP BY TRIM(p.first_name || ' ' || p.last_name)
ON CONFLICT DO NOTHING;
```

**Step 2: Create junction table entries:**
```sql
-- Migrate profile.first_name
INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
SELECT 
    p.id,
    n.id,
    'first'::type_profile_names,
    p.created_at,
    p.updated_at
FROM profiles p
JOIN names n ON n.name = p.first_name
WHERE p.first_name IS NOT NULL AND p.first_name != '';

-- Migrate profile.last_name
INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
SELECT 
    p.id,
    n.id,
    'last'::type_profile_names,
    p.created_at,
    p.updated_at
FROM profiles p
JOIN names n ON n.name = p.last_name
WHERE p.last_name IS NOT NULL AND p.last_name != '';

-- Migrate profile full name
INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
SELECT 
    p.id,
    n.id,
    'full'::type_profile_names,
    p.created_at,
    p.updated_at
FROM profiles p
JOIN names n ON n.name = TRIM(p.first_name || ' ' || p.last_name)
WHERE p.first_name IS NOT NULL AND p.first_name != ''
  AND p.last_name IS NOT NULL AND p.last_name != '';
```

#### 5.9 Migrate Foreign Keys to Junction Tables

**Step 1: Migrate fields.parameter_id to parameter_fields:**
```sql
-- Migrate field.parameter_id
INSERT INTO parameter_fields (parameter_id, field_id, created_at, updated_at)
SELECT 
    f.parameter_id,
    f.id,
    f.created_at,
    f.updated_at
FROM fields f
WHERE f.parameter_id IS NOT NULL;
```

**Step 2: Migrate agents.model_id to agent_models:**
```sql
-- Migrate agent.model_id
INSERT INTO agent_models (agent_id, model_id, created_at, updated_at)
SELECT 
    a.id,
    a.model_id,
    a.created_at,
    a.updated_at
FROM agents a
WHERE a.model_id IS NOT NULL;
```

**Step 3: Migrate models.provider_id to model_providers:**
```sql
-- Migrate model.provider_id
INSERT INTO model_providers (model_id, provider_id, created_at, updated_at)
SELECT 
    m.id,
    m.provider_id,
    m.created_at,
    m.updated_at
FROM models m
WHERE m.provider_id IS NOT NULL;
```

#### 5.10 Migrate Names and Descriptions

**Step 1: Insert names into `names` table:**
```sql
-- Migrate scenario names
INSERT INTO names (id, name, created_at, updated_at)
SELECT DISTINCT
    uuidv7(),
    s.name,
    MIN(s.created_at),
    MAX(s.updated_at)
FROM scenarios s
GROUP BY s.name
ON CONFLICT DO NOTHING;

-- Similar for all other artifacts...
```

**Step 2: Create junction table entries:**
```sql
-- Migrate scenario names
INSERT INTO scenario_names (scenario_id, name_id, created_at, updated_at)
SELECT 
    s.id,
    n.id,
    s.created_at,
    s.updated_at
FROM scenarios s
JOIN names n ON n.name = s.name;

-- Similar for all other artifacts...
```

**Step 3: Migrate descriptions** (similar pattern)

---

### Phase 6: Update Artifacts Enum

Add missing artifacts to the `artifacts` enum:

```sql
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'cohort';
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'simulation';
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'persona';
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'parameter';
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'field';
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'model';
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'rubric';
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'eval';
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'department';
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'provider';
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'auth';
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'key';
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'setting';
ALTER TYPE artifacts ADD VALUE IF NOT EXISTS 'profile';
```

---

### Phase 7: Update Resources Enum/Table

**Option A**: Add to existing `resources` enum (if it exists)
**Option B**: Create `resources` table (recommended for scalability)

```sql
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX resources_name_idx ON resources(name);

-- Insert all resources
INSERT INTO resources (name) VALUES
    ('departments'), ('profiles'), ('simulations'), ('scenarios'), 
    ('personas'), ('documents'), ('parameters'), ('fields'),
    ('agents'), ('models'), ('rubrics'), ('evals'),
    ('providers'), ('auth'), ('keys'), ('settings'),
    ('names'), ('descriptions'), ('colors'), ('flags'),
    ('icons'), ('content'), ('domains'), ('points'),
    ('first_names'), ('last_names'), ('values'), ('slugs'),
    ('icon_urls'), ('key_values'), ('instructions'), ('thresholds')
ON CONFLICT (name) DO NOTHING;
```

---

### Phase 8: Drop Old Columns

After verifying data migration, drop old columns from main tables:

```sql
-- Drop scenario flag columns
ALTER TABLE scenarios 
    DROP COLUMN IF EXISTS active,
    DROP COLUMN IF EXISTS objectives_enabled,
    DROP COLUMN IF EXISTS images_enabled,
    DROP COLUMN IF EXISTS video_enabled,
    DROP COLUMN IF EXISTS questions_enabled,
    DROP COLUMN IF EXISTS problem_statement_enabled,
    DROP COLUMN IF EXISTS scenario_domain_id,
    DROP COLUMN IF EXISTS video_domain_id,
    DROP COLUMN IF EXISTS image_domain_id,
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS description;

-- Drop eval flag columns
ALTER TABLE evals 
    DROP COLUMN IF EXISTS active,
    DROP COLUMN IF EXISTS dynamic,
    DROP COLUMN IF EXISTS groups,
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS description;

-- Drop simulation flag/domain columns
ALTER TABLE simulations 
    DROP COLUMN IF EXISTS active,
    DROP COLUMN IF EXISTS practice,
    DROP COLUMN IF EXISTS simulation_text_domain_id,
    DROP COLUMN IF EXISTS simulation_voice_domain_id,
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS description;

-- Drop rubric point columns
ALTER TABLE rubrics 
    DROP COLUMN IF EXISTS active,
    DROP COLUMN IF EXISTS points,
    DROP COLUMN IF EXISTS pass_points,
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS description;

-- Drop document flag/content columns
ALTER TABLE documents 
    DROP COLUMN IF EXISTS active,
    DROP COLUMN IF EXISTS template,
    DROP COLUMN IF EXISTS classified,
    DROP COLUMN IF EXISTS content,
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS description;

-- Drop persona flag/color/icon columns
ALTER TABLE personas 
    DROP COLUMN IF EXISTS active,
    DROP COLUMN IF EXISTS color,
    DROP COLUMN IF EXISTS icon,
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS description,
    DROP COLUMN IF EXISTS instructions;

-- Drop setting flag/color columns
ALTER TABLE settings 
    DROP COLUMN IF EXISTS active,
    DROP COLUMN IF EXISTS guest_login_enabled,
    DROP COLUMN IF EXISTS primary_color,
    DROP COLUMN IF EXISTS accent,
    DROP COLUMN IF EXISTS background,
    DROP COLUMN IF EXISTS surface,
    DROP COLUMN IF EXISTS success,
    DROP COLUMN IF EXISTS warning,
    DROP COLUMN IF EXISTS error,
    DROP COLUMN IF EXISTS sidebar_background,
    DROP COLUMN IF EXISTS sidebar_primary,
    DROP COLUMN IF EXISTS chart1,
    DROP COLUMN IF EXISTS chart2,
    DROP COLUMN IF EXISTS chart3,
    DROP COLUMN IF EXISTS chart4,
    DROP COLUMN IF EXISTS chart5,
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS description,
    DROP COLUMN IF EXISTS success_threshold,
    DROP COLUMN IF EXISTS warning_threshold,
    DROP COLUMN IF EXISTS danger_threshold;

-- Similar for all other artifacts...
```

---

### Phase 9: Drop Old Junction Tables

After verifying data migration, drop old junction tables (if any exist):

```sql
-- Drop old flag junction tables (if they exist)
DROP TABLE IF EXISTS scenario_active_flags;
DROP TABLE IF EXISTS scenario_objectives_enabled_flags;
-- ... all other old flag tables

-- Drop old domain junction tables (if they exist)
DROP TABLE IF EXISTS simulation_text_domains;
DROP TABLE IF EXISTS simulation_voice_domains;
DROP TABLE IF EXISTS scenario_video_domains;
DROP TABLE IF EXISTS scenario_image_domains;
-- ... all other old domain tables

-- Drop old point junction tables (if they exist)
DROP TABLE IF EXISTS rubric_pass_points;
-- ... all other old point tables
```

---

## Part 4: Migration Checklist

### Pre-Migration
- [ ] Backup database
- [ ] Review all existing junction tables
- [ ] Document current data volumes
- [ ] Create rollback plan

### Phase 1: Pruning and Renaming
- [ ] Remove `scenario.generated` column
- [ ] Remove `document.classified` column
- [ ] Rename `title` to `name` in cohorts
- [ ] Rename `title` to `name` in simulations
- [ ] Rename `title` to `name` in departments
- [ ] Rename `use_groups` to `groups` in evals
- [ ] Rename `practice_simulation` to `practice` in simulations
- [ ] Verify all pruning/renaming complete

### Phase 2: Shared Resources
- [ ] Create `colors` table
- [ ] Create `flags` table
- [ ] Create `icons` table
- [ ] Create `document_content` junction table
- [ ] Create `names` table
- [ ] Create `descriptions` table
- [ ] Create `points` table
- [ ] Create `thresholds` table
- [ ] Verify tables created

### Phase 3: Type Enums
- [ ] Create all flag type enums
- [ ] Create all domain type enums
- [ ] Create all point type enums
- [ ] Create all color type enums
- [ ] Create threshold type enums
- [ ] Create profile name type enums
- [ ] Verify enums created

### Phase 4: Junction Tables
- [ ] Create all consolidated flag junction tables
- [ ] Create all consolidated domain junction tables
- [ ] Create all consolidated point junction tables
- [ ] Create all color junction tables
- [ ] Create all icon junction tables
- [ ] Create threshold junction tables
- [ ] Create profile names junction table
- [ ] Create foreign key junction tables (parameter_fields, agent_models, model_providers)
- [ ] Create all attribute junction tables
- [ ] Verify tables created

### Phase 5: Data Migration
- [ ] Migrate flags data
- [ ] Migrate domains data
- [ ] Migrate points data
- [ ] Migrate colors data
- [ ] Migrate icons data
- [ ] Migrate content data
- [ ] Migrate thresholds data
- [ ] Migrate profile names data (first, last, full)
- [ ] Migrate foreign keys to junction tables (parameter_fields, agent_models, model_providers)
- [ ] Migrate names/descriptions data
- [ ] Verify data integrity

### Phase 6: Artifacts/Resources
- [ ] Update artifacts enum
- [ ] Create/update resources table/enum
- [ ] Verify enums/tables updated

### Phase 7: Cleanup
- [ ] Drop old columns (flags, domains, points, colors, icons, content, names, descriptions, thresholds)
- [ ] Drop foreign key columns (parameter_id, model_id, provider_id)
- [ ] Drop profile name columns (first_name, last_name)
- [ ] Drop old junction tables
- [ ] Verify cleanup complete

### Post-Migration
- [ ] Update application code
- [ ] Update API endpoints
- [ ] Update SQL queries
- [ ] Run integration tests
- [ ] Verify performance
- [ ] Document new schema

---

## Part 5: Key Patterns

### Pattern 1: Consolidated Junction Tables
When multiple junction tables link the same artifact to the same resource type:
- Create single junction table: `{artifact}_{resource}`
- Add `type` enum column: `type_{artifact}_{resource}`
- Use CHECK constraints for validation

### Pattern 2: Shared Resources
When multiple artifacts use the same resource type:
- Create shared resource table (e.g., `colors`, `flags`, `icons`, `content`)
- Create artifact-specific junction tables
- Use type enums to distinguish usage

### Pattern 3: Artifacts as Resources
When an artifact table is referenced by another artifact:
- Artifact name = singular (e.g., `persona`)
- Resource name = plural (e.g., `personas`)
- Junction table: `scenario_personas` links `scenario` artifact to `personas` resource

---

## Part 6: Rollback Plan

If migration fails:

1. **Stop migration immediately**
2. **Restore from backup** if data corruption occurred
3. **Drop new tables/enums** created during migration
4. **Restore old columns** if they were dropped
5. **Restore old junction tables** if they were dropped
6. **Document issues** for future attempts

---

## Part 7: Testing Strategy

### Unit Tests
- Test each junction table creation
- Test each enum creation
- Test data migration scripts

### Integration Tests
- Test queries using new junction tables
- Test flag filtering by type
- Test domain filtering by type
- Test point filtering by type

### Performance Tests
- Compare query performance before/after
- Test junction table joins
- Test enum filtering performance

---

## Part 8: Estimated Impact

### Tables Created
- Shared resource tables: 7 (`colors`, `flags`, `icons`, `content` already exists, `names`, `descriptions`, `points`)
- Consolidated junction tables: ~20-30 (flags, domains, points)
- Attribute junction tables: ~50-100 (names, descriptions, etc.)
- **Total**: ~77-137 new tables

### Tables Dropped
- Old flag junction tables: ~30-40 (if they exist)
- Old domain junction tables: ~5-10 (if they exist)
- Old point junction tables: ~2-5 (if they exist)
- **Total**: ~40-55 tables dropped (if they exist)

### Net Change
- **Net new tables**: ~35-80 tables
- **Columns removed**: ~100-200 columns from main tables
- **Enums created**: ~20-30 type enums

---

## Part 9: Notes

- This migration should be executed in a maintenance window
- Consider migrating one artifact at a time for easier rollback
- Test thoroughly in staging before production
- Update application code incrementally as migration progresses
- Monitor performance after migration

---

## Part 10: Future Considerations

- Consider making `resources` a table instead of enum for better scalability
- Consider adding indexes on junction tables for performance
- Consider adding constraints for referential integrity
- Consider adding triggers for automatic timestamp updates
- Consider adding views for common query patterns
