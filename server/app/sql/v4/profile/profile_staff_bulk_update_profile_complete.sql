-- Bulk UPDATE profile_artifact with role validation and request limit update in single function
-- Converted to PostgreSQL function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_bulk_update_staff_v4(uuid[], text, boolean, integer, uuid, uuid);

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_bulk_update_staff_v4(
    profile_ids uuid[],
    role text,
    active boolean,
    requests_per_day integer,  -- NULL to skip, -1 for unlimited
    primary_department_id uuid,
    profile_id uuid  -- current user's profile_id
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
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' ||
            (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
role_param AS (
    -- Use role to help PostgreSQL infer type (even if NULL)
    SELECT role AS role_value FROM params
),
current_user_role AS (
    -- Get current user's role for validation
    SELECT (SELECT r.role FROM profile_roles pr_j 
            JOIN roles_resource r ON pr_j.role_id = r.id 
            WHERE pr_j.profile_id = p.id 
            LIMIT 1) as role 
    FROM params x JOIN profile_artifact p ON p.id = x.profile_id
),
profile_validation AS (
    -- Validate each profile and check permissions
    SELECT 
        p.id,
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as current_role,
        cur.role as validator_role,
        rp.role_value,
        -- Check if role assignment is allowed (hierarchy check)
        CASE 
            WHEN rp.role_value IS NULL THEN true  -- Not updating role
            WHEN cur.role = 'superadmin' THEN true
            WHEN cur.role = 'admin' AND rp.role_value IN ('instructional', 'member', 'guest') THEN true
            WHEN cur.role = 'instructional' AND rp.role_value IN ('member', 'guest') THEN true
            WHEN cur.role = 'member' AND rp.role_value = 'guest' THEN true
            ELSE false
        END as can_assign_role,
        -- Check if role level is acceptable (cannot assign equal or higher role)
        CASE 
            WHEN rp.role_value IS NULL THEN true  -- Not updating role
            WHEN cur.role = 'superadmin' THEN true  -- Superadmin can assign any role
            WHEN p.id = (SELECT profile_id FROM params) THEN true  -- Can update own role
            WHEN cur.role = 'superadmin' THEN true
            WHEN cur.role = 'admin' AND rp.role_value IN ('instructional', 'member', 'guest') THEN true
            WHEN cur.role = 'instructional' AND rp.role_value IN ('member', 'guest') THEN true
            WHEN cur.role = 'member' AND rp.role_value = 'guest' THEN true
            ELSE false
        END as role_level_ok,
        -- All profiles can be edited based on role hierarchy
        true as can_edit_default
    FROM params pr
    CROSS JOIN unnest(pr.profile_ids) as profile_id_val
    CROSS JOIN current_user_role cur
    CROSS JOIN role_param rp
    JOIN profile_artifact p ON p.id = profile_id_val
),
validated_profiles AS (
    -- Filter to only profiles that pass validation
    SELECT id
    FROM profile_validation
    WHERE can_assign_role = true AND role_level_ok = true AND can_edit_default = true
),
-- Get or create role resources for new roles
role_resources AS (
    INSERT INTO roles_resource (role, created_at, updated_at, active, generated, mcp, call_id)
    SELECT 
        CAST(rp.role_value AS profile_role),
        NOW(),
        NOW(),
        true,
        false,
        false,
        NULL
    FROM role_param rp
    WHERE rp.role_value IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM roles_resource r 
          WHERE r.role = CAST(rp.role_value AS profile_role)
      )
    ON CONFLICT (role) DO NOTHING
    RETURNING id as role_id, role
),
existing_role_resources AS (
    SELECT r.id as role_id, r.role
    FROM role_param rp
    JOIN roles_resource r ON r.role = CAST(rp.role_value AS profile_role)
    WHERE rp.role_value IS NOT NULL
),
all_role_resources AS (
    SELECT role_id, role FROM role_resources
    UNION ALL
    SELECT role_id, role FROM existing_role_resources
),
-- Delete existing roles for profiles being updated
delete_existing_roles AS (
    DELETE FROM profile_roles pr
    WHERE pr.profile_id IN (SELECT id FROM validated_profiles)
    AND EXISTS (SELECT 1 FROM role_param rp WHERE rp.role_value IS NOT NULL)
    RETURNING pr.profile_id
),
-- Insert new roles
insert_new_roles AS (
    INSERT INTO profile_roles (profile_id, role_id, created_at, updated_at, generated, mcp, call_id)
    SELECT 
        vp.id,
        arr.role_id,
        NOW(),
        NOW(),
        false,
        false,
        NULL
    FROM validated_profiles vp
    CROSS JOIN all_role_resources arr
    WHERE EXISTS (SELECT 1 FROM role_param rp WHERE rp.role_value IS NOT NULL)
    RETURNING profile_id
),
profile_update AS (
    -- UPDATE profile_artifact table (just updated_at, role is now in junction table)
    UPDATE profile_artifact p
    SET updated_at = NOW()
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