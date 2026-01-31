-- Materialized View: mv_home_certificate_status
-- Certificate eligibility for HOME section.
--
-- Grain: One row per (profile_id, cohort_id, simulation_id)
-- Purpose: Certificate eligibility per simulation within a cohort
--
-- Section: HOME
-- Source: Aggregate from mv_home_chat_facts WHERE cohort_id IS NOT NULL
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_home_certificate_status materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_home_certificate_status'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_home_certificate_status materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_home_certificate_status CASCADE;

-- ============================================================================
-- Step 3: Create mv_home_certificate_status Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_home_certificate_status AS
SELECT
    -- Keys
    profile_id,
    cohort_id,
    simulation_id,

    -- Status
    MAX(grade_percent) AS highest_score,
    BOOL_OR(passed) AS has_passed,
    -- Pass threshold: (rubric_pass_points / rubric_total_points) * 100
    -- Use the most recent rubric configuration (assumes consistent across attempts)
    TRUNC(
        (MAX(rubric_pass_points)::numeric / NULLIF(MAX(rubric_total_points), 0)) * 100.0,
        2
    ) AS pass_threshold

FROM mv_home_chat_facts
WHERE cohort_id IS NOT NULL
GROUP BY profile_id, cohort_id, simulation_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_home_certificate_status_pk
    ON mv_home_certificate_status (profile_id, cohort_id, simulation_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary lookup: profile's certificates
CREATE INDEX mv_home_certificate_status_profile_id_idx
    ON mv_home_certificate_status (profile_id);

-- Cohort filtering
CREATE INDEX mv_home_certificate_status_cohort_id_idx
    ON mv_home_certificate_status (cohort_id);

-- Simulation filtering
CREATE INDEX mv_home_certificate_status_simulation_id_idx
    ON mv_home_certificate_status (simulation_id);

-- Composite: profile + cohort for user's cohort certificates
CREATE INDEX mv_home_certificate_status_profile_cohort_idx
    ON mv_home_certificate_status (profile_id, cohort_id);

-- Composite: cohort + simulation for admin queries
CREATE INDEX mv_home_certificate_status_cohort_simulation_idx
    ON mv_home_certificate_status (cohort_id, simulation_id);

-- Pass status filtering
CREATE INDEX mv_home_certificate_status_has_passed_idx
    ON mv_home_certificate_status (has_passed)
    WHERE has_passed = TRUE;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_home_certificate_status;
