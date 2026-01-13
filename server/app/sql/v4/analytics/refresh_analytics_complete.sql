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
    
    -- Get actor_name from profile using profile_names junction table
    SELECT COALESCE(
        (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = api_refresh_analytics_v4.profile_id AND pn.type = 'full'::type_profile_names LIMIT 1),
        (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = api_refresh_analytics_v4.profile_id AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
        'System'
    ) INTO actor_name_val
    FROM profile
    WHERE id = api_refresh_analytics_v4.profile_id;
    
    -- Return response
    RETURN QUERY SELECT
        COALESCE(actor_name_val, 'System')::text as actor_name,
        true::boolean as success,
        'Analytics materialized view refreshed successfully'::text as message,
        'success'::text as status;
END $$;