# Database Architecture

## Table Naming Convention

**All tables must end with one of these six suffixes:**

| Suffix | Purpose | Example |
|--------|---------|---------|
| `_artifact` | Root entities (composite key, type-based) | `agent_artifact`, `scenario_artifact` |
| `_resource` | Reusable data (UUID id, scalar data) | `names_resource`, `models_resource` |
| `_entry` | Transactional/event logs (UUID id) | `calls_entry`, `runs_entry`, `drafts_entry` |
| `_relation` | Metadata relations (enum types, no UUIDs) | `artifact_resources_relation` |
| `_connection` | Connect resources to entries, or resource-to-resource | `names_calls_connection` |
| `_junction` | Connect artifacts to resources OR artifacts to entries | `agent_names_junction` |

## Architecture Diagram

```
                              ┌─────────────────────────────────┐
                              │           ARTIFACTS             │
                              │         (Root Entities)         │
                              │                                 │
                              │  agent_artifact, persona_artifact,
                              │  scenario_artifact, simulation_artifact,
                              │  model_artifact, profile_artifact...
                              │         (17 total types)        │
                              └─────────────────────────────────┘
                                             │
                                             │ Artifacts NEVER connect
                                             │ to other artifacts directly
                                             │
                     ┌───────────────────────┼───────────────────────┐
                     │                       │                       │
                     ▼                       ▼                       ▼
        ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
        │  JUNCTION TABLES   │  │  JUNCTION TABLES   │  │  JUNCTION TABLES   │
        │  (to Resources)    │  │  (to Entries)      │  │  (to "Artifact     │
        │                    │  │                    │  │   Resources")      │
        │ agent_names_junction│  │ eval_attempts_    │  │                    │
        │ agent_models_junction│  │   junction       │  │ agent_agents_junction
        │ scenario_personas_  │  │                    │  │ (agent_id →        │
        │   junction         │  │                    │  │  agents_resource)  │
        └─────────┬──────────┘  └─────────┬──────────┘  └─────────┬──────────┘
                  │                       │                       │
                  ▼                       ▼                       ▼
        ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
        │     RESOURCES      │  │      ENTRIES       │  │     RESOURCES      │
        │  (Reusable Data)   │  │   (Event Logs)     │  │  (Artifact as      │
        │                    │  │                    │  │   Resource)        │
        │  names_resource    │  │  drafts_entry      │  │                    │
        │  descriptions_     │  │  runs_entry        │  │  agents_resource   │
        │    resource        │  │  calls_entry       │  │  personas_resource │
        │  models_resource   │  │  messages_entry    │  │  scenarios_resource│
        │  flags_resource    │  │  (35 types)        │  │  simulations_      │
        │  (73 types)        │  │                    │  │    resource        │
        └─────────┬──────────┘  └─────────┬──────────┘  └────────────────────┘
                  │                       │
                  │                       │
    ┌─────────────┴───────────────────────┴─────────────────────────────────────┐
    │                                                                           │
    │              RESOURCES ←→ ENTRIES via CONNECTION TABLES                   │
    │                                                                           │
    │   Resources NEVER have direct FKs to entries.                             │
    │   All resource-entry relationships use _connection tables.                │
    │                                                                           │
    │   ┌─────────────────────────────────────────────────────────────────┐     │
    │   │  {resource}_calls_connection (72 tables)                        │     │
    │   │  e.g., names_calls_connection, models_calls_connection          │     │
    │   │  Columns: {resource}_id, call_id, active, created_at, updated_at│     │
    │   └─────────────────────────────────────────────────────────────────┘     │
    │                                                                           │
    │   ┌─────────────────────────────────────────────────────────────────┐     │
    │   │  {resource}_uploads_connection (3 tables)                       │     │
    │   │  uploads_uploads_connection, videos_uploads_connection,         │     │
    │   │  images_uploads_connection                                      │     │
    │   └─────────────────────────────────────────────────────────────────┘     │
    │                                                                           │
    │   ┌─────────────────────────────────────────────────────────────────┐     │
    │   │  groups_groups_connection                                       │     │
    │   │  Columns: groups_id → groups_resource, group_id → groups_entry  │     │
    │   └─────────────────────────────────────────────────────────────────┘     │
    │                                                                           │
    │   ┌─────────────────────────────────────────────────────────────────┐     │
    │   │  runs_runs_connection                                           │     │
    │   │  Columns: runs_id → runs_resource, run_id → runs_entry          │     │
    │   └─────────────────────────────────────────────────────────────────┘     │
    │                                                                           │
    └───────────────────────────────────────────────────────────────────────────┘


    ┌───────────────────────────────────────────────────────────────────────────┐
    │                                                                           │
    │                    DRAFTS CONNECTION TABLES (65 tables)                   │
    │                                                                           │
    │   Every resource has a corresponding _drafts_connection table             │
    │   These link resources to drafts_entry for versioning                     │
    │                                                                           │
    │   Pattern: {resource}_drafts_connection                                   │
    │                                                                           │
    │   ┌───────────────────────┐    ┌───────────────────────┐                  │
    │   │ names_drafts_connection│    │ models_drafts_connection│                │
    │   │ draft_id ─────────────┼─┐  │ draft_id ─────────────┼─┐                │
    │   │ names_id ─────────────┼┐│  │ models_id ────────────┼┐│                │
    │   │ version               │││  │ version               │││                │
    │   │ active                │││  │ active                │││                │
    │   └───────────────────────┘││  └───────────────────────┘││                │
    │                            ││                           ││                │
    │                            │└─────────────┬─────────────┘│                │
    │                            │              ▼              │                │
    │                            │   ┌─────────────────────┐   │                │
    │                            │   │    drafts_entry     │   │                │
    │                            │   │  (version tracking) │   │                │
    │                            │   │  artifact_type col  │   │                │
    │                            │   └─────────────────────┘   │                │
    │                            │                             │                │
    │                            ▼                             ▼                │
    │               ┌─────────────────┐         ┌─────────────────┐             │
    │               │ names_resource  │         │ models_resource │             │
    │               └─────────────────┘         └─────────────────┘             │
    │                                                                           │
    └───────────────────────────────────────────────────────────────────────────┘


    ┌───────────────────────────────────────────────────────────────────────────┐
    │                                                                           │
    │                    ENTRY ←→ RESOURCE CONNECTION TABLES                    │
    │                                                                           │
    │   When entries need to reference resources, use _connection tables        │
    │   Pattern: {entry}_{resource}_connection                                  │
    │                                                                           │
    │   ┌─────────────────────────────────────────────────────────────────┐     │
    │   │  feedbacks_standards_connection                                 │     │
    │   │  Columns: feedbacks_id → feedbacks_entry,                       │     │
    │   │           standard_id → standards_resource                      │     │
    │   └─────────────────────────────────────────────────────────────────┘     │
    │                                                                           │
    │   ┌─────────────────────────────────────────────────────────────────┐     │
    │   │  responses_options_connection, responses_questions_connection   │     │
    │   │  runs_keys_connection, args_values_args_connection              │     │
    │   └─────────────────────────────────────────────────────────────────┘     │
    │                                                                           │
    └───────────────────────────────────────────────────────────────────────────┘


    ENTRY ←→ ENTRY CONNECTIONS (via direct FKs - allowed):

        runs_entry ◄─── calls_entry.call_id (entry-to-entry FKs are OK)
             │
             └─── analyses_entry.call_id ───► calls_entry

        runs_entry ◄─── messages_entry.run_id


    RESOURCE ←→ RESOURCE CONNECTIONS (via direct FKs or _connection tables):

        ┌─────────────────────────────────────────────────────────────────┐
        │  group_positions_resource.groups_id → groups_resource.id        │
        │  group_rubrics_resource.groups_id → groups_resource.id          │
        │  run_positions_resource.runs_id → runs_resource.id              │
        │  run_rubrics_resource.runs_id → runs_resource.id                │
        └─────────────────────────────────────────────────────────────────┘


    _relation TABLES (define valid type combinations):

        ┌──────────────────────────────┐
        │  artifact_resources_relation │──► Which resources can belong to which artifacts
        │  (artifact_type, resource_type)   (e.g., agent → names, descriptions, models)
        └──────────────────────────────┘

        ┌──────────────────────────────┐
        │  artifact_entries_relation   │──► Which entries can belong to which artifacts
        │  (artifact_type, entry_type) │    (e.g., all artifacts → drafts)
        └──────────────────────────────┘

        ┌──────────────────────────────┐
        │  artifact_flags_relation     │──► Which flags apply to which artifacts
        │  (artifact_type, flag_type)  │    (e.g., scenario → active, video_enabled)
        └──────────────────────────────┘

        ┌──────────────────────────────┐
        │  entry_tools_relation        │──► Which entries connect to tools
        │  resource_tools_relation     │──► Which resources connect to tools
        │  entry_modalities_relation   │──► Which entries have modalities
        │  resource_modalities_relation│──► Which resources have modalities
        └──────────────────────────────┘
```

