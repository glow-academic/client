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
    SELECT COALESCE(
        (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = api_create_analytics_view_v4.profile_id AND pn.type = 'full'::type_profile_names LIMIT 1),
        (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = api_create_analytics_view_v4.profile_id AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
        'System'
    ) as actor_name
    FROM profile
    WHERE id = api_create_analytics_view_v4.profile_id
)
SELECT 
    COALESCE((SELECT actor_name FROM actor_profile), 'System')::text as actor_name,
    true::boolean as success,
    'Analytics materialized view created successfully'::text as message,
    'success'::text as status;
$$;