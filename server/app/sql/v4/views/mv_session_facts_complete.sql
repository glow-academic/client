-- Materialized View: mv_session_facts
-- Pre-aggregates session metrics for activity pages.
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- IMPORTANT: This MV depends on mv_group_pricing_facts.
-- mv_group_pricing_facts must be created and refreshed BEFORE this one.
--
-- Key principle: Pre-aggregated for fast session list/activity queries.
-- ============================================================================
-- Step 1: Drop all indexes on mv_session_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_session_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_session_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_session_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_session_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_session_facts AS
WITH
-- Get audit counts per session
audit_counts AS (
    SELECT
        a.session_id,
        COUNT(*)::int AS audits_count,
        COUNT(*) FILTER (WHERE a.error = TRUE)::int AS error_count,
        MAX(a.created_at) AS last_audit_at
    FROM audits_entry a
    WHERE a.session_id IS NOT NULL
    GROUP BY a.session_id
),
-- Get group pricing aggregates per session from mv_group_pricing_facts
session_group_stats AS (
    SELECT
        gpf.session_id,
        COUNT(*)::int AS groups_count,
        SUM(gpf.run_count)::bigint AS total_runs,
        SUM(gpf.total_tokens)::bigint AS total_tokens,
        SUM(gpf.total_cost)::numeric AS total_cost,
        MIN(gpf.first_run_at) AS first_group_at,
        MAX(gpf.last_run_at) AS last_group_at
    FROM mv_group_pricing_facts gpf
    WHERE gpf.session_id IS NOT NULL
    GROUP BY gpf.session_id
)
SELECT
    -- Primary key
    s.id AS session_id,

    -- Profile ID
    s.profile_id,

    -- Timestamps
    s.created_at AS session_created_at,
    GREATEST(
        COALESCE(ac.last_audit_at, s.created_at),
        COALESCE(sgs.last_group_at, s.created_at)
    ) AS last_activity_at,

    -- Flags
    s.active AS is_active,

    -- Audit metrics
    COALESCE(ac.audits_count, 0) AS audits_count,
    COALESCE(ac.error_count, 0) AS error_count,

    -- Group metrics (from pricing MV)
    COALESCE(sgs.groups_count, 0) AS groups_count,
    COALESCE(sgs.total_runs, 0) AS runs_count,

    -- Token and cost metrics
    COALESCE(sgs.total_tokens, 0) AS total_tokens,
    COALESCE(sgs.total_cost, 0) AS total_cost,

    -- Group timing
    sgs.first_group_at,
    sgs.last_group_at,

    -- Session duration (in seconds)
    CASE
        WHEN sgs.last_group_at IS NOT NULL AND sgs.first_group_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (sgs.last_group_at - sgs.first_group_at))::bigint
        ELSE 0
    END AS session_duration_seconds

FROM sessions_entry s
LEFT JOIN audit_counts ac ON ac.session_id = s.id
LEFT JOIN session_group_stats sgs ON sgs.session_id = s.id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_session_facts_pk
    ON mv_session_facts (session_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Profile ID index for filtering
CREATE INDEX mv_session_facts_profile_id_idx
    ON mv_session_facts (profile_id);

-- Timestamp indexes
CREATE INDEX mv_session_facts_session_created_at_idx
    ON mv_session_facts (session_created_at);

CREATE INDEX mv_session_facts_session_created_at_desc_idx
    ON mv_session_facts (session_created_at DESC);

CREATE INDEX mv_session_facts_last_activity_at_idx
    ON mv_session_facts (last_activity_at);

CREATE INDEX mv_session_facts_last_activity_at_desc_idx
    ON mv_session_facts (last_activity_at DESC);

-- Active status index
CREATE INDEX mv_session_facts_is_active_idx
    ON mv_session_facts (is_active)
    WHERE is_active = TRUE;

-- Count indexes for sorting
CREATE INDEX mv_session_facts_groups_count_idx
    ON mv_session_facts (groups_count DESC)
    WHERE groups_count > 0;

CREATE INDEX mv_session_facts_audits_count_idx
    ON mv_session_facts (audits_count DESC)
    WHERE audits_count > 0;

CREATE INDEX mv_session_facts_runs_count_idx
    ON mv_session_facts (runs_count DESC)
    WHERE runs_count > 0;

-- Cost index for sorting
CREATE INDEX mv_session_facts_total_cost_idx
    ON mv_session_facts (total_cost DESC)
    WHERE total_cost > 0;

-- Error index
CREATE INDEX mv_session_facts_error_count_idx
    ON mv_session_facts (error_count DESC)
    WHERE error_count > 0;

-- Composite indexes for common query patterns
CREATE INDEX mv_session_facts_profile_last_activity_idx
    ON mv_session_facts (profile_id, last_activity_at DESC);

CREATE INDEX mv_session_facts_profile_created_at_idx
    ON mv_session_facts (profile_id, session_created_at DESC);

CREATE INDEX mv_session_facts_active_last_activity_idx
    ON mv_session_facts (last_activity_at DESC)
    WHERE is_active = TRUE;

-- Duration index for session analysis
CREATE INDEX mv_session_facts_duration_idx
    ON mv_session_facts (session_duration_seconds DESC)
    WHERE session_duration_seconds > 0;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_session_facts;
