-- Bulk create staff profiles with validation, department inserts, and all emails in single function
-- Converted to PostgreSQL function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_bulk_create_staff_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_bulk_create_staff_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_bulk_create_staff_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_bulk_create_staff_v3_profile AS (
    first_name text,
    last_name text,
    emails text[],  -- Array of all emails
    primary_email_index integer,  -- Index in emails array for primary (defaults to 0)
    role text,
    department_ids uuid[],  -- Array of department IDs
    primary_department_index integer  -- Index in department_ids array for primary (defaults to 0, NULL if no departments)
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_bulk_create_staff_v3(
    profiles types.i_bulk_create_staff_v3_profile[],
    profile_id uuid  -- current user's profile_id for audit
)
RETURNS TABLE (
    profile_ids uuid[],
    existing_emails text[],
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        COALESCE(profiles, ARRAY[]::types.i_bulk_create_staff_v3_profile[]) AS profiles,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
profiles_expanded AS (
    -- Expand composite type array into rows with generated profile IDs
    SELECT 
        gen_random_uuid() as profile_id,
        p.first_name,
        p.last_name,
        p.emails,
        COALESCE(p.primary_email_index, 0) as primary_email_index,
        p.role,
        COALESCE(p.department_ids, ARRAY[]::uuid[]) as department_ids,
        p.primary_department_index
    FROM unnest((SELECT profiles FROM params)) as p
),
all_emails_expanded AS (
    -- Extract all emails (primary and additional) with their profile IDs
    SELECT 
        pe.profile_id,
        email_val as email,
        CASE 
            WHEN (idx - 1) = pe.primary_email_index THEN true
            ELSE false
        END as is_primary
    FROM profiles_expanded pe
    CROSS JOIN LATERAL unnest(pe.emails) WITH ORDINALITY AS t(email_val, idx)
),
primary_emails_only AS (
    -- Get primary email for each profile
    SELECT DISTINCT ON (profile_id)
        profile_id,
        email as primary_email
    FROM all_emails_expanded
    WHERE is_primary = true
),
email_check AS (
    -- Check if any emails already exist in profile_emails
    SELECT array_agg(DISTINCT pe.email) as existing_emails
    FROM profile_emails pe
    CROSS JOIN all_emails_expanded aee
    WHERE pe.email = aee.email
       AND pe.active = true
),
profiles_data AS (
    -- Prepare profile data with primary email and primary department
    SELECT 
        pe.profile_id,
        pe.first_name,
        pe.last_name,
        COALESCE(peo.primary_email, '') as primary_email,
        pe.role,
        CASE 
            WHEN pe.primary_department_index IS NOT NULL 
                 AND pe.primary_department_index >= 0 
                 AND pe.primary_department_index < array_length(pe.department_ids, 1)
            THEN pe.department_ids[pe.primary_department_index + 1]  -- PostgreSQL arrays are 1-indexed
            WHEN array_length(pe.department_ids, 1) > 0
            THEN pe.department_ids[1]  -- Default to first department
            ELSE NULL
        END as primary_department_id,
        pe.department_ids as all_department_ids
    FROM profiles_expanded pe
    LEFT JOIN primary_emails_only peo ON peo.profile_id = pe.profile_id
),
profile_insert AS (
    -- Insert all profiles (only if no emails exist)
    INSERT INTO profiles (
        id, first_name, last_name, role, active
    )
    SELECT 
        pd.profile_id,
        pd.first_name,
        pd.last_name,
        pd.role::profile_role,
        true  -- active
    FROM profiles_data pd
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE existing_emails IS NOT NULL)
    RETURNING id
),
email_insert AS (
    -- Insert all emails (primary and additional) into profile_emails
    INSERT INTO profile_emails (profile_id, email, is_primary, active)
    SELECT 
        aee.profile_id,
        aee.email,
        aee.is_primary,
        true  -- active
    FROM all_emails_expanded aee
    WHERE EXISTS (SELECT 1 FROM profile_insert pi WHERE pi.id = aee.profile_id)
      AND NOT EXISTS (
          SELECT 1 FROM profile_emails pe 
          WHERE pe.email = aee.email AND pe.active = true
      )
),
department_insert AS (
    -- Insert all department relationships (first one as primary, rest as non-primary)
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active)
    SELECT 
        pd.profile_id,
        dept_id,
        CASE 
            WHEN dept_id = pd.primary_department_id THEN true
            WHEN pd.primary_department_id IS NULL AND (ROW_NUMBER() OVER (PARTITION BY pd.profile_id ORDER BY dept_id) = 1) THEN true
            ELSE false
        END as is_primary,
        true  -- active
    FROM profiles_data pd
    CROSS JOIN unnest(pd.all_department_ids) as dept_id
    WHERE dept_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM profile_insert pi WHERE pi.id = pd.profile_id)
    ON CONFLICT (profile_id, department_id) DO NOTHING
)
-- Return created profile IDs, existing emails, and actor_name
SELECT 
    COALESCE(array_agg(pi.id ORDER BY pi.id), ARRAY[]::uuid[]) as profile_ids,
    COALESCE(ec.existing_emails, ARRAY[]::text[]) as existing_emails,
    up.actor_name::text as actor_name
FROM profile_insert pi
CROSS JOIN email_check ec
CROSS JOIN user_profile up
GROUP BY ec.existing_emails, up.actor_name
$$;

COMMIT;
