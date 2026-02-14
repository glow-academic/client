-- Materialized View: mv_simulation_facts
-- Simulation section fact table for dashboard analytics.
--
-- Grain: One row per chat
-- Filter: None at MV level - all data included (filtering done at query time)
--
-- Purpose: Supports four simulation/footer section widgets:
--   1. Simulation Performance (GROUP BY simulation_id, scenario_id)
--   2. Simulation Composition (GROUP BY attempt_id -> simulation_id, parameter counts)
--   3. Scenario Performance (parameter-level via hydrated scenario/persona/document resources)
--   4. Scenario Stats (numeric parameter-level via hydrated resources)
--
-- Parameter resolution is NOT done in this MV. Instead, scenario_id, persona_id,
-- and document_ids are stored as resource IDs. At runtime, these resources are
-- hydrated via cached resource handlers which carry denormalized parameter_field_ids[].
-- parameter_fields_resource provides (parameter_id, field_id, conditional_parameter_ids).
--
-- Section: ANALYTICS (simulation/footer section)
--
-- Dependencies: Uses entry/connection tables only (self-contained, no MV or resource table dependencies)

-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_simulation_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_facts AS
WITH
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.chat_id,
        g.score,
        g.passed,
        g.time_taken,
        g.total_points AS rubric_total_points
    FROM simulation_grades_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
chat_scope AS (
    SELECT
        c.id AS chat_id,
        (ARRAY_AGG(tsc.scenarios_id ORDER BY tsc.created_at)
            FILTER (WHERE tsc.scenarios_id IS NOT NULL))[1] AS scenario_id,
        (ARRAY_AGG(tpc.personas_id ORDER BY tpc.created_at)
            FILTER (WHERE tpc.personas_id IS NOT NULL))[1] AS persona_id,
        COALESCE(
            ARRAY_AGG(DISTINCT tdc.documents_id ORDER BY tdc.documents_id)
                FILTER (WHERE tdc.documents_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS document_ids
    FROM simulation_chats_entry c
    LEFT JOIN training_bundle_departments_entry tbd
        ON tbd.id = c.training_bundle_department_id AND tbd.active = TRUE
    LEFT JOIN training_bundle_departments_scenarios_connection tsc
        ON tsc.training_bundle_department_id = tbd.id AND tsc.active = TRUE
    LEFT JOIN training_bundle_departments_personas_connection tpc
        ON tpc.training_bundle_department_id = tbd.id AND tpc.active = TRUE
    LEFT JOIN training_bundle_departments_documents_connection tdc
        ON tdc.training_bundle_department_id = tbd.id AND tdc.active = TRUE
    WHERE c.active = TRUE
    GROUP BY c.id
)
SELECT
    -- Primary key
    c.id AS chat_id,

    -- Resource IDs
    c.attempt_id,
    asc_conn.simulations_id AS simulation_id,
    cs.scenario_id,
    cs.persona_id,
    cs.document_ids,
    apc.profiles_id AS profile_id,
    acc.cohorts_id AS cohort_id,
    adc.departments_id AS department_id,

    -- Measures
    CASE
        WHEN lg.rubric_total_points IS NOT NULL AND lg.rubric_total_points > 0
        THEN ROUND((lg.score::numeric / lg.rubric_total_points::numeric) * 100, 2)
        ELSE NULL
    END AS grade_percent,
    lg.passed,
    (EXISTS (SELECT 1 FROM simulation_completions_entry comp WHERE comp.chat_id = c.id AND comp.active = TRUE)) AS completed,

    -- Timestamps
    (a.created_at AT TIME ZONE 'UTC')::date AS attempt_date,

    -- Filters
    CASE WHEN COALESCE(a.practice, FALSE) THEN 'practice' ELSE 'general' END AS attempt_type,
    COALESCE(a.archived, FALSE) AS is_archived

FROM simulation_chats_entry c
JOIN simulation_attempts_entry a ON a.id = c.attempt_id
JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
LEFT JOIN simulation_attempts_cohorts_connection acc ON acc.attempt_id = a.id
LEFT JOIN simulation_attempts_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN latest_grade lg ON lg.chat_id = c.id
LEFT JOIN chat_scope cs ON cs.chat_id = c.id
WHERE c.active = TRUE
  AND a.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_simulation_facts_pk
    ON mv_simulation_facts (chat_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Resource ID indexes
CREATE INDEX mv_simulation_facts_simulation_id_idx
    ON mv_simulation_facts (simulation_id);

CREATE INDEX mv_simulation_facts_scenario_id_idx
    ON mv_simulation_facts (scenario_id)
    WHERE scenario_id IS NOT NULL;

CREATE INDEX mv_simulation_facts_profile_id_idx
    ON mv_simulation_facts (profile_id);

CREATE INDEX mv_simulation_facts_cohort_id_idx
    ON mv_simulation_facts (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_simulation_facts_department_id_idx
    ON mv_simulation_facts (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_simulation_facts_persona_id_idx
    ON mv_simulation_facts (persona_id)
    WHERE persona_id IS NOT NULL;

CREATE INDEX mv_simulation_facts_attempt_id_idx
    ON mv_simulation_facts (attempt_id);

-- Time index
CREATE INDEX mv_simulation_facts_attempt_date_idx
    ON mv_simulation_facts (attempt_date DESC);

-- Flag indexes
CREATE INDEX mv_simulation_facts_attempt_type_idx
    ON mv_simulation_facts (attempt_type);

CREATE INDEX mv_simulation_facts_is_archived_idx
    ON mv_simulation_facts (is_archived);

-- Composite indexes for widget query patterns

-- Widget 1 (Simulation Performance): GROUP BY (simulation_id, scenario_id)
CREATE INDEX mv_simulation_facts_sim_scenario_idx
    ON mv_simulation_facts (simulation_id, scenario_id);

-- Widget 2 (Simulation Composition): GROUP BY attempt_id -> simulation_id
CREATE INDEX mv_simulation_facts_sim_attempt_idx
    ON mv_simulation_facts (simulation_id, attempt_id);

-- Widget 3/4 (Scenario Performance/Stats): scenario_id + date for daily grouping
CREATE INDEX mv_simulation_facts_scenario_date_idx
    ON mv_simulation_facts (scenario_id, attempt_date DESC)
    WHERE scenario_id IS NOT NULL;

-- Default filter: non-archived general
CREATE INDEX mv_simulation_facts_default_idx
    ON mv_simulation_facts (simulation_id, attempt_date DESC)
    WHERE attempt_type = 'general' AND is_archived = FALSE;

-- Profile + type + archived (common dashboard filter combo)
CREATE INDEX mv_simulation_facts_profile_type_archived_idx
    ON mv_simulation_facts (profile_id, attempt_type, is_archived, attempt_date DESC);

-- GIN index on document_ids for array queries
CREATE INDEX mv_simulation_facts_document_ids_gin_idx
    ON mv_simulation_facts USING GIN (document_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_facts;
