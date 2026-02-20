-- Materialized View: chat_resolved_mv
-- Unified chat-grain fact table consolidating profile_facts_mv, simulation_facts_mv,
-- scenario_facts_mv, scenario_facts_mv, and chat_resolved_mv.
--
-- Grain: One row per chat
-- Filter: None at MV level - all data included (filtering done at query time)
--
-- Purpose: Single source of truth for all dashboard analytics sections,
-- leaderboard, reports, attempt detail, and training list.
--
-- Dependencies: Uses entry/connection tables only (self-contained, no MV dependencies)
-- Note: Message stats, rubric scores, and training config are fetched via service layer.

-- ============================================================================
-- Step 1: Drop all indexes on chat_resolved_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'chat_resolved_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop chat_resolved_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS chat_resolved_mv CASCADE;

-- ============================================================================
-- Step 3: Create chat_resolved_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW chat_resolved_mv AS
WITH
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
        g.chat_id,
        g.score AS grade_score,
        g.passed AS grade_passed,
        g.time_taken AS grade_time_taken,
        g.total_points AS grade_total_points,
        g.pass_points AS grade_pass_points
    FROM attempt_grade_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
grade_rubric AS (
    SELECT DISTINCT ON (grc.grade_id)
        grc.grade_id,
        grc.rubrics_id AS rubric_id
    FROM attempt_grade_rubrics_connection grc
    WHERE grc.active = TRUE
    ORDER BY grc.grade_id, grc.created_at DESC
),
chat_scope AS (
    SELECT
        c.id AS chat_id,
        (ARRAY_AGG(tsc.scenarios_id ORDER BY tsc.created_at)
            FILTER (WHERE tsc.scenarios_id IS NOT NULL))[1] AS scenario_id,
        (ARRAY_AGG(tpc.scenario_personas_id ORDER BY tpc.created_at)
            FILTER (WHERE tpc.scenario_personas_id IS NOT NULL))[1] AS user_persona_id
    FROM chat_resolved_entry c
    LEFT JOIN chat_resolved_scenarios_connection tsc
        ON tsc.chat_resolved_id = c.id AND tsc.active = TRUE
    LEFT JOIN chat_resolved_personas_connection tpc
        ON tpc.chat_resolved_id = c.id AND tpc.active = TRUE
    WHERE c.active = TRUE
    GROUP BY c.id
)
SELECT
    -- Primary key
    c.id AS chat_id,

    -- Foreign keys
    ac.attempt_id,
    c.group_id,
    c.departments_id AS chat_resolved_departments_id,

    -- Resource IDs (from attempt connections)
    apc.profiles_id AS profile_id,
    acc.cohorts_id AS cohort_id,
    adc.departments_id AS department_id,
    asc_conn.simulations_id AS simulation_id,

    -- Resource IDs (from training department scope)
    cs.scenario_id,
    cs.user_persona_id,

    -- Rubric ID (from grade or training config, via grade_rubric CTE)
    COALESCE(gr.rubric_id, NULL) AS rubric_id,

    -- Grade measures
    lg.grade_score,
    lg.grade_total_points,
    lg.grade_pass_points,
    lg.grade_passed,
    lg.grade_time_taken,

    -- Chat state
    (EXISTS (SELECT 1 FROM attempt_completion_entry comp WHERE comp.chat_id = c.id AND comp.active = TRUE)) AS completed,

    -- Pre-computed attempt number per profile x simulation
    DENSE_RANK() OVER (
        PARTITION BY apc.profiles_id, asc_conn.simulations_id
        ORDER BY a.created_at, ac.attempt_id
    )::int AS attempt_number,

    -- Timestamps
    c.created_at AS chat_created_at,
    (a.created_at AT TIME ZONE 'UTC')::date AS attempt_date,

    -- Filters
    CASE WHEN COALESCE(a.practice, FALSE) THEN 'practice' ELSE 'general' END AS attempt_type,
    COALESCE(sa_archive.archived, FALSE) AS is_archived,
    COALESCE(a.infinite_mode, FALSE) AS infinite_mode

