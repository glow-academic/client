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

**Junction Tables** (Consolidated Pattern):
Each artifact has its own consolidated junction table with a `type` enum column:

- `scenario_flags` - junction table for scenario flags
  - `scenario_id` (UUID, foreign key to `scenarios`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_scenario_flags` enum) - type of flag: 'active', 'objectives_enabled', 'images_enabled', 'video_enabled', 'questions_enabled', 'problem_statement_enabled'
  - `value` (boolean) - the actual flag value
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

- `eval_flags` - junction table for eval flags
  - `eval_id` (UUID, foreign key to `evals`)
  - `flag_id` (UUID, foreign key to `flags`)
  - `type` (`type_eval_flags` enum) - type of flag: 'active', 'dynamic', 'groups'
  - `value` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

- Similar pattern for all other artifacts (see "Flags Resource Usage" section below)

**Type Enums** (centralized naming schema - `type_{artifact}_{resource}` pattern):
- `type_scenario_flags` - enum for scenario flag types: 'active', 'objectives_enabled', 'images_enabled', 'video_enabled', 'questions_enabled', 'problem_statement_enabled'
- `type_eval_flags` - enum for eval flag types: 'active', 'dynamic', 'groups'
- `type_document_flags` - enum for document flag types: 'active', 'template'
- `type_parameter_flags` - enum for parameter flag types: 'active', 'document_parameter', 'persona_parameter', 'scenario_parameter', 'video_parameter', 'simulation_parameter'
- `type_simulation_flags` - enum for simulation flag types: 'active', 'practice'
- `type_simulation_domains` - enum for simulation domain types: 'text', 'voice'
- `type_scenario_domains` - enum for scenario domain types: 'default', 'video', 'image'
- `type_rubric_points` - enum for rubric point types: 'total', 'pass'
- And so on for each artifact/resource combination that needs type distinction

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

