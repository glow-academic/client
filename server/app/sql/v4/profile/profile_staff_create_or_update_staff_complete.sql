-- Create or update staff profile with departments, cohorts, and all emails in single function
-- Converted to PostgreSQL function (single profile, called in loop for bulk)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_upsert_staff_v4(uuid, text, text, text, text, boolean, uuid[], uuid[], uuid, text[], integer);

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_upsert_staff_v4(
    profile_id_new uuid,  -- New UUID for create, will be ignored if profile exists
    first_name text,
    last_name text,
    primary_email text,
    role text,
    active boolean,
    department_ids uuid[],
    cohort_ids uuid[],
    current_profile_id uuid,  -- current user's profile_id for role validation
    additional_emails text[],  -- array of additional emails
    primary_email_index integer  -- Index of primary email (for ordering)
)
RETURNS TABLE (
    profile_id uuid,
    created boolean,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        profile_id_new AS profile_id_new,
        first_name AS first_name,
        last_name AS last_name,
        primary_email AS primary_email,
        role AS role,
        active AS active,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        current_profile_id AS current_profile_id,
        COALESCE(additional_emails, ARRAY[]::text[]) AS additional_emails,
        COALESCE(primary_email_index, 0) AS primary_email_index
),
user_profile AS (
    SELECT 
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.current_profile_id
),
current_user_role AS (
    -- Get current user's role for validation
    SELECT p.role FROM params x JOIN profiles p ON p.id = x.current_profile_id
),
role_validation AS (
    -- Validate role hierarchy: check if current user can assign target role
    SELECT 
        CASE 
            WHEN cur.role = 'superadmin' AND p_role.role IN ('superadmin', 'admin', 'instructional', 'member', 'guest') THEN true
            WHEN cur.role = 'admin' AND p_role.role IN ('instructional', 'member', 'guest') THEN true
            WHEN cur.role = 'instructional' AND p_role.role IN ('member', 'guest') THEN true
            WHEN cur.role = 'member' AND p_role.role = 'guest' THEN true
            ELSE false
        END as can_assign
    FROM current_user_role cur
    CROSS JOIN (SELECT role FROM params) p_role
),
existing_profile AS (
    -- Find existing profile by email in profile_emails table
    SELECT pe.profile_id as id FROM profile_emails pe WHERE pe.email = (SELECT primary_email FROM params) AND pe.active = true LIMIT 1
),
profile_upsert AS (
    -- Insert or update profile (only if role validation passes)
    INSERT INTO profiles (
        id, first_name, last_name, role, active, updated_at
    )
    SELECT
        COALESCE((SELECT id FROM existing_profile LIMIT 1), (SELECT profile_id_new FROM params)),  -- Use existing ID if found, else new UUID
        (SELECT first_name FROM params),
        (SELECT last_name FROM params),
        (SELECT role FROM params)::profile_role,
        (SELECT active FROM params),
        NOW()
    WHERE EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true)
    ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = CASE 
            WHEN EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true) 
            THEN EXCLUDED.role::profile_role
            ELSE profiles.role::profile_role
        END,
        active = EXCLUDED.active,
        updated_at = NOW()
    RETURNING id, NOT EXISTS(SELECT 1 FROM existing_profile) as created
),
email_deactivate_all AS (
    -- Deactivate all existing emails for this profile
    UPDATE profile_emails SET
        active = false,
        updated_at = NOW()
    WHERE profile_id = (SELECT id FROM profile_upsert LIMIT 1)
      AND EXISTS (SELECT 1 FROM profile_upsert)
),
all_emails AS (
    -- Combine primary and additional emails with ordering
    SELECT 
        email,
        CASE WHEN email = (SELECT primary_email FROM params) THEN true ELSE false END as is_primary,
        CASE 
            WHEN email = (SELECT primary_email FROM params) THEN (SELECT primary_email_index FROM params)
            ELSE 999  -- Additional emails come after primary
        END as email_order
    FROM (
        SELECT (SELECT primary_email FROM params) as email
        UNION ALL
        SELECT unnest((SELECT additional_emails FROM params))
    ) emails
),
email_upsert AS (
    -- Insert or update all emails
    INSERT INTO profile_emails (profile_id, email, is_primary, active)
    SELECT 
        pu.id,
        ae.email,
        ae.is_primary,
        true
    FROM profile_upsert pu
    CROSS JOIN all_emails ae
    WHERE EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true)
    ORDER BY ae.email_order
    ON CONFLICT (profile_id, email) DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        active = true,
        updated_at = NOW()
),
dept_cleanup AS (
    -- Delete existing department relationships
    DELETE FROM profile_departments
    WHERE profile_id = (SELECT id FROM profile_upsert LIMIT 1)
      AND EXISTS (SELECT 1 FROM profile_upsert)
),
dept_insert AS (
    -- Insert department relationships (first one as primary)
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active, created_at, updated_at)
    SELECT 
        pu.id,
        dept_id,
        (ROW_NUMBER() OVER (ORDER BY dept_id) = 1) as is_primary,
        true,
        NOW(),
        NOW()
    FROM profile_upsert pu
    CROSS JOIN unnest((SELECT department_ids FROM params)) as dept_id
    WHERE cardinality((SELECT department_ids FROM params)) > 0
      AND EXISTS (SELECT 1 FROM profile_upsert)
    ON CONFLICT (profile_id, department_id) DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        active = true,
        updated_at = NOW()
),
cohort_insert AS (
    -- Insert cohort relationships
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        cohort_id,
        pu.id,
        true
    FROM profile_upsert pu
    CROSS JOIN unnest((SELECT cohort_ids FROM params)) as cohort_id
    WHERE cardinality((SELECT cohort_ids FROM params)) > 0
      AND EXISTS (SELECT 1 FROM profile_upsert)
    ON CONFLICT (cohort_id, profile_id) DO UPDATE SET
        active = true
)
SELECT 
    pu.id as profile_id,
    pu.created,
    up.actor_name::text as actor_name
FROM profile_upsert pu
CROSS JOIN user_profile up
LIMIT 1
$$;