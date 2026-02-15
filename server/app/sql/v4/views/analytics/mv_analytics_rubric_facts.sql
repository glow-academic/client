-- Materialized View: mv_rubric_facts
-- Rubric section fact table for dashboard analytics.
--
-- Grain: One row per (chat, standard_group)
-- Filter: None at MV level - all data included (filtering done at query time)
--
-- Purpose: Supports three rubric section widgets:
--   1. Rubric Heatmap (GROUP BY rubric_id, chat_id, standard_group_id → Pearson correlation)
--   2. Skill Radar (GROUP BY rubric_id, standard_group_id → AVG score_percent)
--   3. Rubric Score Trend (GROUP BY rubric_id, standard_group_id, attempt_date → AVG score_percent)
--
-- Section: ANALYTICS (rubric section)
--
-- Dependencies: Uses entry tables only (self-contained, no MV dependencies)
-- Note: standard_group metadata (name, short_name) hydrated via resource handlers.

-- ============================================================================
-- Step 1: Drop all indexes on mv_rubric_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_rubric_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_rubric_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_rubric_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_rubric_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_rubric_facts AS
WITH
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
        g.chat_id
    FROM simulation_grades_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
grade_rubric AS (
    SELECT DISTINCT ON (grc.grade_id)
        grc.grade_id,
        grc.rubrics_id AS rubric_id
    FROM simulation_grades_rubrics_connection grc
    WHERE grc.active = TRUE
    ORDER BY grc.grade_id, grc.created_at DESC
)
SELECT
    -- Composite primary key
    lg.chat_id,
    sg.id AS standard_group_id,

    -- Rubric (grouping dimension for heatmap/radar/trend)
    gr.rubric_id,

    -- Score (pre-computed from feedbacks)
    CASE WHEN sg.points > 0
         THEN TRUNC((100.0 * SUM(fe.total)::numeric / sg.points::numeric), 2)::float8
         ELSE NULL
    END AS score_percent,

    -- Resource IDs for filtering
    asc_conn.simulations_id AS simulation_id,
    apc.profiles_id AS profile_id,
    acc.cohorts_id AS cohort_id,
    adc.departments_id AS department_id,

    -- Timestamps
    (a.created_at AT TIME ZONE 'UTC')::date AS attempt_date,

    -- Filters
    CASE WHEN COALESCE(a.practice, FALSE) THEN 'practice' ELSE 'general' END AS attempt_type,
    COALESCE(a.archived, FALSE) AS is_archived

FROM latest_grade lg
JOIN grade_rubric gr ON gr.grade_id = lg.grade_id
JOIN simulation_chats_entry c ON c.id = lg.chat_id
JOIN simulation_attempts_entry a ON a.id = c.attempt_id
JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
LEFT JOIN simulation_attempts_cohorts_connection acc ON acc.attempt_id = a.id
LEFT JOIN simulation_attempts_departments_connection adc ON adc.attempt_id = a.id
JOIN simulation_feedbacks_entry fe ON fe.grade_id = lg.grade_id AND fe.active = TRUE
JOIN feedbacks_standards_connection fsc ON fsc.feedbacks_id = fe.id
JOIN standards_resource s ON s.id = fsc.standard_id
JOIN rubric_rubrics_junction rrj
    ON rrj.rubrics_id = gr.rubric_id
   AND rrj.active = TRUE
JOIN rubric_standard_groups_junction rsg
    ON rsg.rubric_id = rrj.rubric_id
   AND rsg.active = TRUE
JOIN standard_groups_resource sg
    ON sg.id = rsg.standard_group_id
   AND sg.id = s.standard_group_id
WHERE c.active = TRUE
  AND a.active = TRUE
GROUP BY
    lg.chat_id,
    sg.id,
    gr.rubric_id,
    sg.points,
    asc_conn.simulations_id,
    apc.profiles_id,
    acc.cohorts_id,
    adc.departments_id,
    a.created_at,
    a.practice,
    a.archived
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_rubric_facts_pk
    ON mv_rubric_facts (chat_id, standard_group_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Resource ID indexes
CREATE INDEX mv_rubric_facts_rubric_id_idx
    ON mv_rubric_facts (rubric_id);

CREATE INDEX mv_rubric_facts_simulation_id_idx
    ON mv_rubric_facts (simulation_id);

CREATE INDEX mv_rubric_facts_profile_id_idx
    ON mv_rubric_facts (profile_id);

CREATE INDEX mv_rubric_facts_cohort_id_idx
    ON mv_rubric_facts (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_rubric_facts_department_id_idx
    ON mv_rubric_facts (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_rubric_facts_standard_group_id_idx
    ON mv_rubric_facts (standard_group_id);

-- Time index
CREATE INDEX mv_rubric_facts_attempt_date_idx
    ON mv_rubric_facts (attempt_date DESC);

-- Flag indexes
CREATE INDEX mv_rubric_facts_attempt_type_idx
    ON mv_rubric_facts (attempt_type);

CREATE INDEX mv_rubric_facts_is_archived_idx
    ON mv_rubric_facts (is_archived);

-- Composite indexes for common query patterns

-- Heatmap + Radar: rubric + chat (group by rubric, then correlate across chats)
CREATE INDEX mv_rubric_facts_rubric_chat_idx
    ON mv_rubric_facts (rubric_id, chat_id);

-- Trend: rubric + standard_group + date
CREATE INDEX mv_rubric_facts_rubric_group_date_idx
    ON mv_rubric_facts (rubric_id, standard_group_id, attempt_date DESC);

-- Profile filter combo
CREATE INDEX mv_rubric_facts_profile_type_archived_idx
    ON mv_rubric_facts (profile_id, attempt_type, is_archived, attempt_date DESC);

-- Default filter: non-archived general
CREATE INDEX mv_rubric_facts_default_idx
    ON mv_rubric_facts (rubric_id, attempt_date DESC)
    WHERE attempt_type = 'general' AND is_archived = FALSE;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_rubric_facts;
