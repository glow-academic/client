-- ============================================================================
-- Query: get_activity_summary_view
-- Purpose: Fetch summary data from mv_activity_summary
-- Section: VIEWS/ACTIVITY/SUMMARY
-- ============================================================================

-- ============================================================================
-- Step 1: Drop existing function
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_activity_summary_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_activity_summary_view_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop existing composite types
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_activity_summary_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_activity_summary_view_v4_item AS (
    total_sessions bigint,
    active_sessions bigint,
    total_active_profiles bigint,
    total_logins bigint,
    total_content_created bigint,
    total_drafts bigint,
    total_problems bigint,
    unresolved_problems bigint,
    sessions_last_24h bigint,
    logins_last_24h bigint,
    events_last_24h bigint,
    sessions_last_7d bigint,
    logins_last_7d bigint,
    active_profiles_last_7d bigint,
    refreshed_at timestamptz
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_activity_summary_view_v4()
RETURNS TABLE (
    items types.q_get_activity_summary_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    mv_data AS (
        SELECT mv.*
        FROM mv_activity_summary mv
        LIMIT 1
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    mv.total_sessions,
                    mv.active_sessions,
                    mv.total_active_profiles,
                    mv.total_logins,
                    mv.total_content_created,
                    mv.total_drafts,
                    mv.total_problems,
                    mv.unresolved_problems,
                    mv.sessions_last_24h,
                    mv.logins_last_24h,
                    mv.events_last_24h,
                    mv.sessions_last_7d,
                    mv.logins_last_7d,
                    mv.active_profiles_last_7d,
                    mv.refreshed_at
                )::types.q_get_activity_summary_view_v4_item
            ),
            ARRAY[]::types.q_get_activity_summary_view_v4_item[]
        ) AS items
        FROM mv_data mv
    )
    SELECT items FROM items_agg;
$$;
