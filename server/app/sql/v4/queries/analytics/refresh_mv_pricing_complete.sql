-- Refresh Pricing Materialized Views - API Endpoint
-- Refreshes all pricing MVs in dependency order:
-- Layer 1 (Base):
--   1. mv_model_pricing_ppm (base, rarely changes)
--   2. mv_run_pricing_facts (base)
-- Layer 2:
--   3. mv_group_pricing_facts (depends on mv_run_pricing_facts)
-- Layer 3:
--   4. mv_run_costs_daily (depends on mv_run_pricing_facts)
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
        WHERE proname = 'api_refresh_pricing_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_refresh_pricing_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Create refresh function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_refresh_pricing_v4(profile_id uuid)
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
    -- Step 1: Refresh base MVs (Layer 1)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_model_pricing_ppm;
    refreshed := array_append(refreshed, 'mv_model_pricing_ppm');

    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_run_pricing_facts;
    refreshed := array_append(refreshed, 'mv_run_pricing_facts');

    -- Step 2: Refresh Layer 2 MVs (depend on mv_run_pricing_facts)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_group_pricing_facts;
    refreshed := array_append(refreshed, 'mv_group_pricing_facts');

    -- Step 3: Refresh Layer 3 MVs
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_run_costs_daily;
    refreshed := array_append(refreshed, 'mv_run_costs_daily');

    -- Get actor_name from profile_artifact using profile_names_junction junction table
    SELECT COALESCE(
        (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = api_refresh_pricing_v4.profile_id LIMIT 1),
        'System'
    ) INTO actor_name_val
    FROM profile_artifact
    WHERE id = api_refresh_pricing_v4.profile_id;

    -- Return success response
    RETURN QUERY SELECT
        COALESCE(actor_name_val, 'System')::text as actor_name,
        true::boolean as success,
        format('Refreshed %s pricing materialized views', array_length(refreshed, 1))::text as message,
        'success'::text as status,
        refreshed as refreshed_views;
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            'System'::text as actor_name,
            false::boolean as success,
            format('Failed to refresh pricing MVs: %s (completed: %s)', SQLERRM, array_to_string(refreshed, ', '))::text as message,
            'error'::text as status,
            refreshed as refreshed_views;
END $$;
