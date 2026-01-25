# Database Architecture

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
        │ agent_names_junction│  │ agents_draft      │  │                    │
        │ agent_models_junction│  │ (draft_id →      │  │ agent_agents_junction
        │ scenario_personas_  │  │  drafts_entry)   │  │ (agent_id →        │
        │   junction         │  │                    │  │  agents_resource)  │
        └─────────┬──────────┘  └─────────┬──────────┘  └─────────┬──────────┘
                  │                       │                       │
                  ▼                       ▼                       ▼
        ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
        │     RESOURCES      │  │      ENTRIES       │  │     RESOURCES      │
        │  (Reusable Data)   │  │   (Event Logs)     │  │  (Artifact as      │
        │                    │  │                    │  │   Resource)        │
        │  names_resource    │  │  drafts_entry      │  │                    │
        │  descriptions_resource│  runs_entry       │  │  agents_resource   │
        │  models_resource   │  │  calls_entry       │  │  personas_resource │
        │  flags_resource    │  │  messages_entry    │  │  scenarios_resource│
        │  (74+ types)       │  │  (33 types)        │  │  simulations_resource
        └────────────────────┘  └─────────┬──────────┘  └────────────────────┘
                                          │
                                          │
    ┌─────────────────────────────────────┴─────────────────────────────────────┐
    │                                                                           │
    │                     RESOURCE ←→ ENTRY CONNECTIONS                         │
    │                                                                           │
    │   Every resource connects to entries via these FKs:                       │
    │                                                                           │
    │   ┌─────────────────────────────────────────────────────────────────┐     │
    │   │  call_id → calls_entry     (ALL resources have this)            │     │
    │   └─────────────────────────────────────────────────────────────────┘     │
    │                                                                           │
    │   ┌─────────────────────────────────────────────────────────────────┐     │
    │   │  upload_id → uploads_entry (audios, images, uploads, videos)    │     │
    │   └─────────────────────────────────────────────────────────────────┘     │
    │                                                                           │
    │   ┌─────────────────────────────────────────────────────────────────┐     │
    │   │  group_id → groups_entry   (group_positions, group_rubrics,     │     │
    │   │                             groups, uploads)                    │     │
    │   └─────────────────────────────────────────────────────────────────┘     │
    │                                                                           │
    │   ┌─────────────────────────────────────────────────────────────────┐     │
    │   │  run_id → runs_entry       (run_positions, runs_resource)       │     │
    │   └─────────────────────────────────────────────────────────────────┘     │
    │                                                                           │
    └───────────────────────────────────────────────────────────────────────────┘


    ┌───────────────────────────────────────────────────────────────────────────┐
    │                                                                           │
    │                           DRAFT TABLES                                    │
    │                                                                           │
    │   Every resource has a corresponding _draft table (65 total)              │
    │   These link resources to drafts_entry for versioning                     │
    │                                                                           │
    │   Pattern: {resource}_draft                                               │
    │                                                                           │
    │   ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐   │
    │   │  names_draft    │      │  models_draft   │      │  personas_draft │   │
    │   │  draft_id ──────┼──┐   │  draft_id ──────┼──┐   │  draft_id ──────┼─┐ │
    │   │  names_id ──────┼┐ │   │  models_id ─────┼┐ │   │  personas_id ───┼┐│ │
    │   │  version        ││ │   │  version        ││ │   │  version        │││ │
    │   └─────────────────┘│ │   └─────────────────┘│ │   └─────────────────┘││ │
    │                      │ │                      │ │                      ││ │
    │                      │ │                      │ │                      ││ │
    │                      ▼ │                      ▼ │                      ▼│ │
    │   ┌─────────────────┐ │   ┌─────────────────┐ │   ┌─────────────────┐ │ │
    │   │ names_resource  │ │   │ models_resource │ │   │personas_resource│ │ │
    │   └─────────────────┘ │   └─────────────────┘ │   └─────────────────┘ │ │
    │                       │                       │                       │ │
    │                       └───────────┬───────────┴───────────────────────┘ │
    │                                   ▼                                     │
    │                        ┌─────────────────────┐                          │
    │                        │    drafts_entry     │                          │
    │                        │  (version tracking) │                          │
    │                        │  artifact_type col  │                          │
    │                        └─────────────────────┘                          │
    │                                                                           │
    └───────────────────────────────────────────────────────────────────────────┘


    ENTRY ←→ ENTRY CONNECTIONS (via direct FKs):

        runs_entry ◄─── calls_entry.run_id
             │
             └─── group_id ───► groups_entry

        runs_entry ◄─── messages_entry.run_id


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

### 1. Artifacts NEVER connect to Artifacts
An `agent_artifact` cannot directly reference another `agent_artifact`. Instead, it connects to `agents_resource` (the resource version).

Example: `agent_agents_junction`
- `agent_id` → `agent_artifact.id`
- `agents_id` → `agents_resource.id` (NOT agent_artifact)

### 2. Artifacts Connect to Resources via Junction Tables
Pattern: `{artifact}_{resource}_junction`
- `agent_names_junction` → agent_artifact to names_resource
- `scenario_personas_junction` → scenario_artifact to personas_resource

### 3. Artifacts Connect to Entries via Junction Tables
Pattern: `{resource}_draft` or similar
- `agents_draft` → drafts_entry to agent_artifact

### 4. Entries Connect to Entries via Direct FKs
- `calls_entry.run_id` → `runs_entry.id`
- `messages_entry.run_id` → `runs_entry.id`

### 5. Resources Connect to Entries via FKs
All resources have entry FKs - this is the only way resources connect to entries:

| FK Column | Entry Table | Which Resources |
|-----------|-------------|-----------------|
| `call_id` | `calls_entry` | ALL resources (74+) |
| `upload_id` | `uploads_entry` | audios, images, uploads, videos |
| `group_id` | `groups_entry` | group_positions, group_rubrics, groups, uploads |
| `run_id` | `runs_entry` | run_positions, runs_resource |

### 6. Draft Tables (Resource Versioning)
Every resource has a corresponding `_draft` table (65 total). These connect resources to `drafts_entry` for version tracking.

Pattern: `{resource}_draft`
- `names_draft` links `names_resource` to `drafts_entry`
- `models_draft` links `models_resource` to `drafts_entry`

Structure of a draft table:
- `draft_id` → FK to `drafts_entry.id`
- `{resource}_id` → FK to `{resource}_resource.id`
- `version` → integer for version tracking

The `drafts_entry` table has an `artifact_type` column to know which artifact the draft belongs to.

### 7. _relation Tables Use Type Columns (Not UUIDs)
These define which combinations are valid:
- `artifact_resources_relation` uses `artifact_type` enum + `resource_type` enum
- Allows dynamic/polymorphic relationships without hardcoded FKs

## Table Counts
- **Artifacts**: 17 types
- **Entries**: 33 types
- **Resources**: 74+ types
- **Junction Tables**: ~150+
- **Draft Tables**: 65 (one per resource, linking to drafts_entry)
- **Relation Tables**: 14
