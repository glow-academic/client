-- Save tool (skeleton - create/update)
-- Converted to function with composite types
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_save_tool_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_tool_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_save_tool_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types (skeleton)
-- Note: This is a minimal skeleton - actual implementation will need proper tool table structure

-- 4) Recreate function (skeleton - returns placeholder)
CREATE OR REPLACE FUNCTION api_save_tool_v4(
    input_tool_id uuid,
    name text,
    description text,
    profile_id uuid
)
RETURNS TABLE (
    actor_name text,
    tool_id uuid
)
LANGUAGE sql
AS $$
WITH params AS (
    SELECT input_tool_id AS input_tool_id, name AS name, description AS description, profile_id AS profile_id
),
user_profile AS (
    SELECT 
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) AND pn.type = 'full'::type_profile_names LIMIT 1),
            (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = (SELECT profile_id FROM params) AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile ON profile.id = x.profile_id
)
SELECT 
    up.actor_name::text as actor_name,
    COALESCE((SELECT input_tool_id FROM params), uuidv7()) as tool_id
FROM user_profile up
$$;
