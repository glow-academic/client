-- Update a key
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
        (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
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
-- Insert/update name in names table
name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    FROM params
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert/update description in descriptions table
description_resource AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
update_key AS (
    -- UPDATE keys_resource (without name/description/active columns)
    UPDATE keys_resource
    SET 
        key = x.key,
        updated_at = NOW()
    FROM params x
    WHERE keys_resource.id = x.key_id
    RETURNING keys_resource.id as key_id, keys_resource.key, (SELECT name FROM params) as key_name
),
-- Remove old name links
remove_old_name AS (
    DELETE FROM key_names
    WHERE key_id = (SELECT key_id FROM params)
      AND name_id NOT IN (SELECT name_id FROM name_resource)
),
-- Link key to new name
link_key_name AS (
    INSERT INTO key_names (key_id, name_id, created_at, updated_at)
    SELECT 
        uk.key_id,
        nr.name_id,
        NOW(),
        NOW()
    FROM update_key uk
    CROSS JOIN name_resource nr
    ON CONFLICT (key_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Remove old description links
remove_old_description AS (
    DELETE FROM key_descriptions
    WHERE key_id = (SELECT key_id FROM params)
      AND description_id NOT IN (SELECT description_id FROM description_resource)
),
-- Link key to new description
link_key_description AS (
    INSERT INTO key_descriptions (key_id, description_id, created_at, updated_at)
    SELECT 
        uk.key_id,
        dr.description_id,
        NOW(),
        NOW()
    FROM update_key uk
    CROSS JOIN description_resource dr
    ON CONFLICT (key_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- UPDATE keys active flag
update_key_active_flag AS (
    UPDATE key_flags SET
        value = (SELECT active FROM params),
        updated_at = NOW()
    WHERE key_id = (SELECT key_id FROM params)
      AND type = 'active'::type_key_flags
),
insert_key_active_flag AS (
    INSERT INTO key_flags (key_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        uk.key_id,
        f.id,
        'active'::type_key_flags,
        x.active,
        NOW(),
        NOW()
    FROM update_key uk
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
      AND NOT EXISTS (SELECT 1 FROM key_flags kf WHERE kf.key_id = uk.key_id AND kf.type = 'active'::type_key_flags)
    ON CONFLICT (key_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
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