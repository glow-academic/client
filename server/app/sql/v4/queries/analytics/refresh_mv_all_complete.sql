-- Refresh All Materialized Views - API Endpoint
-- Refreshes ALL MVs in the system in correct dependency order.
-- This is the master refresh function for full system refreshes.
--
-- Dependency Graph:
-- Layer 1 (Base - Independent):
--   1. mv_general_analytics
--   2. mv_practice_analytics
--   3. mv_benchmark_analytics
--   4. mv_model_pricing_ppm
--   5. mv_run_pricing_facts
--   6. mv_call_facts
--   7. mv_health_hourly_agg
--   8. mv_metrics_hourly_agg
--
-- Layer 2:
--   9. mv_dashboard_facts (depends on general + practice)
--   10. mv_group_pricing_facts (depends on mv_run_pricing_facts)
--   11. mv_health_daily_agg (depends on mv_health_hourly_agg)
--   12. mv_metrics_daily_agg (depends on mv_metrics_hourly_agg)
--
-- Layer 3:
--   13. mv_dashboard_daily_agg (depends on facts)
--   14. mv_dashboard_persona_agg (depends on facts)
--   15. mv_dashboard_attempt_seq (depends on facts)
--   16. mv_dashboard_cohort_facts (depends on facts)
--   17. mv_persona_response_times (depends on facts)
--   18. mv_profile_analytics (depends on facts)
--   19. mv_run_costs_daily (depends on mv_run_pricing_facts)
--   20. mv_call_metrics_daily (depends on mv_call_facts)
--   21. mv_session_facts (depends on mv_group_pricing_facts)
--
-- Independent:
--   22. mv_dashboard_rubric_facts (uses base tables directly)
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
    -- ===========================================
    -- Layer 1: Base MVs (Independent)
    -- ===========================================

    -- Analytics base MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_general_analytics;
    refreshed := array_append(refreshed, 'mv_general_analytics');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_practice_analytics;
    refreshed := array_append(refreshed, 'mv_practice_analytics');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_benchmark_analytics;
    refreshed := array_append(refreshed, 'mv_benchmark_analytics');

    -- Pricing base MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_model_pricing_ppm;
    refreshed := array_append(refreshed, 'mv_model_pricing_ppm');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_run_pricing_facts;
    refreshed := array_append(refreshed, 'mv_run_pricing_facts');

    -- Calls base MV
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_call_facts;
    refreshed := array_append(refreshed, 'mv_call_facts');

    -- Health & Metrics base MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_health_hourly_agg;
    refreshed := array_append(refreshed, 'mv_health_hourly_agg');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_metrics_hourly_agg;
    refreshed := array_append(refreshed, 'mv_metrics_hourly_agg');

    -- ===========================================
    -- Layer 2: MVs dependent on Layer 1
    -- ===========================================

    -- Dashboard facts (depends on general + practice)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_facts;
    refreshed := array_append(refreshed, 'mv_dashboard_facts');

    -- Group pricing (depends on mv_run_pricing_facts)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_group_pricing_facts;
    refreshed := array_append(refreshed, 'mv_group_pricing_facts');

    -- Health & Metrics daily (depends on hourly)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_health_daily_agg;
    refreshed := array_append(refreshed, 'mv_health_daily_agg');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_metrics_daily_agg;
    refreshed := array_append(refreshed, 'mv_metrics_daily_agg');

    -- ===========================================
    -- Layer 3: MVs dependent on Layer 2
    -- ===========================================

    -- Dashboard aggregation MVs (depend on mv_dashboard_facts)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_daily_agg;
    refreshed := array_append(refreshed, 'mv_dashboard_daily_agg');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_persona_agg;
    refreshed := array_append(refreshed, 'mv_dashboard_persona_agg');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_attempt_seq;
    refreshed := array_append(refreshed, 'mv_dashboard_attempt_seq');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_cohort_facts;
    refreshed := array_append(refreshed, 'mv_dashboard_cohort_facts');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_persona_response_times;
    refreshed := array_append(refreshed, 'mv_persona_response_times');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_profile_analytics;
    refreshed := array_append(refreshed, 'mv_profile_analytics');

    -- Pricing daily (depends on mv_run_pricing_facts)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_run_costs_daily;
    refreshed := array_append(refreshed, 'mv_run_costs_daily');

    -- Calls daily (depends on mv_call_facts)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_call_metrics_daily;
    refreshed := array_append(refreshed, 'mv_call_metrics_daily');

    -- Session facts (depends on mv_group_pricing_facts)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_session_facts;
    refreshed := array_append(refreshed, 'mv_session_facts');

    -- ===========================================
    -- Independent: Uses base tables directly
    -- ===========================================

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_rubric_facts;
    refreshed := array_append(refreshed, 'mv_dashboard_rubric_facts');

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
