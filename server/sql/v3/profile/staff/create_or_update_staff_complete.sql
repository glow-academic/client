-- Create or update staff profile with departments and cohorts in single transaction
-- Parameters:
--   $1 = profile_id (uuid) - new UUID for create, existing for update
--   $2 = first_name (text)
--   $3 = last_name (text)
--   $4 = email (text)
--   $5 = role (text)
--   $6 = active (boolean)
--   $7 = department_ids (uuid[]) - array of department UUIDs (empty array means remove all)
--   $8 = cohort_ids (uuid[]) - array of cohort UUIDs (only adds, doesn't remove)
--   $9 = current_profile_id (uuid) - current user's profile ID for role validation
-- Returns: profile_id, created (boolean), first_name, last_name, validation_error (text)

WITH current_user_role AS (
    -- Get current user's role (if current_profile_id provided)
    SELECT role FROM profiles WHERE id = $9::uuid AND $9 IS NOT NULL
),
role_validation AS (
    -- Validate role hierarchy: check if current user can assign target role
    -- If current_profile_id is NULL, skip validation (can_assign = true)
    SELECT 
        CASE 
            WHEN $9 IS NULL THEN true  -- Skip validation if no current_profile_id provided
            WHEN cur.role = 'superadmin' AND $5 IN ('superadmin', 'admin', 'instructional', 'ta', 'guest') THEN true
            WHEN cur.role = 'admin' AND $5 IN ('instructional', 'ta', 'guest') THEN true
            WHEN cur.role = 'instructional' AND $5 IN ('ta', 'guest') THEN true
            WHEN cur.role = 'ta' AND $5 = 'guest' THEN true
            WHEN cur.role = 'guest' THEN false
            ELSE false
        END as can_assign,
        COALESCE(cur.role, NULL) as current_role
    FROM current_user_role cur
    UNION ALL
    SELECT true as can_assign, NULL as current_role
    WHERE NOT EXISTS (SELECT 1 FROM current_user_role)
),
existing_profile AS (
    SELECT id FROM profiles WHERE email = $4
),
profile_upsert AS (
    -- Insert or update profile (only if role validation passes)
    INSERT INTO profiles (
        id, first_name, last_name, email, role, active,
        default_profile, viewed_intro, viewed_chat, updated_at
    )
    SELECT
        COALESCE((SELECT id FROM existing_profile LIMIT 1), $1),  -- Use existing ID if found, else new UUID
        $2,  -- first_name
        $3,  -- last_name
        $4,  -- email
        $5::profile_role,  -- role
        $6,  -- active
        false,  -- default_profile
        false,  -- viewed_intro
        false,  -- viewed_chat
        NOW()  -- updated_at
    WHERE EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true)
    ON CONFLICT (email) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = CASE 
            WHEN EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true) 
            THEN EXCLUDED.role::profile_role
            ELSE profiles.role 
        END,
        active = EXCLUDED.active,
        updated_at = NOW()
    RETURNING id, first_name, last_name, NOT EXISTS(SELECT 1 FROM existing_profile) as created
),
final_profile AS (
    SELECT id, first_name, last_name, created FROM profile_upsert
),
dept_cleanup AS (
    -- Delete existing department relationships (only if profile was created/updated)
    DELETE FROM profile_departments
    WHERE profile_id = (SELECT id FROM final_profile LIMIT 1)
      AND EXISTS (SELECT 1 FROM final_profile)
),
dept_insert AS (
    -- Insert department relationships (first one as primary, only if profile exists)
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active, created_at, updated_at)
    SELECT 
        fp.id,
        dept_id,
        (ROW_NUMBER() OVER (ORDER BY dept_id) = 1) as is_primary,  -- First department is primary
        true,
        NOW(),
        NOW()
    FROM final_profile fp
    CROSS JOIN unnest($7::uuid[]) as dept_id
    WHERE cardinality($7::uuid[]) > 0  -- Only insert if array is not empty
      AND EXISTS (SELECT 1 FROM final_profile)
    ON CONFLICT (profile_id, department_id) DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        active = true,
        updated_at = NOW()
),
cohort_insert AS (
    -- Insert cohort relationships (only if profile exists)
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        cohort_id,
        fp.id,
        true
    FROM final_profile fp
    CROSS JOIN unnest($8::uuid[]) as cohort_id
    WHERE cardinality($8::uuid[]) > 0
      AND EXISTS (SELECT 1 FROM final_profile)
    ON CONFLICT (cohort_id, profile_id) DO UPDATE SET
        active = true
)
SELECT 
    fp.id::text as profile_id,
    fp.created,
    fp.first_name,
    fp.last_name,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true) 
        THEN 'Cannot assign role ''' || $5 || ''' with current role ''' || rv.current_role || '''.'
        ELSE NULL
    END as validation_error
FROM role_validation rv
LEFT JOIN final_profile fp ON EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true)
LIMIT 1

