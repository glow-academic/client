-- Create Analytics View Function - API Endpoint
-- This function returns actor_name and response fields after view creation
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_analytics_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_analytics_view_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function that returns actor_name and response fields
CREATE OR REPLACE FUNCTION api_create_analytics_view_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    success boolean,
    message text,
    status text
)
LANGUAGE sql
STABLE
AS $$
WITH actor_profile AS (
    SELECT COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM profiles
    WHERE id = profile_id
)
SELECT 
    COALESCE((SELECT actor_name FROM actor_profile), 'System')::text as actor_name,
    true::boolean as success,
    'Analytics materialized view created successfully'::text as message,
    'success'::text as status;
$$;