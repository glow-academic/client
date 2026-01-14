-- Create or UPDATE profile_artifact with departments, cohorts, and all emails in single function
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_or_update_profile_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_or_update_profile_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_create_or_update_profile_v4(
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
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    LEFT JOIN profile_artifact p ON p.id = x.current_profile_id
    WHERE x.current_profile_id IS NOT NULL
),
current_user_role AS (
    -- Get current user's role for validation (if provided)
    SELECT (SELECT r.role FROM profile_roles pr_j 
            JOIN roles_resource r ON pr_j.role_id = r.id 
            WHERE pr_j.profile_id = p.id 
            LIMIT 1) as role 
    FROM params x JOIN profile_artifact p ON p.id = x.current_profile_id WHERE x.current_profile_id IS NOT NULL
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
    SELECT pe.profile_id as id FROM profile_emails pe JOIN emails_resource e ON pe.email_id = e.id WHERE e.email = (SELECT email FROM primary_email) AND pe.active = true LIMIT 1
),
-- Insert/update first_name in names table
first_name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT first_name, NOW(), NOW()
    FROM params
    WHERE first_name IS NOT NULL AND first_name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as first_name_id, name
),
-- Insert/update last_name in names table
last_name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT last_name, NOW(), NOW()
    FROM params
    WHERE last_name IS NOT NULL AND last_name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as last_name_id, name
),
profile_upsert AS (
    -- Insert or UPDATE profile_artifact without first_name, last_name, active columns
    INSERT INTO profile_artifact (
        id, updated_at
    )
    SELECT
        COALESCE((SELECT id FROM existing_profile LIMIT 1), (SELECT profile_id_new FROM params)),  -- Use existing ID if found, else new UUID
        NOW()
    WHERE EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true)
    ON CONFLICT (id) DO UPDATE SET
        updated_at = NOW()
    RETURNING id, NOT EXISTS(SELECT 1 FROM existing_profile) as created
),
-- Insert/update role via profile_roles junction
role_resource AS (
    INSERT INTO roles_resource (role, created_at, updated_at, active, generated, mcp, call_id)
    SELECT (SELECT role FROM params)::profile_role, NOW(), NOW(), true, false, false, NULL
    WHERE EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true)
    ON CONFLICT (role) DO UPDATE SET updated_at = NOW()
    RETURNING id as role_id
),
profile_role_upsert AS (
    DELETE FROM profile_roles WHERE profile_id IN (SELECT id FROM profile_upsert)
    RETURNING profile_id
),
profile_role_insert AS (
    INSERT INTO profile_roles (profile_id, role_id, created_at, updated_at, generated, mcp)
    SELECT pu.id, rr.role_id, NOW(), NOW(), false, false
    FROM profile_upsert pu
    CROSS JOIN role_resource rr
    WHERE EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true)
    RETURNING profile_id
),
-- Delete existing profile_names links for first_name
delete_old_first_name AS (
    DELETE FROM profile_names
    WHERE profile_id = (SELECT id FROM profile_upsert LIMIT 1)
      AND type = 'first'::type_profile_names
      AND EXISTS (SELECT 1 FROM profile_upsert)
),
-- Link profile to first_name
link_profile_first_name AS (
    INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
    SELECT 
        pu.id,
        fnr.first_name_id,
        'first'::type_profile_names,
        NOW(),
        NOW()
    FROM profile_upsert pu
    CROSS JOIN first_name_resource fnr
    WHERE EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true)
    ON CONFLICT (profile_id, name_id, type) DO UPDATE SET updated_at = NOW()
),
-- Delete existing profile_names links for last_name
delete_old_last_name AS (
    DELETE FROM profile_names
    WHERE profile_id = (SELECT id FROM profile_upsert LIMIT 1)
      AND type = 'last'::type_profile_names
      AND EXISTS (SELECT 1 FROM profile_upsert)
),
-- Link profile to last_name
link_profile_last_name AS (
    INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
    SELECT 
        pu.id,
        lnr.last_name_id,
        'last'::type_profile_names,
        NOW(),
        NOW()
    FROM profile_upsert pu
    CROSS JOIN last_name_resource lnr
    WHERE EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true)
    ON CONFLICT (profile_id, name_id, type) DO UPDATE SET updated_at = NOW()
),
-- UPDATE profile_artifact active flag
update_profile_active_flag AS (
    INSERT INTO profile_flags (profile_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        pu.id,
        f.id,
        'active'::type_profile_flags,
        (SELECT active FROM params),
        NOW(),
        NOW()
    FROM profile_upsert pu
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
      AND EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true)
    ON CONFLICT (profile_id, flag_id, type) DO UPDATE SET 
        value = (SELECT active FROM params),
        updated_at = NOW()
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
email_resources AS (
    -- Create email resources first
    INSERT INTO emails_resource (email, call_id, created_at, updated_at)
    SELECT DISTINCT
        aed.email,
        (SELECT id FROM calls LIMIT 1),
        NOW(),
        NOW()
    FROM all_emails_data aed
    WHERE EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true)
    ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
    RETURNING id as email_id, email
),
email_upsert AS (
    -- Link emails to profile via profile_emails junction table
    INSERT INTO profile_emails (profile_id, email_id, is_primary, active)
    SELECT 
        pu.id,
        er.email_id,
        aed.is_primary,
        true
    FROM profile_upsert pu
    CROSS JOIN all_emails_data aed
    JOIN email_resources er ON er.email = aed.email
    WHERE EXISTS (SELECT 1 FROM role_validation WHERE can_assign = true)
    ON CONFLICT (profile_id, email_id) DO UPDATE SET
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