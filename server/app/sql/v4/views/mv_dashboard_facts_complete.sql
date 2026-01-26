-- Materialized View: mv_dashboard_facts
-- UNION ALL of mv_general_analytics and mv_practice_analytics with attempt_type discriminator.
-- This is the primary view for dashboard queries that need both general and practice data.
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- IMPORTANT: This MV depends on mv_general_analytics and mv_practice_analytics.
-- Those MVs must be created and refreshed BEFORE this one.
--
-- Key principle: MVs only go stale when new records are added.
-- Resource metadata changes (names, descriptions) are always fresh via query-time joins.
-- ============================================================================
-- Step 1: Drop all indexes on mv_dashboard_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_dashboard_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_dashboard_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_dashboard_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_facts AS
SELECT
    -- Entry IDs
    attempt_id,
    chat_id,
    grade_id,

    -- Resource IDs (from connections)
    simulation_id,
    profile_id,
    department_id,
    cohort_id,
    role_id,
    scenario_id,
    persona_id,
    rubric_id,

    -- Parameter field IDs array
    parameter_field_ids,

    -- Timestamps (from entries)
    attempt_created_at,
    chat_created_at,
    grade_created_at,

    -- Flags (from entries)
    is_archived,
    infinite_mode,
    completed,

    -- Grade data (from grade entry - immutable facts)
    score,
    passed,
    time_taken,

    -- Message stats (pre-aggregated)
    num_messages_total,
    num_query_messages,
    num_response_messages,

    -- Attempt type discriminator
    'general'::text AS attempt_type

FROM mv_general_analytics

UNION ALL

SELECT
    -- Entry IDs
    attempt_id,
    chat_id,
    grade_id,

    -- Resource IDs (from connections)
    simulation_id,
    profile_id,
    department_id,
    NULL::uuid AS cohort_id,  -- Practice has no cohorts
    role_id,
    scenario_id,
    persona_id,
    rubric_id,

    -- Parameter field IDs array
    parameter_field_ids,

    -- Timestamps (from entries)
    attempt_created_at,
    chat_created_at,
    grade_created_at,

    -- Flags (from entries)
    is_archived,
    infinite_mode,
    completed,

    -- Grade data (from grade entry - immutable facts)
    score,
    passed,
    time_taken,

    -- Message stats (pre-aggregated)
    num_messages_total,
    num_query_messages,
    num_response_messages,

    -- Attempt type discriminator
    'practice'::text AS attempt_type

FROM mv_practice_analytics
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_dashboard_facts_pk
    ON mv_dashboard_facts (chat_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary key alternatives for different access patterns
CREATE INDEX mv_dashboard_facts_attempt_id_idx
    ON mv_dashboard_facts (attempt_id);

CREATE INDEX mv_dashboard_facts_grade_id_idx
    ON mv_dashboard_facts (grade_id)
    WHERE grade_id IS NOT NULL;

-- Resource ID indexes for filtering
CREATE INDEX mv_dashboard_facts_simulation_id_idx
    ON mv_dashboard_facts (simulation_id);

CREATE INDEX mv_dashboard_facts_profile_id_idx
    ON mv_dashboard_facts (profile_id);

CREATE INDEX mv_dashboard_facts_department_id_idx
    ON mv_dashboard_facts (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_dashboard_facts_cohort_id_idx
    ON mv_dashboard_facts (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_dashboard_facts_role_id_idx
    ON mv_dashboard_facts (role_id)
    WHERE role_id IS NOT NULL;

CREATE INDEX mv_dashboard_facts_scenario_id_idx
    ON mv_dashboard_facts (scenario_id);

CREATE INDEX mv_dashboard_facts_persona_id_idx
    ON mv_dashboard_facts (persona_id)
    WHERE persona_id IS NOT NULL;

CREATE INDEX mv_dashboard_facts_rubric_id_idx
    ON mv_dashboard_facts (rubric_id)
    WHERE rubric_id IS NOT NULL;

-- Timestamp indexes for date range filtering
CREATE INDEX mv_dashboard_facts_attempt_created_at_idx
    ON mv_dashboard_facts (attempt_created_at);

CREATE INDEX mv_dashboard_facts_chat_created_at_idx
    ON mv_dashboard_facts (chat_created_at);

CREATE INDEX mv_dashboard_facts_grade_created_at_idx
    ON mv_dashboard_facts (grade_created_at)
    WHERE grade_created_at IS NOT NULL;

-- Flag indexes
CREATE INDEX mv_dashboard_facts_is_archived_idx
    ON mv_dashboard_facts (is_archived);

CREATE INDEX mv_dashboard_facts_completed_idx
    ON mv_dashboard_facts (completed);

CREATE INDEX mv_dashboard_facts_passed_idx
    ON mv_dashboard_facts (passed)
    WHERE passed IS NOT NULL;

-- Attempt type index for general/practice filtering
CREATE INDEX mv_dashboard_facts_attempt_type_idx
    ON mv_dashboard_facts (attempt_type);

-- GIN index for parameter_field_ids array filtering
CREATE INDEX mv_dashboard_facts_parameter_field_ids_gin
    ON mv_dashboard_facts USING GIN (parameter_field_ids);

-- Composite indexes for common dashboard query patterns
CREATE INDEX mv_dashboard_facts_simulation_attempt_created_idx
    ON mv_dashboard_facts (simulation_id, attempt_created_at DESC);

CREATE INDEX mv_dashboard_facts_profile_attempt_created_idx
    ON mv_dashboard_facts (profile_id, attempt_created_at DESC);

CREATE INDEX mv_dashboard_facts_cohort_attempt_created_idx
    ON mv_dashboard_facts (cohort_id, attempt_created_at DESC)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_dashboard_facts_department_attempt_created_idx
    ON mv_dashboard_facts (department_id, attempt_created_at DESC)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_dashboard_facts_type_attempt_created_idx
    ON mv_dashboard_facts (attempt_type, attempt_created_at DESC);

-- Partial indexes for common filter patterns
CREATE INDEX mv_dashboard_facts_not_archived_idx
    ON mv_dashboard_facts (attempt_created_at DESC)
    WHERE is_archived = FALSE;

CREATE INDEX mv_dashboard_facts_general_not_archived_idx
    ON mv_dashboard_facts (attempt_created_at DESC)
    WHERE attempt_type = 'general' AND is_archived = FALSE;

CREATE INDEX mv_dashboard_facts_practice_not_archived_idx
    ON mv_dashboard_facts (attempt_created_at DESC)
    WHERE attempt_type = 'practice' AND is_archived = FALSE;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_facts;
