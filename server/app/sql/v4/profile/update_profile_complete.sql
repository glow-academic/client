-- Update profile with optional fields, emails, cohorts, departments, and activity tracking
-- Handles both simple updates (auth) and comprehensive updates (staff management)
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
        WHERE proname = 'api_update_profile_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_profile_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_update_profile_v4(
    target_profile_id uuid,
    profile_id uuid,
    first_name text DEFAULT NULL,
    last_name text DEFAULT NULL,
    last_login timestamptz DEFAULT NULL,
    role text DEFAULT NULL,
    active boolean DEFAULT NULL,
    last_active timestamptz DEFAULT NULL,
    requests_per_day integer DEFAULT NULL,
    emails text[] DEFAULT NULL,  -- Array of all emails (for comprehensive update)
    primary_email_index integer DEFAULT NULL,  -- Index of primary email in emails array
    cohort_ids uuid[] DEFAULT NULL,  -- Array of cohort IDs (for comprehensive update)
    department_ids uuid[] DEFAULT NULL,  -- Array of department IDs (for comprehensive update)
    primary_department_index integer DEFAULT NULL  -- Index of primary department
)
RETURNS TABLE (
    profile_exists boolean,
    profile_id uuid,
    first_name text,
    last_name text,
    name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        target_profile_id AS target_profile_id,
        first_name AS first_name,
        last_name AS last_name,
        last_login AS last_login,
        role AS role,
        active AS active,
        last_active AS last_active,
        requests_per_day AS requests_per_day,
        emails AS emails,
        primary_email_index AS primary_email_index,
        cohort_ids AS cohort_ids,
        department_ids AS department_ids,
        primary_department_index AS primary_department_index,
        profile_id AS profile_id
),
profile_exists_check AS (
    -- Check if profile exists
    SELECT EXISTS(SELECT 1 FROM profile WHERE id = (SELECT target_profile_id FROM params))::boolean as profile_exists
),
actor_profile AS (
    SELECT 
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' ||
            (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1),
            ''
        ) as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
),
-- Insert/update first_name in names table if provided
first_name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT first_name, NOW(), NOW()
    FROM params
    WHERE first_name IS NOT NULL AND first_name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as first_name_id, name
),
-- Insert/update last_name in names table if provided
last_name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT last_name, NOW(), NOW()
    FROM params
    WHERE last_name IS NOT NULL AND last_name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as last_name_id, name
),
profile_update AS (
    -- Update profile fields (only update non-NULL parameters, keep existing values for NULL)
    UPDATE profile
    SET 
        last_login = COALESCE((SELECT last_login FROM params), last_login),
        role = COALESCE((SELECT role FROM params)::profile_role, role),
        updated_at = NOW()
    WHERE id = (SELECT target_profile_id FROM params)
      AND EXISTS (SELECT 1 FROM profile_exists_check WHERE profile_exists = true)
    RETURNING id
),
-- Delete old first_name link if updating
delete_old_first_name AS (
    DELETE FROM profile_names
    WHERE profile_id = (SELECT target_profile_id FROM params)
      AND type = 'first'::type_profile_names
      AND EXISTS (SELECT 1 FROM profile_update)
      AND EXISTS (SELECT 1 FROM first_name_resource)
),
-- Link new first_name if provided
link_profile_first_name AS (
    INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
    SELECT 
        pu.id,
        fnr.first_name_id,
        'first'::type_profile_names,
        NOW(),
        NOW()
    FROM profile_update pu
    CROSS JOIN first_name_resource fnr
    WHERE EXISTS (SELECT 1 FROM profile_update)
    ON CONFLICT (profile_id, name_id, type) DO UPDATE SET updated_at = NOW()
),
-- Delete old last_name link if updating
delete_old_last_name AS (
    DELETE FROM profile_names
    WHERE profile_id = (SELECT target_profile_id FROM params)
      AND type = 'last'::type_profile_names
      AND EXISTS (SELECT 1 FROM profile_update)
      AND EXISTS (SELECT 1 FROM last_name_resource)
),
-- Link new last_name if provided
link_profile_last_name AS (
    INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
    SELECT 
        pu.id,
        lnr.last_name_id,
        'last'::type_profile_names,
        NOW(),
        NOW()
    FROM profile_update pu
    CROSS JOIN last_name_resource lnr
    WHERE EXISTS (SELECT 1 FROM profile_update)
    ON CONFLICT (profile_id, name_id, type) DO UPDATE SET updated_at = NOW()
),
-- Update active flag if provided
update_profile_active_flag AS (
    INSERT INTO profile_flags (profile_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        pu.id,
        f.id,
        'active'::type_profile_flags,
        (SELECT active FROM params),
        NOW(),
        NOW()
    FROM profile_update pu
    CROSS JOIN flags f
    WHERE f.name = 'active'
      AND EXISTS (SELECT 1 FROM profile_update)
      AND (SELECT active FROM params) IS NOT NULL
    ON CONFLICT (profile_id, flag_id, type) DO UPDATE SET 
        value = (SELECT active FROM params),
        updated_at = NOW()
),
-- Get profile with names for return
profile_with_names AS (
    SELECT 
        pu.id,
        COALESCE(
            (SELECT fnr.name FROM first_name_resource fnr WHERE EXISTS (SELECT 1 FROM first_name_resource)),
            (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = pu.id AND pn.type = 'first' LIMIT 1)
        ) as first_name,
        COALESCE(
            (SELECT lnr.name FROM last_name_resource lnr WHERE EXISTS (SELECT 1 FROM last_name_resource)),
            (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = pu.id AND pn.type = 'last' LIMIT 1)
        ) as last_name
    FROM profile_update pu
),
insert_activity AS (
    -- Insert into profile_activity if last_active is provided
    INSERT INTO profile_activity (profile_id, last_active)
    SELECT 
        pu.id,
        (SELECT last_active FROM params)
    FROM profile_update pu
    WHERE (SELECT last_active FROM params) IS NOT NULL
),
request_limit_upsert AS (
    -- Upsert request limit if provided
    INSERT INTO profile_request_limits (profile_id, requests_per_day, active)
    SELECT 
        pu.id,
        (SELECT requests_per_day FROM params),
        true
    FROM profile_update pu
    WHERE (SELECT requests_per_day FROM params) IS NOT NULL
      AND EXISTS (SELECT 1 FROM profile_update)
    ON CONFLICT (profile_id)
    DO UPDATE SET 
        requests_per_day = EXCLUDED.requests_per_day,
        active = true,
        updated_at = NOW()
),
email_update AS (
    -- Update emails if emails array is provided (comprehensive update)
    -- First deactivate all existing emails
    UPDATE profile_emails SET
        active = false,
        is_primary = false,
        updated_at = NOW()
    WHERE profile_id = (SELECT target_profile_id FROM params)
      AND EXISTS (SELECT 1 FROM profile_update)
      AND (SELECT emails FROM params) IS NOT NULL
),
all_emails_data AS (
    -- Prepare all emails with primary flag based on index
    SELECT 
        email,
        CASE WHEN ord = COALESCE((SELECT primary_email_index FROM params), 0) + 1 THEN true ELSE false END as is_primary
    FROM unnest((SELECT emails FROM params)) WITH ORDINALITY AS e(email, ord)
    WHERE (SELECT emails FROM params) IS NOT NULL
),
email_insert AS (
    -- Insert/update all emails
    INSERT INTO profile_emails (profile_id, email, is_primary, active)
    SELECT 
        pu.id,
        aed.email,
        aed.is_primary,
        true
    FROM profile_update pu
    CROSS JOIN all_emails_data aed
    WHERE (SELECT emails FROM params) IS NOT NULL
      AND EXISTS (SELECT 1 FROM profile_update)
    ON CONFLICT (email) DO UPDATE SET
        profile_id = EXCLUDED.profile_id,
        is_primary = EXCLUDED.is_primary,
        active = true,
        updated_at = NOW()
),
cohort_deactivate AS (
    -- Deactivate existing cohort relationships not in the new list (or all if empty array)
    UPDATE cohort_profiles SET
        active = false,
        updated_at = NOW()
    WHERE profile_id = (SELECT target_profile_id FROM params)
      AND EXISTS (SELECT 1 FROM profile_update)
      AND (SELECT cohort_ids FROM params) IS NOT NULL
      AND (
          array_length((SELECT cohort_ids FROM params), 1) IS NULL
          OR cohort_id NOT IN (SELECT unnest((SELECT cohort_ids FROM params)))
      )
),
cohort_insert AS (
    -- Insert or activate cohort relationships
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        cohort_id,
        pu.id,
        true
    FROM profile_update pu
    CROSS JOIN unnest((SELECT cohort_ids FROM params)) as cohort_id
    WHERE (SELECT cohort_ids FROM params) IS NOT NULL
      AND array_length((SELECT cohort_ids FROM params), 1) > 0
      AND EXISTS (SELECT 1 FROM profile_update)
    ON CONFLICT (cohort_id, profile_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
department_deactivate_all AS (
    -- Deactivate all existing department relationships (or all if empty array)
    UPDATE profile_departments SET
        active = false,
        is_primary = false,
        updated_at = NOW()
    WHERE profile_id = (SELECT target_profile_id FROM params)
      AND EXISTS (SELECT 1 FROM profile_update)
      AND (SELECT department_ids FROM params) IS NOT NULL
      AND (
          array_length((SELECT department_ids FROM params), 1) IS NULL
          OR department_id NOT IN (SELECT unnest((SELECT department_ids FROM params)))
      )
),
department_insert AS (
    -- Insert or update department relationships (set primary based on index)
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active)
    SELECT 
        pu.id,
        dept.dept_id,
        (dept.ord - 1 = COALESCE((SELECT primary_department_index FROM params), 0)) as is_primary,
        true
    FROM profile_update pu
    CROSS JOIN unnest((SELECT department_ids FROM params)) WITH ORDINALITY AS dept(dept_id, ord)
    WHERE (SELECT department_ids FROM params) IS NOT NULL
      AND array_length((SELECT department_ids FROM params), 1) > 0
      AND EXISTS (SELECT 1 FROM profile_update)
    ON CONFLICT (profile_id, department_id) DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        active = true,
        updated_at = NOW()
)
-- Return profile info (always returns a row if profile exists)
SELECT 
    pec.profile_exists::boolean as profile_exists,
    pwn.id as profile_id,
    pwn.first_name,
    pwn.last_name,
    COALESCE(pwn.first_name || ' ' || pwn.last_name, pwn.first_name, pwn.last_name, '') as name,
    ap.actor_name
FROM profile_exists_check pec
CROSS JOIN actor_profile ap
LEFT JOIN profile_with_names pwn ON pec.profile_exists = true
LIMIT 1
$$;