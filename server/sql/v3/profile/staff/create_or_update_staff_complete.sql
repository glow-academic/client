-- Create or update staff profile with departments and cohorts in single transaction
-- Parameters:
--   $1 = profile_id (uuid) - new UUID for create, existing for update
--   $2 = first_name (text)
--   $3 = last_name (text)
--   $4 = alias (text)
--   $5 = role (text)
--   $6 = active (boolean)
--   $7 = department_ids (uuid[]) - array of department UUIDs (empty array means remove all)
--   $8 = cohort_ids (uuid[]) - array of cohort UUIDs (only adds, doesn't remove)
-- Returns: profile_id, created (boolean), first_name, last_name

WITH existing_profile AS (
    SELECT id FROM profiles WHERE alias = $4
),
profile_upsert AS (
    -- Insert or update profile
    INSERT INTO profiles (
        id, first_name, last_name, alias, role, active,
        default_profile, viewed_intro, viewed_chat, updated_at
    )
    VALUES (
        COALESCE((SELECT id FROM existing_profile LIMIT 1), $1),  -- Use existing ID if found, else new UUID
        $2,  -- first_name
        $3,  -- last_name
        $4,  -- alias
        $5,  -- role
        $6,  -- active
        false,  -- default_profile
        false,  -- viewed_intro
        false,  -- viewed_chat
        NOW()  -- updated_at
    )
    ON CONFLICT (alias) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        active = EXCLUDED.active,
        updated_at = NOW()
    RETURNING id, first_name, last_name, NOT EXISTS(SELECT 1 FROM existing_profile) as created
),
final_profile AS (
    SELECT id, first_name, last_name, created FROM profile_upsert
),
dept_cleanup AS (
    -- Delete existing department relationships (always delete, will reinsert if array not empty)
    DELETE FROM profile_departments
    WHERE profile_id = (SELECT id FROM final_profile)
),
dept_insert AS (
    -- Insert department relationships (first one as primary)
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
    ON CONFLICT (profile_id, department_id) DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        active = true,
        updated_at = NOW()
),
cohort_insert AS (
    -- Insert cohort relationships (only if not already exists - doesn't remove existing)
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        cohort_id,
        fp.id,
        true
    FROM final_profile fp
    CROSS JOIN unnest($8::uuid[]) as cohort_id
    WHERE cardinality($8::uuid[]) > 0
    ON CONFLICT (cohort_id, profile_id) DO UPDATE SET
        active = true
)
SELECT 
    fp.id::text as profile_id,
    fp.created,
    fp.first_name,
    fp.last_name
FROM final_profile fp
LIMIT 1

