-- Materialized View: mv_dashboard_rubric_facts
-- Pre-computes rubric/standard group scores per grade for dashboard analytics.
-- Groups by: (grade_id, rubric_id, standard_group_id)
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- Key principle: MVs only go stale when new records are added.
-- Resource metadata changes (names, descriptions) are always fresh via query-time joins.
--
-- This MV captures grade-level standard group performance, enabling:
-- - Rubric heatmap correlations
-- - Skill performance radar charts
-- - Standard group pass rates across cohorts/simulations
-- ============================================================================
-- Step 1: Drop all indexes on mv_dashboard_rubric_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_dashboard_rubric_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_dashboard_rubric_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_rubric_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_dashboard_rubric_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_rubric_facts AS
WITH
grade_standards AS (
    SELECT
        g.id AS grade_id,
        c.id AS chat_id,
        grc.rubrics_id AS rubric_id,
        s.standard_group_id,
        SUM(fe.total)::int AS group_score,
        a.id AS attempt_id,
        asc_conn.simulations_id AS simulation_id,
        adc.departments_id AS department_id,
        a.created_at AS attempt_created_at,
        CASE
            WHEN a.practice IS TRUE THEN 'practice'::text
            ELSE 'general'::text
        END AS attempt_type
    FROM simulation_grades_entry g
    JOIN simulation_chats_entry c ON c.id = g.chat_id
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
    LEFT JOIN simulation_attempts_departments_connection adc ON adc.attempt_id = a.id
    JOIN simulation_grades_rubrics_connection grc ON grc.grade_id = g.id
    JOIN simulation_feedbacks_entry fe ON fe.grade_id = g.id
    JOIN feedbacks_standards_connection fsc ON fsc.feedbacks_id = fe.id
    JOIN standards_resource s ON s.id = fsc.standard_id
    WHERE g.active = TRUE
      AND a.active = TRUE
      AND c.active = TRUE
    GROUP BY
        g.id, c.id, grc.rubrics_id, s.standard_group_id,
        a.id, asc_conn.simulations_id, adc.departments_id, a.created_at, a.practice
)
SELECT
    grade_id,
    chat_id,
    rubric_id,
    standard_group_id,
    group_score,
    -- Context IDs for filtering
    attempt_id,
    simulation_id,
    department_id,
    attempt_created_at,
    attempt_type
FROM grade_standards
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

-- Composite unique key for grade + standard group
CREATE UNIQUE INDEX mv_dashboard_rubric_facts_pk
    ON mv_dashboard_rubric_facts (grade_id, standard_group_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary key alternatives for different access patterns
CREATE INDEX mv_dashboard_rubric_facts_grade_id_idx
    ON mv_dashboard_rubric_facts (grade_id);

CREATE INDEX mv_dashboard_rubric_facts_chat_id_idx
    ON mv_dashboard_rubric_facts (chat_id);

CREATE INDEX mv_dashboard_rubric_facts_rubric_id_idx
    ON mv_dashboard_rubric_facts (rubric_id);

CREATE INDEX mv_dashboard_rubric_facts_standard_group_id_idx
    ON mv_dashboard_rubric_facts (standard_group_id);

-- Context ID indexes for filtering
CREATE INDEX mv_dashboard_rubric_facts_attempt_id_idx
    ON mv_dashboard_rubric_facts (attempt_id);

CREATE INDEX mv_dashboard_rubric_facts_simulation_id_idx
    ON mv_dashboard_rubric_facts (simulation_id);

CREATE INDEX mv_dashboard_rubric_facts_department_id_idx
    ON mv_dashboard_rubric_facts (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_dashboard_rubric_facts_attempt_type_idx
    ON mv_dashboard_rubric_facts (attempt_type);

-- Timestamp index for date range filtering
CREATE INDEX mv_dashboard_rubric_facts_attempt_created_at_idx
    ON mv_dashboard_rubric_facts (attempt_created_at);

-- Composite indexes for common query patterns
CREATE INDEX mv_dashboard_rubric_facts_rubric_group_idx
    ON mv_dashboard_rubric_facts (rubric_id, standard_group_id);

CREATE INDEX mv_dashboard_rubric_facts_sim_group_idx
    ON mv_dashboard_rubric_facts (simulation_id, standard_group_id);

CREATE INDEX mv_dashboard_rubric_facts_sim_rubric_idx
    ON mv_dashboard_rubric_facts (simulation_id, rubric_id);

CREATE INDEX mv_dashboard_rubric_facts_dept_group_idx
    ON mv_dashboard_rubric_facts (department_id, standard_group_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_dashboard_rubric_facts_sim_date_idx
    ON mv_dashboard_rubric_facts (simulation_id, attempt_created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_rubric_facts;
