-- Bulk update profile with role validation and request limit update in single transaction
-- Parameters:
--   $1 = current_profile_id (uuid) - current user's profile ID for validation
--   $2 = profile_ids (uuid[]) - array of profile IDs to update
--   $3 = role (text) - new role (NULL to skip)
--   $4 = default_profile (boolean) - new default_profile (NULL to skip)
--   $5 = active (boolean) - new active (NULL to skip)
--   $6 = requests_per_day (integer) - new requests_per_day (NULL to skip update, use -1 for unlimited)
--   $7 = primary_department_id (uuid) - new primary department (NULL to skip)
-- Returns: updated_count (integer), validation_errors (text[])

WITH current_user_role AS (
    -- Get current user's role for validation
    SELECT role FROM profiles WHERE id = $1
),
profile_validation AS (
    -- Validate each profile and check permissions
    SELECT 
        p.id,
        p.role as current_role,
        p.default_profile,
        cur.role as validator_role,
        -- Check if role assignment is allowed (hierarchy check)
        CASE 
            WHEN $3 IS NULL THEN true  -- Not updating role
            WHEN cur.role = 'superadmin' THEN true
            WHEN cur.role = 'admin' AND $3 IN ('instructional', 'ta', 'guest') THEN true
            WHEN cur.role = 'instructional' AND $3 IN ('ta', 'guest') THEN true
            WHEN cur.role = 'ta' AND $3 = 'guest' THEN true
            ELSE false
        END as can_assign_role,
        -- Check if role level is acceptable (cannot assign equal or higher role)
        CASE 
            WHEN $3 IS NULL THEN true  -- Not updating role
            WHEN cur.role = 'superadmin' THEN true  -- Superadmin can assign any role
            WHEN p.id = $1 THEN true  -- Can update own role
            WHEN cur.role = 'superadmin' THEN true
            WHEN cur.role = 'admin' AND $3 IN ('instructional', 'ta', 'guest') THEN true
            WHEN cur.role = 'instructional' AND $3 IN ('ta', 'guest') THEN true
            WHEN cur.role = 'ta' AND $3 = 'guest' THEN true
            ELSE false
        END as role_level_ok,
        -- Check if default profile editing is allowed
        CASE 
            WHEN p.default_profile = true AND cur.role != 'superadmin' THEN false
            ELSE true
        END as can_edit_default
    FROM unnest($2::uuid[]) as profile_id
    CROSS JOIN current_user_role cur
    JOIN profiles p ON p.id = profile_id
),
validated_profiles AS (
    -- Filter to only profiles that pass validation
    SELECT id
    FROM profile_validation
    WHERE can_assign_role = true AND role_level_ok = true AND can_edit_default = true
),
profile_update AS (
    -- Update profiles table with dynamic SET clauses
    UPDATE profiles
    SET 
        role = COALESCE($3, role),
        default_profile = COALESCE($4, default_profile),
        active = COALESCE($5, active),
        updated_at = NOW()
    WHERE id IN (SELECT id FROM validated_profiles)
    RETURNING id
),
request_limit_update AS (
    -- Update request limits if provided (skip if NULL)
    INSERT INTO profile_request_limits (profile_id, requests_per_day, active)
    SELECT 
        pu.id,
        CASE WHEN $6 = -1 THEN NULL ELSE $6 END,  -- -1 means unlimited (NULL)
        true
    FROM profile_update pu
    WHERE $6 IS NOT NULL  -- Only update if value provided (not skipping)
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
        department_id = $7,
        updated_at = NOW()
    WHERE profile_id IN (SELECT id FROM profile_update)
        AND $7 IS NOT NULL  -- Only update if value provided (not skipping)
    RETURNING profile_id
)
SELECT COUNT(*)::integer as updated_count
FROM profile_update

