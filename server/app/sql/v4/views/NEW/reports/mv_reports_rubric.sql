-- Materialized View: mv_reports_rubric
-- Rubric-level aggregation for REPORTS section - skill/rubric performance charts.
--
-- Grain: One row per (profile_id, rubric_id)
-- Purpose: Rubric/skill performance breakdown for individual reports (heatmap)
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: REPORTS
-- Source: simulation_grades_entry, simulation_grades_rubrics_connection, connections
--
-- Filter: is_archived = FALSE
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_reports_rubric materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_reports_rubric'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_reports_rubric materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_reports_rubric CASCADE;

-- ============================================================================
-- Step 3: Create mv_reports_rubric Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_reports_rubric AS
WITH
-- Get attempt to profile mapping
attempt_profiles AS (
    SELECT
        sap.attempt_id,
        ppj.profile_id
    FROM simulation_attempts_profiles_connection sap
    JOIN profile_profiles_junction ppj ON ppj.profiles_id = sap.profiles_id
),
-- Get grade to rubric mapping
grade_rubrics AS (
    SELECT
        sgr.grade_id,
        rrj.rubric_id
    FROM simulation_grades_rubrics_connection sgr
    JOIN rubric_rubrics_junction rrj ON rrj.rubrics_id = sgr.rubrics_id
),
-- Get rubric points
rubric_points AS (
    SELECT
        rp.rubric_id,
        MAX(p.value) FILTER (WHERE rp.type = 'total'::point_type) AS total_points,
        MAX(p.value) FILTER (WHERE rp.type = 'pass'::point_type) AS pass_points
    FROM rubric_points_junction rp
    JOIN points_resource p ON p.id = rp.point_id
    GROUP BY rp.rubric_id
),
-- Get latest grade per chat with rubric info
chat_grades_with_rubric AS (
    SELECT DISTINCT ON (g.chat_id, gr.rubric_id)
        g.chat_id,
        c.attempt_id,
        gr.rubric_id,
        g.score,
        g.passed,
        rp.total_points,
        rp.pass_points
    FROM simulation_grades_entry g
    JOIN simulation_chats_entry c ON c.id = g.chat_id
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    JOIN grade_rubrics gr ON gr.grade_id = g.id
    LEFT JOIN rubric_points rp ON rp.rubric_id = gr.rubric_id
    WHERE a.archived = FALSE
    ORDER BY g.chat_id, gr.rubric_id, g.created_at DESC
)
SELECT
    -- Keys
    ap.profile_id,
    cgr.rubric_id,

    -- Aggregated counts
    COUNT(DISTINCT cgr.attempt_id)::int AS attempt_count,
    COUNT(*)::int AS grade_count,
    COUNT(*) FILTER (WHERE cgr.passed = true)::int AS passed_count,

    -- Score metrics
    TRUNC(AVG(cgr.score)::numeric, 2) AS avg_score,
    MAX(cgr.score)::int AS max_score,
    MIN(cgr.score) FILTER (WHERE cgr.score IS NOT NULL)::int AS min_score,

    -- Pass rate
    CASE
        WHEN COUNT(*) > 0 THEN
            TRUNC((COUNT(*) FILTER (WHERE cgr.passed = true)::numeric / COUNT(*)) * 100, 2)
        ELSE 0
    END AS pass_rate,

    -- Rubric points (from first non-null)
    MAX(cgr.total_points)::int AS total_points,
    MAX(cgr.pass_points)::int AS pass_points,

    -- Score percentage (score / total_points * 100)
    CASE
        WHEN MAX(cgr.total_points) > 0 THEN
            TRUNC((AVG(cgr.score)::numeric / MAX(cgr.total_points)) * 100, 2)
        ELSE NULL
    END AS avg_score_percent

FROM chat_grades_with_rubric cgr
JOIN attempt_profiles ap ON ap.attempt_id = cgr.attempt_id
WHERE cgr.rubric_id IS NOT NULL
GROUP BY ap.profile_id, cgr.rubric_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_reports_rubric_pk
    ON mv_reports_rubric (
        COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
        rubric_id
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Profile filtering (primary for reports)
CREATE INDEX mv_reports_rubric_profile_id_idx
    ON mv_reports_rubric (profile_id)
    WHERE profile_id IS NOT NULL;

-- Rubric filtering
CREATE INDEX mv_reports_rubric_rubric_id_idx
    ON mv_reports_rubric (rubric_id);

-- Composite: profile + rubric for user skill breakdown
CREATE INDEX mv_reports_rubric_profile_rubric_idx
    ON mv_reports_rubric (profile_id, rubric_id)
    WHERE profile_id IS NOT NULL;

-- Score sorting
CREATE INDEX mv_reports_rubric_avg_score_idx
    ON mv_reports_rubric (avg_score DESC);

-- Pass rate sorting
CREATE INDEX mv_reports_rubric_pass_rate_idx
    ON mv_reports_rubric (pass_rate DESC);

-- Score percent sorting
CREATE INDEX mv_reports_rubric_avg_score_percent_idx
    ON mv_reports_rubric (avg_score_percent DESC)
    WHERE avg_score_percent IS NOT NULL;

-- Grade count sorting
CREATE INDEX mv_reports_rubric_grade_count_idx
    ON mv_reports_rubric (grade_count DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_reports_rubric;
