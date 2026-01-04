-- Refresh Analytics Materialized View - API Endpoint
-- Converted to function following agents pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_refresh_analytics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_refresh_analytics_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function that refreshes the materialized view and returns actor_name and response
CREATE OR REPLACE FUNCTION api_refresh_analytics_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    success boolean,
    message text,
    status text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    actor_name_val text;
BEGIN
    -- Refresh the materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics;
    
    -- Get actor_name from profile
    SELECT COALESCE(first_name || ' ' || last_name, 'System') INTO actor_name_val
    FROM profiles
    WHERE id = profile_id;
    
    -- Return response
    RETURN QUERY SELECT
        COALESCE(actor_name_val, 'System')::text as actor_name,
        true::boolean as success,
        'Analytics materialized view refreshed successfully'::text as message,
        'success'::text as status;
END $$;