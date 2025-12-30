-- Bulk update profile with role validation and request limit update in single function
-- Converted to PostgreSQL function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_bulk_update_staff_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_bulk_update_staff_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_bulk_update_staff_v3(
    profile_id uuid,  -- current user's profile_id (required, comes first)
    profile_ids uuid[],
    role text DEFAULT NULL,  -- NULL to skip
    active boolean DEFAULT NULL,  -- NULL to skip
    requests_per_day integer DEFAULT NULL,  -- NULL to skip, -1 for unlimited
    primary_department_id uuid DEFAULT NULL  -- NULL to skip
)
RETURNS TABLE (
    updated_count integer,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        profile_ids AS profile_ids,
        role AS role,
        active AS active,
        requests_per_day AS requests_per_day,
        primary_department_id AS primary_department_id,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
role_param AS (
    -- Use role to help PostgreSQL infer type (even if NULL)
    SELECT role AS role_value FROM params
),
current_user_role AS (
    -- Get current user's role for validation
    SELECT p.role FROM params x JOIN profiles p ON p.id = x.profile_id
),
profile_validation AS (
    -- Validate each profile and check permissions
    SELECT 
        p.id,
        p.role as current_role,
        cur.role as validator_role,
        rp.role_value,
        -- Check if role assignment is allowed (hierarchy check)
        CASE 
            WHEN rp.role_value IS NULL THEN true  -- Not updating role
            WHEN cur.role = 'superadmin'::profile_role THEN true
            WHEN cur.role = 'admin'::profile_role AND rp.role_value::profile_role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'instructional'::profile_role AND rp.role_value::profile_role IN ('member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'member'::profile_role AND rp.role_value::profile_role = 'guest'::profile_role THEN true
            ELSE false
        END as can_assign_role,
        -- Check if role level is acceptable (cannot assign equal or higher role)
        CASE 
            WHEN rp.role_value IS NULL THEN true  -- Not updating role
            WHEN cur.role = 'superadmin'::profile_role THEN true  -- Superadmin can assign any role
            WHEN p.id = (SELECT profile_id FROM params) THEN true  -- Can update own role
            WHEN cur.role = 'superadmin'::profile_role THEN true
            WHEN cur.role = 'admin'::profile_role AND rp.role_value::profile_role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'instructional'::profile_role AND rp.role_value::profile_role IN ('member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'member'::profile_role AND rp.role_value::profile_role = 'guest'::profile_role THEN true
            ELSE false
        END as role_level_ok,
        -- All profiles can be edited based on role hierarchy
        true as can_edit_default
    FROM params pr
    CROSS JOIN unnest(pr.profile_ids) as profile_id_val
    CROSS JOIN current_user_role cur
    CROSS JOIN role_param rp
    JOIN profiles p ON p.id = profile_id_val
),
validated_profiles AS (
    -- Filter to only profiles that pass validation
    SELECT id
    FROM profile_validation
    WHERE can_assign_role = true AND role_level_ok = true AND can_edit_default = true
),
profile_update AS (
    -- Update profiles table with dynamic SET clauses
    UPDATE profiles p
    SET 
        role = COALESCE((SELECT CAST(rp.role_value AS profile_role) FROM role_param rp WHERE rp.role_value IS NOT NULL LIMIT 1), p.role),
        active = COALESCE((SELECT active FROM params), p.active),
        updated_at = NOW()
    WHERE p.id IN (SELECT id FROM validated_profiles)
    RETURNING p.id
),
request_limit_update AS (
    -- Update request limits if provided (skip if NULL)
    INSERT INTO profile_request_limits (profile_id, requests_per_day, active)
    SELECT 
        pu.id,
        CASE WHEN (SELECT requests_per_day FROM params) = -1 THEN NULL ELSE (SELECT requests_per_day FROM params) END,  -- -1 means unlimited (NULL)
        true
    FROM profile_update pu
    WHERE (SELECT requests_per_day FROM params) IS NOT NULL  -- Only update if value provided (not skipping)
    ON CONFLICT (profile_id, active) 
    WHERE active = true
    DO UPDATE SET 
        requests_per_day = EXCLUDED.requests_per_day,
        updated_at = NOW()
),
department_update AS (
    -- Update primary department if provided (skip if NULL)
    UPDATE profile_departments
    SET 
        department_id = (SELECT primary_department_id FROM params),
        updated_at = NOW()
    WHERE profile_id IN (SELECT id FROM profile_update)
        AND (SELECT primary_department_id FROM params) IS NOT NULL  -- Only update if value provided (not skipping)
    RETURNING profile_id
)
SELECT 
    COUNT(*)::integer as updated_count,
    up.actor_name::text as actor_name
FROM profile_update pu
CROSS JOIN user_profile up
GROUP BY up.actor_name
$$;

COMMIT;
