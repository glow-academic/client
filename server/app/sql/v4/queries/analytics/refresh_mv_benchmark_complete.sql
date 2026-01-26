-- Refresh Benchmark Analytics MV - API Endpoint
-- Refreshes the mv_benchmark_analytics materialized view.
-- This is a single-MV refresh function for benchmark analytics.
--
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
        WHERE proname = 'api_refresh_benchmark_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_refresh_benchmark_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Create refresh function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_refresh_benchmark_v4(profile_id uuid)
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
    -- Refresh benchmark analytics MV
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_benchmark_analytics;
    refreshed := array_append(refreshed, 'mv_benchmark_analytics');

    -- Get actor_name from profile_artifact using profile_names_junction junction table
    SELECT COALESCE(
        (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = api_refresh_benchmark_v4.profile_id LIMIT 1),
        'System'
    ) INTO actor_name_val
    FROM profile_artifact
    WHERE id = api_refresh_benchmark_v4.profile_id;

    -- Return success response
    RETURN QUERY SELECT
        COALESCE(actor_name_val, 'System')::text as actor_name,
        true::boolean as success,
        format('Refreshed %s materialized views', array_length(refreshed, 1))::text as message,
        'success'::text as status,
        refreshed as refreshed_views;
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            'System'::text as actor_name,
            false::boolean as success,
            format('Failed to refresh mv_benchmark_analytics: %s', SQLERRM)::text as message,
            'error'::text as status,
            refreshed as refreshed_views;
END $$;
