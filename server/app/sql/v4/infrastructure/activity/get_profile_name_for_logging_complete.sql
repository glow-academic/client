-- Get profile name for logging purposes
-- Returns actor_name for activity logging
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_activity_get_profile_name_for_logging_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_activity_get_profile_name_for_logging_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_activity_get_profile_name_for_logging_v4(
    profile_id uuid
)
RETURNS TABLE (
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id 
         WHERE pn.profile_id = $1 AND pn.type = 'full' LIMIT 1),
        (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 
         JOIN names_resource n1 ON pn1.name_id = n1.id 
         JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id 
         JOIN names_resource n2 ON pn2.name_id = n2.id 
         WHERE pn1.profile_id = $1 AND pn1.type = 'first' AND pn2.type = 'last' LIMIT 1),
        ''
    ) as actor_name
$$;
