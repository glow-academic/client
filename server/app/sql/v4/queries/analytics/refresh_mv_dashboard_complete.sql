-- Refresh Dashboard Materialized Views - API Endpoint
-- Refreshes all dashboard MVs in dependency order:
-- Layer 1 (Base):
--   1. mv_general_analytics (base)
--   2. mv_practice_analytics (base)
-- Layer 2:
--   3. mv_dashboard_facts (depends on general + practice)
-- Layer 3:
--   4. mv_dashboard_daily_agg (depends on facts)
--   5. mv_dashboard_persona_agg (depends on facts)
--   6. mv_dashboard_attempt_seq (depends on facts)
--   7. mv_dashboard_cohort_facts (depends on facts)
--   8. mv_persona_response_times (depends on facts)
--   9. mv_profile_analytics (depends on facts)
-- Independent:
--   10. mv_dashboard_rubric_facts (uses base tables directly)
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
    -- Step 1: Refresh base MVs (general + practice)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_general_analytics;
    refreshed := array_append(refreshed, 'mv_general_analytics');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_practice_analytics;
    refreshed := array_append(refreshed, 'mv_practice_analytics');

    -- Step 2: Refresh dashboard facts (depends on general + practice)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_facts;
    refreshed := array_append(refreshed, 'mv_dashboard_facts');

    -- Step 3: Refresh aggregation MVs (depend on facts)
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

    -- Step 4: Refresh rubric facts (independent, uses base tables directly)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_rubric_facts;
    refreshed := array_append(refreshed, 'mv_dashboard_rubric_facts');

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
