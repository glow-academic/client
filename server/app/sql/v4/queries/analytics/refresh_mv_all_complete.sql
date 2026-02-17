-- Refresh All Materialized Views - API Endpoint
-- Refreshes ALL MVs in the system.
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
        WHERE proname = 'api_refresh_all_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_refresh_all_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Create refresh function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_refresh_all_v4(profile_id uuid)
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
    -- All MVs are independent — no ordering required

    -- Lean MVs (session/group pages)
    REFRESH MATERIALIZED VIEW CONCURRENTLY sessions_mv;
    refreshed := array_append(refreshed, 'sessions_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY groups_mv;
    refreshed := array_append(refreshed, 'groups_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY audits_mv;
    refreshed := array_append(refreshed, 'audits_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY runs_mv;
    refreshed := array_append(refreshed, 'runs_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY messages_mv;
    refreshed := array_append(refreshed, 'messages_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY calls_mv;
    refreshed := array_append(refreshed, 'calls_mv');

    -- Attempt MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY attempt_chats_mv;
    refreshed := array_append(refreshed, 'attempt_chats_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY attempt_mv;
    refreshed := array_append(refreshed, 'attempt_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY attempt_messages_mv;
    refreshed := array_append(refreshed, 'attempt_messages_mv');

    -- Benchmark MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY benchmark_mv;
    refreshed := array_append(refreshed, 'benchmark_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY suite_mv;
    refreshed := array_append(refreshed, 'suite_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY test_invocations_mv;
    refreshed := array_append(refreshed, 'test_invocations_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY test_mv;
    refreshed := array_append(refreshed, 'test_mv');

    -- Training MVs (home, practice, and training bundle-level)
    REFRESH MATERIALIZED VIEW CONCURRENTLY home_mv;
    refreshed := array_append(refreshed, 'home_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY practice_mv;
    refreshed := array_append(refreshed, 'practice_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY training_mv;
    refreshed := array_append(refreshed, 'training_mv');

    -- Lean Activity MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY problems_mv;
    refreshed := array_append(refreshed, 'problems_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY logins_mv;
    refreshed := array_append(refreshed, 'logins_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY activity_mv;
    refreshed := array_append(refreshed, 'activity_mv');

    -- Lean Health MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY health_mv;
    refreshed := array_append(refreshed, 'health_mv');

    REFRESH MATERIALIZED VIEW CONCURRENTLY metrics_mv;
    refreshed := array_append(refreshed, 'metrics_mv');

    -- Config MV
    REFRESH MATERIALIZED VIEW CONCURRENTLY config_mv;
    refreshed := array_append(refreshed, 'config_mv');

    -- Get actor_name from profile_artifact using profile_names_junction junction table
    SELECT COALESCE(
        (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = api_refresh_all_v4.profile_id LIMIT 1),
        'System'
    ) INTO actor_name_val
    FROM profile_artifact
    WHERE id = api_refresh_all_v4.profile_id;

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
            format('Failed to refresh MVs: %s (completed: %s)', SQLERRM, array_to_string(refreshed, ', '))::text as message,
            'error'::text as status,
            refreshed as refreshed_views;
END $$;