FROM chat_resolved_entry c
JOIN attempt_chat_entry ac ON ac.chat_resolved_id = c.id
JOIN attempt_entry a ON a.id = ac.attempt_id
JOIN attempt_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
JOIN attempt_profiles_connection apc ON apc.attempt_id = a.id
LEFT JOIN attempt_cohorts_connection acc ON acc.attempt_id = a.id
LEFT JOIN attempt_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN chat_scope cs ON cs.chat_id = c.id
LEFT JOIN latest_grade lg ON lg.chat_id = c.id
LEFT JOIN grade_rubric gr ON gr.grade_id = lg.grade_id
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE c.active = TRUE
  AND a.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX chat_resolved_mv_pk
    ON chat_resolved_mv (chat_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Resource ID indexes
CREATE INDEX chat_resolved_mv_profile_id_idx
    ON chat_resolved_mv (profile_id);

CREATE INDEX chat_resolved_mv_cohort_id_idx
    ON chat_resolved_mv (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX chat_resolved_mv_department_id_idx
    ON chat_resolved_mv (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX chat_resolved_mv_simulation_id_idx
    ON chat_resolved_mv (simulation_id);

CREATE INDEX chat_resolved_mv_scenario_id_idx
    ON chat_resolved_mv (scenario_id)
    WHERE scenario_id IS NOT NULL;

CREATE INDEX chat_resolved_mv_user_persona_id_idx
    ON chat_resolved_mv (user_persona_id)
    WHERE user_persona_id IS NOT NULL;

CREATE INDEX chat_resolved_mv_rubric_id_idx
    ON chat_resolved_mv (rubric_id)
    WHERE rubric_id IS NOT NULL;

CREATE INDEX chat_resolved_mv_attempt_id_idx
    ON chat_resolved_mv (attempt_id);

CREATE INDEX chat_resolved_mv_chat_resolved_departments_id_idx
    ON chat_resolved_mv (chat_resolved_departments_id)
    WHERE chat_resolved_departments_id IS NOT NULL;

-- Time index
CREATE INDEX chat_resolved_mv_attempt_date_idx
    ON chat_resolved_mv (attempt_date DESC);

-- Flag indexes
CREATE INDEX chat_resolved_mv_attempt_type_idx
    ON chat_resolved_mv (attempt_type);

CREATE INDEX chat_resolved_mv_is_archived_idx
    ON chat_resolved_mv (is_archived);

-- Composite indexes for common query patterns

-- Profile aggregation: profile + date (header, leaderboard, reports)
CREATE INDEX chat_resolved_mv_profile_date_idx
    ON chat_resolved_mv (profile_id, attempt_date DESC);

-- Dashboard filter combo: profile + type + archived
CREATE INDEX chat_resolved_mv_profile_type_archived_idx
    ON chat_resolved_mv (profile_id, attempt_type, is_archived, attempt_date DESC);

-- Default filter: non-archived general
CREATE INDEX chat_resolved_mv_default_idx
    ON chat_resolved_mv (profile_id, attempt_date DESC)
    WHERE attempt_type = 'general' AND is_archived = FALSE;

-- Grade-based queries (for avg_score, highest_score rankings)
CREATE INDEX chat_resolved_mv_grade_idx
    ON chat_resolved_mv (grade_score DESC NULLS LAST)
    WHERE grade_score IS NOT NULL;

-- Cohort progress: cohort + date + simulation (secondary section)
CREATE INDEX chat_resolved_mv_cohort_date_sim_idx
    ON chat_resolved_mv (cohort_id, attempt_date DESC, simulation_id)
    WHERE cohort_id IS NOT NULL;

-- Persona performance: persona + cohort (secondary section)
CREATE INDEX chat_resolved_mv_persona_cohort_idx
    ON chat_resolved_mv (user_persona_id, cohort_id)
    WHERE user_persona_id IS NOT NULL;

-- Attempt improvement: profile + simulation + attempt_number (secondary section)
CREATE INDEX chat_resolved_mv_profile_sim_attempt_idx
    ON chat_resolved_mv (profile_id, simulation_id, attempt_number);

-- Simulation + scenario (footer section)
CREATE INDEX chat_resolved_mv_sim_scenario_idx
    ON chat_resolved_mv (simulation_id, scenario_id);

-- Scenario + date (footer section)
CREATE INDEX chat_resolved_mv_scenario_date_idx
    ON chat_resolved_mv (scenario_id, attempt_date DESC)
    WHERE scenario_id IS NOT NULL;

-- Rubric indexes (primary section)
CREATE INDEX chat_resolved_mv_rubric_chat_idx
    ON chat_resolved_mv (rubric_id, chat_id)
    WHERE rubric_id IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW chat_resolved_mv;
