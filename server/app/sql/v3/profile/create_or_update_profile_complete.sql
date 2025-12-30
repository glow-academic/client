-- Create or update profile with departments, cohorts, and all emails in single function
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_or_update_profile_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_or_update_profile_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_create_or_update_profile_v3(
    profile_id_new uuid,  -- New UUID for create, will be ignored if profile exists
    first_name text,
    last_name text,
    emails text[],  -- Array of all emails (first one is primary by default)
    role text,
    current_profile_id uuid DEFAULT NULL,  -- current user's profile_id for role validation
    primary_email_index integer DEFAULT 0,
    active boolean DEFAULT true,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[]
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
        COALESCE(emails, ARRAY[]::text[]) AS emails,
        COALESCE(primary_email_index, 0) AS primary_email_index,
        role AS role,
        COALESCE(active, true) AS active,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        current_profile_id AS current_profile_id
),
user_profile AS (
    SELECT 
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    LEFT JOIN profiles p ON p.id = x.current_profile_id
    WHERE x.current_profile_id IS NOT NULL
),
current_user_role AS (
    -- Get current user's role for validation (if provided)
    SELECT p.role FROM params x JOIN profiles p ON p.id = x.current_profile_id WHERE x.current_profile_id IS NOT NULL
),
role_validation AS (
    -- Validate role hierarchy: check if current user can assign target role (if current_profile_id provided)
    SELECT 
        CASE 
            WHEN (SELECT current_profile_id FROM params) IS NULL THEN true  -- No validation if no current_profile_id
            WHEN cur.role = 'superadmin'::profile_role AND p_role.role::profile_role IN ('superadmin'::profile_role, 'admin'::profile_role, 'instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'admin'::profile_role AND p_role.role::profile_role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'instructional'::profile_role AND p_role.role::profile_role IN ('member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'member'::profile_role AND p_role.role::profile_role = 'guest'::profile_role THEN true
            ELSE false
        END as can_assign
    FROM current_user_role cur
    CROSS JOIN (SELECT role FROM params) p_role
    WHERE EXISTS (SELECT 1 FROM current_user_role)
    UNION ALL
    SELECT true  -- Allow if no current_profile_id provided
    WHERE NOT EXISTS (SELECT 1 FROM current_user_role)
    LIMIT 1
),
primary_email AS (
    SELECT 
        emails[primary_email_index + 1] as email  -- PostgreSQL arrays are 1-indexed
    FROM params
    WHERE array_length(emails, 1) > primary_email_index
),
existing_profile AS (
    -- Find existing profile by primary email in profile_emails table
    SELECT pe.profile_id as id FROM profile_emails pe WHERE pe.email = (SELECT email FROM primary_email) AND pe.active = true LIMIT 1
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
all_emails_data AS (
    -- Prepare all emails with primary flag based on index
    SELECT 
        email,
        CASE WHEN ord = (SELECT primary_email_index + 1 FROM params) THEN true ELSE false END as is_primary
    FROM unnest((SELECT emails FROM params)) WITH ORDINALITY AS e(email, ord)
),
email_upsert AS (
    -- Insert or update all emails
    INSERT INTO profile_emails (profile_id, email, is_primary, active)
    SELECT 
        pu.id,
        aed.email,
        aed.is_primary,
        true
    FROM profile_upsert pu
    CROSS JOIN all_emails_data aed
    WHERE EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true)
    ON CONFLICT (email) DO UPDATE SET
        profile_id = EXCLUDED.profile_id,
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
cohort_cleanup AS (
    -- Delete existing cohort relationships
    DELETE FROM cohort_profiles
    WHERE profile_id = (SELECT id FROM profile_upsert LIMIT 1)
      AND EXISTS (SELECT 1 FROM profile_upsert)
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
    COALESCE(up.actor_name, 'System')::text as actor_name
FROM profile_upsert pu
CROSS JOIN user_profile up
LIMIT 1
$$;

COMMIT;

