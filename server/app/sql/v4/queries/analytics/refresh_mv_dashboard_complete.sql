-- Refresh Dashboard Materialized Views - API Endpoint
-- Refreshes all dashboard-related analytics MVs.
-- All MVs are independent — no dependency ordering required.
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- ============================================================================
-- Step 1: Drop function if exists
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_refresh_dashboard_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_refresh_dashboard_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Create refresh function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_refresh_dashboard_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    success boolean,
    message text,
    status text,
    refreshed_views text[]
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    actor_name_val text;
    refreshed text[] := ARRAY[]::text[];
BEGIN
    -- Refresh analytics MVs (all independent, no ordering required)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_chat_facts;
    refreshed := array_append(refreshed, 'mv_chat_facts');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attempt_facts;
    refreshed := array_append(refreshed, 'mv_attempt_facts');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_metrics;
    refreshed := array_append(refreshed, 'mv_daily_metrics');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_profile_metrics;
    refreshed := array_append(refreshed, 'mv_profile_metrics');

    -- Get actor_name from profile_artifact using profile_names_junction junction table
    SELECT COALESCE(
        (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = api_refresh_dashboard_v4.profile_id LIMIT 1),
        'System'
    ) INTO actor_name_val
    FROM profile_artifact
    WHERE id = api_refresh_dashboard_v4.profile_id;

    -- Return success response
    RETURN QUERY SELECT
        COALESCE(actor_name_val, 'System')::text as actor_name,
        true::boolean as success,
        format('Refreshed %s dashboard materialized views', array_length(refreshed, 1))::text as message,
        'success'::text as status,
        refreshed as refreshed_views;
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            'System'::text as actor_name,
            false::boolean as success,
            format('Failed to refresh dashboard MVs: %s (completed: %s)', SQLERRM, array_to_string(refreshed, ', '))::text as message,
            'error'::text as status,
            refreshed as refreshed_views;
END $$;
