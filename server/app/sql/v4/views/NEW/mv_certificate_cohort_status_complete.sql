-- Materialized View: mv_certificate_cohort_status
-- Pre-aggregates certificate status per profile/cohort/simulation.
--
-- Grain: One row per (profile_id, cohort_id, simulation_id)
-- Purpose: Certificate page - track pass/fail per simulation within each cohort
--
-- Source: Aggregates from mv_chat_facts WHERE attempt_type = 'general' AND NOT is_archived
-- ============================================================================
-- Step 1: Drop all indexes (if exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_certificate_cohort_status'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_certificate_cohort_status CASCADE;

-- ============================================================================
-- Step 3: Create Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_certificate_cohort_status AS
SELECT
    -- Keys
    profile_id,
    cohort_id,
    simulation_id,

    -- Status
    MAX(grade_percent) AS highest_score,
    BOOL_OR(passed = TRUE) AS has_passed,
    -- Pass threshold from rubric (use max to get the threshold)
    MAX(
        CASE
            WHEN rubric_total_points IS NOT NULL AND rubric_total_points > 0
            THEN ROUND((rubric_pass_points::numeric / rubric_total_points) * 100, 2)
            ELSE NULL
        END
    ) AS pass_threshold

FROM mv_chat_facts
WHERE attempt_type = 'general'
  AND is_archived = FALSE
  AND cohort_id IS NOT NULL
GROUP BY profile_id, cohort_id, simulation_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_certificate_cohort_status_pk
    ON mv_certificate_cohort_status (profile_id, cohort_id, simulation_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary access pattern: profile + cohort lookup
CREATE INDEX mv_certificate_cohort_status_profile_cohort_idx
    ON mv_certificate_cohort_status (profile_id, cohort_id);

-- Profile filter
CREATE INDEX mv_certificate_cohort_status_profile_id_idx
    ON mv_certificate_cohort_status (profile_id);

-- Cohort filter
CREATE INDEX mv_certificate_cohort_status_cohort_id_idx
    ON mv_certificate_cohort_status (cohort_id);

-- Simulation filter
CREATE INDEX mv_certificate_cohort_status_simulation_id_idx
    ON mv_certificate_cohort_status (simulation_id);

-- Has passed filter (for certificate eligibility)
CREATE INDEX mv_certificate_cohort_status_has_passed_idx
    ON mv_certificate_cohort_status (has_passed)
    WHERE has_passed = TRUE;

-- Composite for certificate queries
CREATE INDEX mv_certificate_cohort_status_cohort_passed_idx
    ON mv_certificate_cohort_status (cohort_id, has_passed);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_certificate_cohort_status;
