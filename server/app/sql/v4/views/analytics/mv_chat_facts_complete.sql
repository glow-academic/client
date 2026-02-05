-- Materialized View: mv_chat_facts
-- Base fact table for all analytics queries across Home, Practice, Dashboard, and Reports.
--
-- Grain: One row per chat
-- Filter: None at MV level - all data included (filtering done at query time)
--
-- Purpose: Base fact table that all other analytics MVs derive from
-- Section: ANALYTICS (unified base layer)
--
-- Dependencies: Only uses _entry and _connection tables (no _resource joins)
-- ============================================================================
-- Step 1: Drop all indexes on mv_chat_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_chat_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_chat_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_chat_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_chat_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_chat_facts AS
WITH
-- Latest grade per chat (most recent active grade)
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
        g.chat_id,
        g.score,
        g.passed,
        g.time_taken,
        g.total_points AS rubric_total_points,
        g.pass_points AS rubric_pass_points,
        g.created_at AS grade_created_at
    FROM simulation_grades_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
-- Message stats per chat (count and time taken array)
message_stats AS (
    SELECT
        sm.chat_id,
        COUNT(*)::int AS num_messages_total,
        ARRAY_AGG(
            EXTRACT(EPOCH FROM (sm.updated_at - sm.created_at))::int
            ORDER BY sm.created_at
        ) FILTER (WHERE m.role = 'assistant'::message_type) AS message_time_taken_seconds
    FROM simulation_messages_entry sm
    JOIN messages_entry m ON m.id = sm.id
    WHERE m.active = TRUE
      AND m.role IN ('user'::message_type, 'assistant'::message_type)
    GROUP BY sm.chat_id
),
-- Get rubric_id from grade connection
grade_rubric AS (
    SELECT DISTINCT ON (grc.grade_id)
        grc.grade_id,
        grc.rubrics_id AS rubric_id
    FROM simulation_grades_rubrics_connection grc
    WHERE grc.active = TRUE
    ORDER BY grc.grade_id, grc.created_at DESC
),
-- Get persona_id per chat (first active persona)
chat_persona AS (
    SELECT DISTINCT ON (cpc.chat_id)
        cpc.chat_id,
        cpc.personas_id AS persona_id
    FROM simulation_chats_personas_connection cpc
    WHERE cpc.active = TRUE
    ORDER BY cpc.chat_id, cpc.created_at
),
-- Parameter/field resource IDs per chat (for direct resource lookup in API layer)
chat_parameter_fields AS (
    SELECT
        cpfc.chat_id,
        ARRAY_AGG(DISTINCT cpfc.parameter_fields_id ORDER BY cpfc.parameter_fields_id)
            FILTER (WHERE cpfc.parameter_fields_id IS NOT NULL) AS parameter_field_ids,
        ARRAY_AGG(DISTINCT pfr.parameter_id ORDER BY pfr.parameter_id)
            FILTER (WHERE pfr.parameter_id IS NOT NULL) AS parameter_ids,
        ARRAY_AGG(DISTINCT pfr.field_id ORDER BY pfr.field_id)
            FILTER (WHERE pfr.field_id IS NOT NULL) AS field_ids
    FROM simulation_chats_parameter_fields_connection cpfc
    LEFT JOIN parameter_fields_resource pfr
        ON pfr.id = cpfc.parameter_fields_id
       AND pfr.active = TRUE
    WHERE cpfc.active = TRUE
    GROUP BY cpfc.chat_id
)
SELECT
    -- Primary key
    c.id AS chat_id,

    -- Entry IDs
    c.attempt_id,
    lg.grade_id,

    -- Resource IDs (from connections for _resource joins at runtime)
    asc_conn.simulations_id AS simulation_id,
    apc.profiles_id AS profile_id,
    acc.cohorts_id AS cohort_id,
    adc.departments_id AS department_id,
    arc.roles_id AS role_id,
    csc.scenarios_id AS scenario_id,
    cp.persona_id,
    gr.rubric_id,
    COALESCE(cpf.parameter_field_ids, ARRAY[]::uuid[]) AS parameter_field_ids,
    COALESCE(cpf.parameter_ids, ARRAY[]::uuid[]) AS parameter_ids,
    COALESCE(cpf.field_ids, ARRAY[]::uuid[]) AS field_ids,

    -- Timestamps
    a.created_at AS attempt_created_at,
    c.created_at AS chat_created_at,
    lg.grade_created_at,

    -- Flags (columns, not filters)
    CASE WHEN COALESCE(a.practice, FALSE) THEN 'practice' ELSE 'general' END AS attempt_type,
    COALESCE(a.archived, FALSE) AS is_archived,
    COALESCE(a.infinite_mode, FALSE) AS infinite_mode,
    (EXISTS (SELECT 1 FROM simulation_completions_entry comp WHERE comp.chat_id = c.id AND comp.active = TRUE)) AS completed,

    -- Grade data
    lg.score,
    lg.passed,
    lg.time_taken,
    CASE
        WHEN lg.rubric_total_points IS NOT NULL AND lg.rubric_total_points > 0
        THEN ROUND((lg.score::numeric / lg.rubric_total_points::numeric) * 100, 2)
        ELSE NULL
    END AS grade_percent,
    lg.rubric_total_points,
    lg.rubric_pass_points,

    -- Message stats
    COALESCE(ms.num_messages_total, 0) AS num_messages_total,
    COALESCE(ms.message_time_taken_seconds, ARRAY[]::int[]) AS message_time_taken_seconds

