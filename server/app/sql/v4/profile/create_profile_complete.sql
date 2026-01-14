-- Create profile with validation, cohort, department, and all emails in single function
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
        WHERE proname = 'api_create_profile_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_profile_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_create_profile_v4(
    profile_id uuid,
    first_name text,
    last_name text,
    emails text[],  -- Array of all emails (first one is primary)
    role text,
    current_profile_id uuid DEFAULT NULL,  -- Optional: comes from header, not request body
    primary_email_index integer DEFAULT 0,
    active boolean DEFAULT true,
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    primary_department_index integer DEFAULT NULL
)
RETURNS TABLE (
    profile_id uuid,
    first_name text,
    last_name text,
    email_exists boolean,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        first_name AS first_name,
        last_name AS last_name,
        COALESCE(emails, ARRAY[]::text[]) AS emails,
        COALESCE(primary_email_index, 0) AS primary_email_index,
        role AS role,
        COALESCE(active, true) AS active,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        primary_department_index AS primary_department_index,
        current_profile_id AS current_profile_id
),
actor_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.current_profile_id
),
primary_email AS (
    SELECT 
        emails[primary_email_index + 1] as email  -- PostgreSQL arrays are 1-indexed
    FROM params
    WHERE array_length(emails, 1) > primary_email_index
),
email_check AS (
    -- Check if primary email already exists in profile_emails
    SELECT EXISTS(SELECT 1 FROM profile_emails WHERE email = (SELECT email FROM primary_email) AND active = true) as email_exists
    FROM primary_email
),
-- Insert first_name INTO names_resource table
first_name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT first_name, NOW(), NOW()
    FROM params
    WHERE first_name IS NOT NULL AND first_name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as first_name_id, name
),
-- Insert last_name INTO names_resource table
last_name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT last_name, NOW(), NOW()
    FROM params
    WHERE last_name IS NOT NULL AND last_name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as last_name_id, name
),
profile_insert AS (
    -- Insert profile without first_name, last_name, active columns
    INSERT INTO profile_artifact (
        id
    )
    SELECT 
        (SELECT profile_id FROM params)
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    RETURNING id
),
-- Insert role via profile_roles junction
role_resource AS (
    INSERT INTO roles_resource (role, created_at, updated_at, active, generated, mcp, call_id)
    SELECT (SELECT role FROM params)::profile_role, NOW(), NOW(), true, false, false, NULL
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    ON CONFLICT (role) DO UPDATE SET updated_at = NOW()
    RETURNING id as role_id
),
profile_role_insert AS (
    INSERT INTO profile_roles (profile_id, role_id, created_at, updated_at, generated, mcp, call_id)
    SELECT pi.id, rr.role_id, NOW(), NOW(), false, false, NULL
    FROM profile_insert pi
    CROSS JOIN role_resource rr
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    RETURNING profile_id
),
-- Link profile to first_name
link_profile_first_name AS (
    INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
    SELECT 
        pi.id,
        fnr.first_name_id,
        'first'::type_profile_names,
        NOW(),
        NOW()
    FROM profile_insert pi
    CROSS JOIN first_name_resource fnr
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    ON CONFLICT (profile_id, name_id, type) DO UPDATE SET updated_at = NOW()
),
-- Link profile to last_name
link_profile_last_name AS (
    INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
    SELECT 
        pi.id,
        lnr.last_name_id,
        'last'::type_profile_names,
        NOW(),
        NOW()
    FROM profile_insert pi
    CROSS JOIN last_name_resource lnr
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    ON CONFLICT (profile_id, name_id, type) DO UPDATE SET updated_at = NOW()
),
-- Link profile active flag
link_profile_active_flag AS (
    INSERT INTO profile_flags (profile_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        pi.id,
        f.id,
        'active'::type_profile_flags,
        (SELECT active FROM params),
        NOW(),
        NOW()
    FROM profile_insert pi
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
      AND NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    ON CONFLICT (profile_id, flag_id, type) DO UPDATE SET 
        value = (SELECT active FROM params),
        updated_at = NOW()
),
profile_with_names AS (
    -- Get profile with names for return
    SELECT 
        pi.id,
        fnr.name as first_name,
        lnr.name as last_name
    FROM profile_insert pi
    LEFT JOIN first_name_resource fnr ON true
    LEFT JOIN last_name_resource lnr ON true
),
all_emails_data AS (
    -- Prepare all emails with primary flag based on index
    SELECT 
        email,
        CASE WHEN ord = (SELECT primary_email_index + 1 FROM params) THEN true ELSE false END as is_primary
    FROM unnest((SELECT emails FROM params)) WITH ORDINALITY AS e(email, ord)
),
placeholder_call_id AS (
    -- Get a placeholder call_id for email creation
    SELECT id FROM calls LIMIT 1
),
email_resources AS (
    -- Create email resources first
    INSERT INTO emails_resource (email, call_id, created_at, updated_at)
    SELECT DISTINCT
        aed.email,
        (SELECT id FROM placeholder_call_id),
        NOW(),
        NOW()
    FROM all_emails_data aed
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
    RETURNING id as email_id, email
),
email_insert AS (
    -- Link emails to profile via profile_emails junction table
    INSERT INTO profile_emails (profile_id, email_id, is_primary, active)
    SELECT 
        pi.id,
        er.email_id,
        aed.is_primary,
        true
    FROM profile_insert pi
    CROSS JOIN all_emails_data aed
    JOIN email_resources er ON er.email = aed.email
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    ON CONFLICT (profile_id, email_id) DO UPDATE SET 
        is_primary = EXCLUDED.is_primary,
        active = true,
        updated_at = NOW()
),
cohort_insert AS (
    -- Insert cohort relationships if provided and profile was created
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        cohort_id,
        pi.id,
        true
    FROM profile_insert pi
    CROSS JOIN unnest((SELECT cohort_ids FROM params)) as cohort_id
    WHERE array_length((SELECT cohort_ids FROM params), 1) > 0
        AND NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    ON CONFLICT (cohort_id, profile_id) DO NOTHING
),
department_insert AS (
    -- Insert department relationships if provided and profile was created (set primary based on index)
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active)
    SELECT 
        pi.id,
        dept.dept_id,
        (dept.ord - 1 = COALESCE((SELECT primary_department_index FROM params), 0)) as is_primary,
        true
    FROM profile_insert pi
    CROSS JOIN unnest((SELECT department_ids FROM params)) WITH ORDINALITY AS dept(dept_id, ord)
    WHERE array_length((SELECT department_ids FROM params), 1) > 0
        AND NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    ON CONFLICT (profile_id, department_id) DO NOTHING
)
-- Return profile info and email check result (always returns a row)
SELECT 
    pwn.id as profile_id,
    pwn.first_name,
    pwn.last_name,
    COALESCE(ec.email_exists, false) as email_exists,
    ap.actor_name
FROM email_check ec
CROSS JOIN actor_profile ap
LEFT JOIN profile_with_names pwn ON true
LIMIT 1
$$;