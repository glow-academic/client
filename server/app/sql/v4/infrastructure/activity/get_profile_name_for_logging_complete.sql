-- Get profile name for logging purposes
-- Returns actor_name for activity_entry logging
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
         WHERE pn.profile_id = $1 LIMIT 1),
        ''
    ) as actor_name
$$;
