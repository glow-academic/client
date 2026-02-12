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

    -- Analytics MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_chat_facts;
    refreshed := array_append(refreshed, 'mv_chat_facts');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attempt_facts;
    refreshed := array_append(refreshed, 'mv_attempt_facts');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_metrics;
    refreshed := array_append(refreshed, 'mv_daily_metrics');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_profile_metrics;
    refreshed := array_append(refreshed, 'mv_profile_metrics');

    -- Pricing MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pricing_run_facts;
    refreshed := array_append(refreshed, 'mv_pricing_run_facts');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pricing_group_summary;
    refreshed := array_append(refreshed, 'mv_pricing_group_summary');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pricing_daily;
    refreshed := array_append(refreshed, 'mv_pricing_daily');

    -- Artifact MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_artifact_session_list;
    refreshed := array_append(refreshed, 'mv_artifact_session_list');

    -- Attempt MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attempt_chats;
    refreshed := array_append(refreshed, 'mv_attempt_chats');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attempt_list;
    refreshed := array_append(refreshed, 'mv_attempt_list');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attempt_messages;
    refreshed := array_append(refreshed, 'mv_attempt_messages');

    -- Benchmark MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_benchmark_attempt_facts;
    refreshed := array_append(refreshed, 'mv_benchmark_attempt_facts');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_benchmark_bundle;
    refreshed := array_append(refreshed, 'mv_benchmark_bundle');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_benchmark_eval_summary;
    refreshed := array_append(refreshed, 'mv_benchmark_eval_summary');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_benchmark_invocations;
    refreshed := array_append(refreshed, 'mv_benchmark_invocations');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_benchmark_tests;
    refreshed := array_append(refreshed, 'mv_benchmark_tests');

    -- Health MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_health_metrics_hourly;
    refreshed := array_append(refreshed, 'mv_health_metrics_hourly');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_health_service_hourly;
    refreshed := array_append(refreshed, 'mv_health_service_hourly');

    -- Activity MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_activity_audits;
    refreshed := array_append(refreshed, 'mv_activity_audits');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_activity_daily;
    refreshed := array_append(refreshed, 'mv_activity_daily');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_activity_feedbacks;
    refreshed := array_append(refreshed, 'mv_activity_feedbacks');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_activity_logins;
    refreshed := array_append(refreshed, 'mv_activity_logins');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_activity_problems;
    refreshed := array_append(refreshed, 'mv_activity_problems');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_activity_session_facts;
    refreshed := array_append(refreshed, 'mv_activity_session_facts');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_activity_summary;
    refreshed := array_append(refreshed, 'mv_activity_summary');

    -- Training MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_training;
    refreshed := array_append(refreshed, 'mv_training');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_training_bundle;
    refreshed := array_append(refreshed, 'mv_training_bundle');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_training_context;
    refreshed := array_append(refreshed, 'mv_training_context');

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
