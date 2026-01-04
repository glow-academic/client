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
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.current_profile_id
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
profile_insert AS (
    -- Insert profile (only if email doesn't exist)
    INSERT INTO profiles (
        id, first_name, last_name, role, active
    )
    SELECT 
        (SELECT profile_id FROM params),
        (SELECT first_name FROM params),
        (SELECT last_name FROM params),
        (SELECT role FROM params)::profile_role,
        (SELECT active FROM params)
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    RETURNING id, first_name, last_name
),
all_emails_data AS (
    -- Prepare all emails with primary flag based on index
    SELECT 
        email,
        CASE WHEN ord = (SELECT primary_email_index + 1 FROM params) THEN true ELSE false END as is_primary
    FROM unnest((SELECT emails FROM params)) WITH ORDINALITY AS e(email, ord)
),
email_insert AS (
    -- Insert all emails into profile_emails
    INSERT INTO profile_emails (profile_id, email, is_primary, active)
    SELECT 
        pi.id,
        aed.email,
        aed.is_primary,
        true
    FROM profile_insert pi
    CROSS JOIN all_emails_data aed
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    ON CONFLICT (email) DO NOTHING  -- Skip if email already exists (shouldn't happen due to email_check)
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
    pi.id as profile_id,
    pi.first_name,
    pi.last_name,
    COALESCE(ec.email_exists, false) as email_exists,
    ap.actor_name
FROM email_check ec
CROSS JOIN actor_profile ap
LEFT JOIN profile_insert pi ON true
LIMIT 1
$$;