## Key Rules

### 1. Artifacts NEVER Connect to Artifacts
An `agent_artifact` cannot directly reference another `agent_artifact`. Instead, it connects to `agents_resource` (the resource version).

Example: `agent_agents_junction`
- `agent_id` → `agent_artifact.id`
- `agents_id` → `agents_resource.id` (NOT agent_artifact)

### 2. Artifacts Connect to Resources via Junction Tables
Pattern: `{artifact}_{resource}_junction`
- `agent_names_junction` → agent_artifact to names_resource
- `scenario_personas_junction` → scenario_artifact to personas_resource

### 3. Artifacts Connect to Entries via Junction Tables
Pattern: `{artifact}_{entry}_junction`
- `eval_attempts_junction` → eval_artifact to eval_attempts_entry

### 4. Entries Connect to Entries via Direct FKs (Allowed)
Entry-to-entry FKs are permitted:
- `calls_entry.run_id` → `runs_entry.id`
- `messages_entry.run_id` → `runs_entry.id`
- `analyses_entry.call_id` → `calls_entry.id`

### 5. Resources NEVER Have Direct FKs to Entries
All resource-to-entry relationships must use `_connection` tables:

| Connection Table Pattern | Purpose |
|--------------------------|---------|
| `{resource}_calls_connection` | Link resource to calls_entry (72 tables) |
| `{resource}_uploads_connection` | Link resource to uploads_entry |
| `groups_groups_connection` | Link groups_resource to groups_entry |
| `runs_runs_connection` | Link runs_resource to runs_entry |

