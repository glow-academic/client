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
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sessions;
    refreshed := array_append(refreshed, 'mv_sessions');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_groups;
    refreshed := array_append(refreshed, 'mv_groups');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_audits;
    refreshed := array_append(refreshed, 'mv_audits');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_runs;
    refreshed := array_append(refreshed, 'mv_runs');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_messages;
    refreshed := array_append(refreshed, 'mv_messages');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_calls;
    refreshed := array_append(refreshed, 'mv_calls');

    -- Attempt MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_chats;
    refreshed := array_append(refreshed, 'mv_chats');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attempt_list;
    refreshed := array_append(refreshed, 'mv_attempt_list');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attempt_messages;
    refreshed := array_append(refreshed, 'mv_attempt_messages');

    -- Benchmark MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_benchmark;
    refreshed := array_append(refreshed, 'mv_benchmark');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_suite;
    refreshed := array_append(refreshed, 'mv_suite');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_test_invocations;
    refreshed := array_append(refreshed, 'mv_test_invocations');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_test;
    refreshed := array_append(refreshed, 'mv_test');

    -- Training MVs (home, practice, and training bundle-level)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_home;
    refreshed := array_append(refreshed, 'mv_home');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_practice;
    refreshed := array_append(refreshed, 'mv_practice');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_training;
    refreshed := array_append(refreshed, 'mv_training');

    -- Lean Activity MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_problems;
    refreshed := array_append(refreshed, 'mv_problems');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_logins;
    refreshed := array_append(refreshed, 'mv_logins');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_activity;
    refreshed := array_append(refreshed, 'mv_activity');

    -- Lean Health MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_health;
    refreshed := array_append(refreshed, 'mv_health');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_metrics;
    refreshed := array_append(refreshed, 'mv_metrics');

    -- Config MV
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_config;
    refreshed := array_append(refreshed, 'mv_config');

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
