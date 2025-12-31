-- Update a key
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_update_key_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_key_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function (no types to drop for update)
CREATE OR REPLACE FUNCTION api_update_key_v4(
    key_id uuid,
    name text,
    key text,
    description text,
    active boolean,
    profile_id uuid,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    key_id uuid,
    key_masked text,
    key_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        key_id AS key_id,
        name AS name,
        key AS key,
        COALESCE(NULLIF(description, ''), '') AS description,
        active AS active,
        profile_id AS profile_id,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids
),
user_profile AS (
    SELECT
        p.role,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
object_current_departments AS (
    -- NOTE: department_keys table was removed in migration 74
    -- Keys are now linked to departments through settings
    -- Use department_ids from params to help PostgreSQL infer type
    SELECT x.department_ids::text[] as department_ids
    FROM params x
),
user_departments AS (
    -- Get user's departments
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
validate_update_permissions AS (
    -- Validate department permissions for update operation
    SELECT validate_department_update_permissions(
        up.role::text,
        ocd.department_ids,
        ud.department_ids
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN object_current_departments ocd
    CROSS JOIN user_departments ud
),
actor_profile AS (
    SELECT
        x.profile_id as profile_id,
        up.actor_name
    FROM params x
    CROSS JOIN user_profile up
),
update_key AS (
    UPDATE keys
    SET 
        name = x.name,
        key = x.key,
        description = x.description,
        active = x.active,
        updated_at = NOW()
    FROM params x
    WHERE keys.id = x.key_id
    RETURNING keys.id as key_id, keys.key, keys.name as key_name
),
replace_departments AS (
    -- NOTE: department_keys table was removed in migration 74
    SELECT 1 WHERE false
),
link_departments AS (
    -- NOTE: department_keys table was removed in migration 74
    -- Keys are now linked to departments through settings
    SELECT 1 WHERE false
)
SELECT 
    uk.key_id::uuid as key_id,
    CASE 
        WHEN LENGTH(uk.key) > 4 THEN LEFT(uk.key, 4) || '****'
        ELSE '****'
    END::text as key_masked,
    uk.key_name::text as key_name,
    ap.actor_name::text as actor_name
FROM update_key uk
CROSS JOIN actor_profile ap
$$;

COMMIT;