FROM simulation_chats_entry c
-- Join to attempt
JOIN simulation_attempts_entry a ON a.id = c.attempt_id
-- Attempt connections (required)
JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
-- Attempt connections (optional)
LEFT JOIN simulation_attempts_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN simulation_attempts_cohorts_connection acc ON acc.attempt_id = a.id
LEFT JOIN simulation_attempts_roles_connection arc ON arc.attempt_id = a.id
-- Chat connections (required)
JOIN simulation_chats_scenarios_connection csc ON csc.chat_id = c.id
-- Chat connections (optional)
LEFT JOIN chat_persona cp ON cp.chat_id = c.id
LEFT JOIN chat_parameter_fields cpf ON cpf.chat_id = c.id
-- Grade data (optional)
LEFT JOIN latest_grade lg ON lg.chat_id = c.id
LEFT JOIN grade_rubric gr ON gr.grade_id = lg.grade_id
-- Message stats (optional)
LEFT JOIN message_stats ms ON ms.chat_id = c.id
WHERE c.active = TRUE
  AND a.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_chat_facts_pk
    ON mv_chat_facts (chat_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Entry ID indexes
CREATE INDEX mv_chat_facts_attempt_id_idx
    ON mv_chat_facts (attempt_id);

-- Resource ID indexes
CREATE INDEX mv_chat_facts_simulation_id_idx
    ON mv_chat_facts (simulation_id);

CREATE INDEX mv_chat_facts_profile_id_idx
    ON mv_chat_facts (profile_id);

CREATE INDEX mv_chat_facts_cohort_id_idx
    ON mv_chat_facts (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_chat_facts_department_id_idx
    ON mv_chat_facts (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_chat_facts_scenario_id_idx
    ON mv_chat_facts (scenario_id);

CREATE INDEX mv_chat_facts_persona_id_idx
    ON mv_chat_facts (persona_id)
    WHERE persona_id IS NOT NULL;

CREATE INDEX mv_chat_facts_rubric_id_idx
    ON mv_chat_facts (rubric_id)
    WHERE rubric_id IS NOT NULL;

-- Array indexes for parameter/field lookups
CREATE INDEX mv_chat_facts_parameter_field_ids_gin_idx
    ON mv_chat_facts USING GIN (parameter_field_ids);

CREATE INDEX mv_chat_facts_parameter_ids_gin_idx
    ON mv_chat_facts USING GIN (parameter_ids);

CREATE INDEX mv_chat_facts_field_ids_gin_idx
    ON mv_chat_facts USING GIN (field_ids);

-- Time indexes
CREATE INDEX mv_chat_facts_attempt_created_at_idx
    ON mv_chat_facts (attempt_created_at DESC);

CREATE INDEX mv_chat_facts_chat_created_at_idx
    ON mv_chat_facts (chat_created_at DESC);

-- Flag indexes
CREATE INDEX mv_chat_facts_attempt_type_idx
    ON mv_chat_facts (attempt_type);

CREATE INDEX mv_chat_facts_is_archived_idx
    ON mv_chat_facts (is_archived);

CREATE INDEX mv_chat_facts_completed_idx
    ON mv_chat_facts (completed);

CREATE INDEX mv_chat_facts_passed_idx
    ON mv_chat_facts (passed)
    WHERE passed IS NOT NULL;

-- Composite indexes for common patterns

-- Home/Practice history: profile + type + archived + time
CREATE INDEX mv_chat_facts_profile_type_archived_time_idx
    ON mv_chat_facts (profile_id, attempt_type, is_archived, attempt_created_at DESC);

-- Dashboard: cohort + type + time
CREATE INDEX mv_chat_facts_cohort_type_time_idx
    ON mv_chat_facts (cohort_id, attempt_type, attempt_created_at DESC)
    WHERE cohort_id IS NOT NULL;

-- Simulation filtering: simulation + profile
CREATE INDEX mv_chat_facts_simulation_profile_idx
    ON mv_chat_facts (simulation_id, profile_id);

-- Persona chart: cohort + persona
CREATE INDEX mv_chat_facts_cohort_persona_idx
    ON mv_chat_facts (cohort_id, persona_id)
    WHERE cohort_id IS NOT NULL AND persona_id IS NOT NULL;

-- Partial index for non-archived (most common query)
CREATE INDEX mv_chat_facts_not_archived_idx
    ON mv_chat_facts (attempt_type, profile_id, attempt_created_at DESC)
    WHERE is_archived = FALSE;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_chat_facts;