### 6. Entries NEVER Have Direct FKs to Resources
All entry-to-resource relationships must use `_connection` tables:

| Connection Table | Purpose |
|------------------|---------|
| `feedbacks_standards_connection` | feedbacks_entry to standards_resource |
| `responses_options_connection` | responses_entry to options_resource |
| `responses_questions_connection` | responses_entry to questions_resource |
| `runs_keys_connection` | runs_entry to keys_resource |
| `args_values_args_connection` | args_values_entry to args_resource |

### 7. Drafts Connection Tables (Resource Versioning)
Every resource has a corresponding `_drafts_connection` table (65 total). These connect resources to `drafts_entry` for version tracking.

Pattern: `{resource}_drafts_connection`
- `names_drafts_connection` links `names_resource` to `drafts_entry`
- `models_drafts_connection` links `models_resource` to `drafts_entry`

Structure:
- `draft_id` → FK to `drafts_entry.id`
- `{resource}_id` → FK to `{resource}_resource.id`
- `version` → integer for version tracking
- `active` → boolean (required on all connection/junction tables)

### 8. Connection Tables vs Junction Tables

| Type | Connects | Example |
|------|----------|---------|
| `_junction` | artifact ↔ resource | `agent_names_junction` |
| `_junction` | artifact ↔ entry | `eval_attempts_junction` |
| `_connection` | resource ↔ entry | `names_calls_connection` |
| `_connection` | resource ↔ resource | `groups_groups_connection` |
| `_connection` | entry ↔ resource | `feedbacks_standards_connection` |

**Key difference:** Junction tables MUST have at least one FK to an `_artifact` table. Connection tables NEVER reference artifacts.

### 9. Resource-to-Resource Direct FKs (Allowed)
Some resources can directly FK to other resources:
- `group_positions_resource.groups_id` → `groups_resource.id`
- `group_rubrics_resource.groups_id` → `groups_resource.id`
- `run_positions_resource.runs_id` → `runs_resource.id`
- `run_rubrics_resource.runs_id` → `runs_resource.id`

### 10. _relation Tables Use Type Columns (Not UUIDs)
These define which combinations are valid:
- `artifact_resources_relation` uses `artifact_type` enum + `resource_type` enum
- Allows dynamic/polymorphic relationships without hardcoded FKs

### 11. Required Columns on Junction/Connection Tables
All `_junction` and `_connection` tables must have:
- `active` → BOOLEAN NOT NULL DEFAULT TRUE
- `created_at` → TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` → TIMESTAMPTZ NOT NULL DEFAULT now()

## Table Counts (After Migration 329)

| Suffix | Count |
|--------|-------|
| `_junction` | 192 |
| `_connection` | 148 |
| `_resource` | 73 |
| `_entry` | 35 |
| `_artifact` | 17 |
| `_relation` | 15 |
| **Total** | **480** |

## Column Naming Convention

For `_drafts_connection` and other connection tables, column names should use the **plural** form to match the resource table name:

| Table | Column | References |
|-------|--------|------------|
| `names_drafts_connection` | `names_id` | `names_resource.id` |
| `scenario_positions_drafts_connection` | `scenario_positions_id` | `scenario_positions_resource.id` |
| `simulation_positions_drafts_connection` | `simulation_positions_id` | `simulation_positions_resource.id` |

## Validation Rules (Enforced by Migration 329)

1. All tables must have a valid suffix (`_artifact`, `_resource`, `_entry`, `_relation`, `_connection`, `_junction`)
2. No `_resource` tables can have direct FKs to `_entry` tables
3. No `_entry` tables can have direct FKs to `_resource` tables
4. All `_junction` tables must reference at least one `_artifact` table
5. No `_connection` tables can reference `_artifact` tables
6. All `_junction` and `_connection` tables must have an `active` column
