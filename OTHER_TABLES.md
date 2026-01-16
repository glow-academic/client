# Other Tables (Non-Resource/Artifact Tables)

This document lists all tables in the database that are **not**:
- Resource tables (suffixed with `_resource`)
- Artifact tables (suffixed with `_artifact`)
- Standard junction tables matching the `{artifact}_{resource}` pattern
- Draft tables (prefixed with `draft_`)

**Total Count:** 92 tables

## Core Operational Tables

These are primary entity tables that don't follow the resource/artifact pattern:

- `activity` - Activity logging (6 columns)
- `chats` - Chat sessions (9 columns)
- `contents` - Content storage (8 columns)
- `grades` - Grade records (11 columns)
- `groups` - Group entities (7 columns)
- `messages` - Message records (10 columns)
- `outputs` - Output records (6 columns)
- `problems` - Problem tracking (10 columns)
- `runs` - Run records (10 columns)
- `standards` - Standards records (10 columns)
- `tests` - Test records (10 columns)
- `uploads` - File uploads (9 columns)

## Chat & Conversation Tables

Tables related to chat functionality:

- `chat_conversations` - Chat conversation links (7 columns)
- `chat_groups` - Chat group associations (7 columns)
- `chat_responses` - Chat response records (7 columns)

## Attempt & Testing Tables

Tables for tracking attempts and test runs:

- `attempt_chats` - Chat attempt records (4 columns)
- `attempt_profiles` - Profile attempt records (5 columns)
- `attempt_tests` - Test attempt records (4 columns)
- `test_runs` - Test run records (7 columns)
- `eval_attempts` - Evaluation attempt records (9 columns)
- `simulation_attempts` - Simulation attempt records (9 columns)

## Upload & Attachment Tables

Tables for file uploads and attachments:

- `audio_uploads` - Audio file uploads (5 columns)
- `document_uploads` - Document file uploads (7 columns)
- `image_uploads` - Image file uploads (7 columns)
- `video_uploads` - Video file uploads (7 columns)

## Message-Related Junction Tables

Junction tables linking messages to various entities:

- `message_audios` - Messages to audios (7 columns)
- `message_calls` - Messages to calls (4 columns)
- `message_contents` - Messages to contents (8 columns)
- `message_documents` - Messages to documents (7 columns)
- `message_feedback_highlight` - Messages to feedback highlights (8 columns)
- `message_feedback_replace` - Messages to feedback replacements (9 columns)
- `message_hints` - Messages to hints (8 columns)
- `message_images` - Messages to images (7 columns)
- `message_personas` - Messages to personas (7 columns)
- `message_runs` - Messages to runs (7 columns)
- `message_texts` - Messages to texts (7 columns)
- `message_tree` - Message tree structure (7 columns)
- `message_videos` - Messages to videos (7 columns)

## Run-Related Junction Tables

Junction tables linking runs to various entities:

- `run_debug_info` - Runs to debug info (7 columns)
- `run_models` - Runs to models (7 columns)
- `run_personas` - Runs to personas (7 columns)
- `run_pricing_usage` - Runs to pricing usage (9 columns)
- `run_profiles` - Runs to profiles (7 columns)

## Group-Related Tables

Tables related to group operations:

- `group_order` - Group ordering (8 columns)
- `group_runs` - Groups to runs (8 columns)
- `group_stop` - Group stop records (8 columns)

## Grade-Related Junction Tables

Junction tables linking grades to various entities:

- `grade_analyses` - Grades to analyses (7 columns)
- `grade_feedbacks` - Grades to feedbacks (7 columns)
- `grade_groups` - Grades to groups (7 columns)
- `grade_improvements` - Grades to improvements (7 columns)
- `grade_strengths` - Grades to strengths (7 columns)
- `grade_times` - Grades to times (7 columns)

## Scenario-Related Special Tables

Special tables for scenario-specific functionality:

- `scenario_content` - Scenario content links (7 columns)
- `scenario_time_limits` - Scenario time limits (8 columns)
- `scenario_tree` - Scenario tree structure (7 columns)
- `scenario_video_images` - Scenario video images (9 columns)

## Document-Related Special Tables

Special tables for document functionality:

- `document_tree` - Document tree structure (7 columns)

## Key-Related Junction Tables

Junction tables for key entities (note: `key` is not in the artifacts enum):

- `key_descriptions` - Keys to descriptions (7 columns)
- `key_flags` - Keys to flags (9 columns)
- `key_names` - Keys to names (7 columns)

## Department Junction Tables (Non-Standard)

Junction tables linking non-artifact entities to departments:

- `image_departments` - Images to departments (7 columns)
- `objective_departments` - Objectives to departments (7 columns)
- `problem_statement_departments` - Problem statements to departments (7 columns)
- `prompt_departments` - Prompts to departments (7 columns)
- `question_departments` - Questions to departments (7 columns)
- `video_departments` - Videos to departments (7 columns)

## Profile-Related Tables

Tables related to profile operations:

- `profile_activity` - Profile activity tracking (8 columns)
- `profile_logins` - Profile login records (7 columns)
- `profile_roles` - Profile role assignments (7 columns)

## Resource Junction Tables (Non-Standard)

Junction tables that don't follow the standard `{artifact}_{resource}` pattern:

- `resource_modalities` - Resources to modalities (7 columns)
- `resource_outputs` - Resources to outputs (4 columns)
- `resource_tools` - Resources to tools (7 columns)

## Rubric-Related Special Tables

Special tables for rubric functionality:

- `rubric_artifacts` - Rubrics to artifacts (7 columns)
- `rubric_grade_agents` - Rubrics to grade agents (9 columns)
- `rubric_grade_agents_audio` - Rubrics to grade agent audios (7 columns)

## Setting-Related Special Tables

Special tables for settings functionality:

- `setting_auth_keys` - Settings to auth keys (9 columns)
- `setting_auth_values` - Settings to auth values (9 columns)
- `setting_provider_keys` - Settings to provider keys (8 columns)
- `settings_default_account` - Default account settings (7 columns)
- `settings_default_department` - Default department settings (7 columns)
- `settings_default_guest` - Default guest settings (7 columns)

## Simulation-Related Special Tables

Special tables for simulation functionality:

- `simulation_eval_rubric_grade_agents` - Simulation eval rubric grade agents (7 columns)
- `simulation_scenarios_scenario_rubric_grade_agents` - Complex simulation scenario links (8 columns)

## Other Special Tables

Miscellaneous tables:

- `agent_department_prompts` - Agent department prompts (8 columns)
- `app_metrics` - Application metrics (6 columns)
- `artifact_resources` - Artifact-resource mapping (4 columns)
- `args_outputs_values` - Args outputs values (8 columns)
- `args_values` - Args values (8 columns)
- `calls` - Call records (8 columns)
- `instruction_schemas` - Instruction schemas (7 columns)
- `service_health` - Service health monitoring (9 columns)
- `tool_args` - Tool arguments junction table (6 columns)
- `tool_args_outputs` - Tool args outputs junction table (6 columns)
- `units` - Units table (9 columns)

**Note:** This section contains 11 tables.

## Notes

1. **Junction Tables**: Many of these tables are junction tables that don't follow the standard `{artifact}_{resource}` pattern. This could indicate:
   - Legacy tables that haven't been migrated
   - Special-purpose relationships that don't fit the standard pattern
   - Tables linking non-artifact entities (e.g., `key_*` tables where `key` is not in the artifacts enum)

2. **Upload Tables**: Multiple upload tables exist for different file types (audio, document, image, video).

3. **Message System**: Extensive message-related junction tables suggest a complex messaging system with many entity relationships.

4. **Profile & Activity**: Several tables track profile activity and login information.

5. **Settings**: Multiple settings-related tables handle default configurations for different user types.

6. **Testing & Attempts**: Several tables track test runs and attempts across different contexts (chats, profiles, tests, evals, simulations).

## Query Used to Generate This List

The following SQL query was used to identify these tables:

```sql
WITH all_tables AS (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
),
artifacts AS (
    SELECT unnest(enum_range(NULL::artifacts))::text as artifact
),
resources AS (
    SELECT unnest(enum_range(NULL::resources))::text as resource
),
junction_patterns AS (
    SELECT DISTINCT a.artifact || '_' || r.resource as pattern
    FROM artifacts a
    CROSS JOIN resources r
)
SELECT table_name
FROM all_tables
WHERE 
    -- Exclude resource tables
    table_name NOT LIKE '%_resource'
    -- Exclude artifact tables
    AND table_name NOT LIKE '%_artifact'
    -- Exclude draft tables
    AND table_name NOT LIKE 'draft_%'
    -- Exclude junction tables matching {artifact}_{resource} pattern
    AND NOT EXISTS (
        SELECT 1 
        FROM junction_patterns jp 
        WHERE table_name = jp.pattern
    )
ORDER BY table_name;
```

## Artifacts Enum

The following artifacts are recognized in the system:
- agent, auth, cohort, department, document, eval, field, model, parameter, persona, profile, provider, rubric, scenario, setting, simulation, tool

## Resources Enum

The system recognizes 80 different resource types. See the database schema for the complete list.
