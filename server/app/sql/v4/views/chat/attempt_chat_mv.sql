-- Materialized View: attempt_chat_mv
-- Unified chat-grain fact table consolidating profile_facts_mv, simulation_facts_mv,
-- scenario_facts_mv, scenario_facts_mv, and attempt_chat_mv.
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
-- Step 1: Drop all indexes on attempt_chat_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'attempt_chat_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop attempt_chat_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS attempt_chat_mv CASCADE;

-- ============================================================================
-- Step 3: Create attempt_chat_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW attempt_chat_mv AS
WITH
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
        g.chat_id,
        g.score AS grade_score,
        g.passed AS grade_passed,
        g.time_taken AS grade_time_taken
    FROM attempt_grade_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
chat_rubric AS (
    SELECT DISTINCT ON (acrc.attempt_chat_id)
        acrc.attempt_chat_id,
        acrc.rubrics_id AS rubric_id,
        r.total_points AS rubric_total_points,
        r.pass_points AS rubric_pass_points
    FROM attempt_chat_rubrics_connection acrc
    JOIN rubrics_resource r ON r.id = acrc.rubrics_id
    WHERE acrc.active = TRUE
    ORDER BY acrc.attempt_chat_id, acrc.created_at DESC
),
chat_scope AS (
    SELECT
        c.id AS chat_id,
        (ARRAY_AGG(csc.scenarios_id ORDER BY csc.created_at)
            FILTER (WHERE csc.scenarios_id IS NOT NULL))[1] AS scenario_id
    FROM attempt_chat_entry c
    LEFT JOIN chat_scenarios_connection csc
        ON csc.chat_id = c.chat_id AND csc.active = TRUE
    WHERE c.active = TRUE
    GROUP BY c.id
)
SELECT
    -- Primary key
    c.id AS chat_id,

    -- Foreign keys
    ac.attempt_id,
    c.group_id,

    -- Resource IDs (derived from parent home/practice connections)
    apc.profiles_id AS profile_id,
    COALESCE(home_coh.cohorts_id, prac_coh.cohorts_id) AS cohort_id,
    COALESCE(home_dep.departments_id, prac_dep.departments_id) AS department_id,
    COALESCE(home_sim.simulations_id, prac_sim.simulations_id) AS simulation_id,

    -- Resource IDs (from training department scope)
    cs.scenario_id,

    -- Rubric ID (from chat's rubric connection)
    cr.rubric_id,

    -- Grade measures
    lg.grade_score,
    cr.rubric_total_points AS grade_total_points,
    cr.rubric_pass_points AS grade_pass_points,
    lg.grade_passed,
    lg.grade_time_taken,

    -- Chat state
    (EXISTS (SELECT 1 FROM attempt_completion_entry comp WHERE comp.chat_id = c.id AND comp.active = TRUE)) AS completed,

    -- Pre-computed attempt number per profile x simulation
    DENSE_RANK() OVER (
        PARTITION BY apc.profiles_id, COALESCE(home_sim.simulations_id, prac_sim.simulations_id)
        ORDER BY a.created_at, ac.attempt_id
    )::int AS attempt_number,

    -- Timestamps
    c.created_at AS chat_created_at,
    (a.created_at AT TIME ZONE 'UTC')::date AS attempt_date,

    -- Filters
    CASE WHEN ape.attempt_id IS NOT NULL THEN 'practice' ELSE 'general' END AS attempt_type,
    COALESCE(sa_archive.archived, FALSE) AS is_archived,
    COALESCE(a.infinite_mode, FALSE) AS infinite_mode

FROM attempt_chat_entry c
JOIN attempt_chat_bridge_entry ac ON ac.attempt_chat_id = c.id
JOIN attempt_entry a ON a.id = ac.attempt_id
JOIN attempt_profiles_connection apc ON apc.attempt_id = a.id
-- Parent bridges
LEFT JOIN attempt_home_entry ahe ON ahe.attempt_id = a.id AND ahe.active = true
LEFT JOIN attempt_practice_entry ape ON ape.attempt_id = a.id AND ape.active = true
-- Derive simulation/cohort/department from parent home/practice connections
LEFT JOIN home_simulations_connection home_sim ON home_sim.home_id = ahe.home_id AND home_sim.active = true
LEFT JOIN practice_simulations_connection prac_sim ON prac_sim.practice_id = ape.practice_id AND prac_sim.active = true
LEFT JOIN home_cohorts_connection home_coh ON home_coh.home_id = ahe.home_id AND home_coh.active = true
LEFT JOIN practice_cohorts_connection prac_coh ON prac_coh.practice_id = ape.practice_id AND prac_coh.active = true
LEFT JOIN home_departments_connection home_dep ON home_dep.home_id = ahe.home_id AND home_dep.active = true
LEFT JOIN practice_departments_connection prac_dep ON prac_dep.practice_id = ape.practice_id AND prac_dep.active = true
LEFT JOIN chat_scope cs ON cs.chat_id = c.id
LEFT JOIN latest_grade lg ON lg.chat_id = c.id
LEFT JOIN chat_rubric cr ON cr.attempt_chat_id = c.id
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

CREATE UNIQUE INDEX attempt_chat_mv_pk
    ON attempt_chat_mv (chat_id, attempt_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Resource ID indexes
CREATE INDEX attempt_chat_mv_profile_id_idx
    ON attempt_chat_mv (profile_id);

CREATE INDEX attempt_chat_mv_cohort_id_idx
    ON attempt_chat_mv (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX attempt_chat_mv_department_id_idx
    ON attempt_chat_mv (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX attempt_chat_mv_simulation_id_idx
    ON attempt_chat_mv (simulation_id);

CREATE INDEX attempt_chat_mv_scenario_id_idx
    ON attempt_chat_mv (scenario_id)
    WHERE scenario_id IS NOT NULL;

CREATE INDEX attempt_chat_mv_rubric_id_idx
    ON attempt_chat_mv (rubric_id)
    WHERE rubric_id IS NOT NULL;

CREATE INDEX attempt_chat_mv_attempt_id_idx
    ON attempt_chat_mv (attempt_id);

-- Time index
CREATE INDEX attempt_chat_mv_attempt_date_idx
    ON attempt_chat_mv (attempt_date DESC);

-- Flag indexes
CREATE INDEX attempt_chat_mv_attempt_type_idx
    ON attempt_chat_mv (attempt_type);

CREATE INDEX attempt_chat_mv_is_archived_idx
    ON attempt_chat_mv (is_archived);

-- Composite indexes for common query patterns

-- Profile aggregation: profile + date (header, leaderboard, reports)
CREATE INDEX attempt_chat_mv_profile_date_idx
    ON attempt_chat_mv (profile_id, attempt_date DESC);

-- Dashboard filter combo: profile + type + archived
CREATE INDEX attempt_chat_mv_profile_type_archived_idx
    ON attempt_chat_mv (profile_id, attempt_type, is_archived, attempt_date DESC);

-- Default filter: non-archived general
CREATE INDEX attempt_chat_mv_default_idx
    ON attempt_chat_mv (profile_id, attempt_date DESC)
    WHERE attempt_type = 'general' AND is_archived = FALSE;

-- Grade-based queries (for avg_score, highest_score rankings)
CREATE INDEX attempt_chat_mv_grade_idx
    ON attempt_chat_mv (grade_score DESC NULLS LAST)
    WHERE grade_score IS NOT NULL;

-- Cohort progress: cohort + date + simulation (secondary section)
CREATE INDEX attempt_chat_mv_cohort_date_sim_idx
    ON attempt_chat_mv (cohort_id, attempt_date DESC, simulation_id)
    WHERE cohort_id IS NOT NULL;

-- Attempt improvement: profile + simulation + attempt_number (secondary section)
CREATE INDEX attempt_chat_mv_profile_sim_attempt_idx
    ON attempt_chat_mv (profile_id, simulation_id, attempt_number);

-- Simulation + scenario (footer section)
CREATE INDEX attempt_chat_mv_sim_scenario_idx
    ON attempt_chat_mv (simulation_id, scenario_id);

-- Scenario + date (footer section)
CREATE INDEX attempt_chat_mv_scenario_date_idx
    ON attempt_chat_mv (scenario_id, attempt_date DESC)
    WHERE scenario_id IS NOT NULL;

-- Rubric indexes (primary section)
CREATE INDEX attempt_chat_mv_rubric_chat_idx
    ON attempt_chat_mv (rubric_id, chat_id)
    WHERE rubric_id IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW attempt_chat_mv;
