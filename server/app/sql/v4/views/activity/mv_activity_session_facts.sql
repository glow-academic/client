-- Materialized View: mv_activity_session_facts
-- Base fact table for ACTIVITY section - session list with profile info.
--
-- Grain: One row per session
-- Filter: None (all sessions)
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: ACTIVITY (overview, session list, session individual)
--
-- Pre-joins session data with profile info and aggregates group/run counts.
--
-- Dependencies: sessions_entry, groups_entry, profiles via naming junction
-- ============================================================================
-- Step 1: Drop all indexes on mv_activity_session_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_activity_session_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_activity_session_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_activity_session_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_activity_session_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_activity_session_facts AS
WITH
-- Aggregate groups per session
session_groups AS (
    SELECT
        g.session_id,
        COUNT(*)::int AS group_count,
        MIN(g.created_at) AS first_group_at,
        MAX(g.created_at) AS last_group_at
    FROM groups_entry g
    WHERE g.active = TRUE AND g.session_id IS NOT NULL
    GROUP BY g.session_id
),
-- Aggregate runs per session (via groups)
session_runs AS (
    SELECT
        g.session_id,
        COUNT(r.id)::int AS run_count,
        SUM(COALESCE(r.input_tokens, 0) + COALESCE(r.output_tokens, 0) + COALESCE(r.cached_input_tokens, 0))::bigint AS total_tokens
    FROM groups_entry g
    JOIN runs_entry r ON r.group_id = g.id
    WHERE g.active = TRUE AND g.session_id IS NOT NULL
    GROUP BY g.session_id
)
SELECT
    -- Primary key
    s.id AS session_id,

    -- Profile info
    s.profile_id,

    -- Timestamps
    s.created_at AS session_created_at,
    s.created_at AS session_updated_at,

    -- Status
    COALESCE(s.active, FALSE) AS active,

    -- Aggregated counts from groups
    COALESCE(sg.group_count, 0) AS group_count,
    sg.first_group_at,
    sg.last_group_at,

    -- Aggregated counts from runs
    COALESCE(sr.run_count, 0) AS run_count,
    COALESCE(sr.total_tokens, 0) AS total_tokens

FROM sessions_entry s
LEFT JOIN session_groups sg ON sg.session_id = s.id
LEFT JOIN session_runs sr ON sr.session_id = s.id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_activity_session_facts_pk
    ON mv_activity_session_facts (session_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Profile filtering
CREATE INDEX mv_activity_session_facts_profile_id_idx
    ON mv_activity_session_facts (profile_id)
    WHERE profile_id IS NOT NULL;

-- Timestamp indexes
CREATE INDEX mv_activity_session_facts_created_at_idx
    ON mv_activity_session_facts (session_created_at);

CREATE INDEX mv_activity_session_facts_created_at_desc_idx
    ON mv_activity_session_facts (session_created_at DESC);

-- Active status filtering
CREATE INDEX mv_activity_session_facts_active_idx
    ON mv_activity_session_facts (active);

-- Composite: profile + created for user session history
CREATE INDEX mv_activity_session_facts_profile_created_idx
    ON mv_activity_session_facts (profile_id, session_created_at DESC)
    WHERE profile_id IS NOT NULL;

-- Composite: active + created for active session list
CREATE INDEX mv_activity_session_facts_active_created_idx
    ON mv_activity_session_facts (session_created_at DESC)
    WHERE active = TRUE;

-- Count-based sorting
CREATE INDEX mv_activity_session_facts_group_count_idx
    ON mv_activity_session_facts (group_count DESC);

CREATE INDEX mv_activity_session_facts_run_count_idx
    ON mv_activity_session_facts (run_count DESC);

CREATE INDEX mv_activity_session_facts_total_tokens_idx
    ON mv_activity_session_facts (total_tokens DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_activity_session_facts;
