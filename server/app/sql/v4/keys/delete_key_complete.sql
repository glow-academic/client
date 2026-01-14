-- Delete a key
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_key_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_key_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function (no types to drop for delete)
CREATE OR REPLACE FUNCTION api_delete_key_v4(
    key_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    key_exists boolean,
    key_id uuid,
    name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT key_id AS key_id, profile_id AS profile_id
),
key_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM keys WHERE id = (SELECT key_id FROM params)
    )::boolean as key_exists
),
actor_profile AS (
    SELECT 
        p.id as profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
user_profile AS (
    SELECT role 
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
key_info AS (
    SELECT 
        k.id, 
        (SELECT n.name FROM key_names kn JOIN names_resource n ON kn.name_id = n.id WHERE kn.key_id = k.id LIMIT 1) as name
    FROM params x
    JOIN keys k ON k.id = x.key_id
),
department_keys_data AS (
    -- NOTE: department_keys table was removed in migration 74
    SELECT ARRAY[]::text[] as department_ids
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
check_permissions AS (
    SELECT 
        CASE 
            -- Default keys (no department_ids) can only be deleted by superadmin
            WHEN COALESCE(kdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role = 'superadmin'::profile_role THEN true
            WHEN up.role = 'admin'::profile_role THEN true
            ELSE false
        END as can_delete
    FROM user_profile up
    CROSS JOIN department_keys_data kdd
    GROUP BY up.role, kdd.department_ids
),
delete_key AS (
    DELETE FROM keys
    WHERE id = (SELECT key_id FROM params)
    AND EXISTS (SELECT 1 FROM check_permissions WHERE can_delete = true)
    RETURNING id
)
SELECT 
    kec.key_exists::boolean as key_exists,
    COALESCE(ki.id, (SELECT key_id FROM params))::uuid as key_id,
    COALESCE(ki.name, '')::text as name,
    ap.actor_name::text as actor_name
FROM key_exists_check kec
CROSS JOIN actor_profile ap
LEFT JOIN key_info ki ON true
LEFT JOIN delete_key dk ON dk.id = ki.id
WHERE kec.key_exists = true
$$;