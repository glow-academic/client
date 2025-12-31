-- Create or update staff profile with departments, cohorts, and all emails in single function
-- Converted to PostgreSQL function (single profile, called in loop for bulk)
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
        WHERE proname = 'api_upsert_staff_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_upsert_staff_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_upsert_staff_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_upsert_staff_v4_profile AS (
    first_name text,
    last_name text,
    emails text[],  -- Array of all emails
    primary_email_index integer,  -- Index in emails array for primary (defaults to 0)
    role text,
    active boolean,
    department_ids uuid[],  -- Array of department IDs
    cohort_ids uuid[]  -- Array of cohort IDs
);

-- 4) Recreate function
-- Bulk upsert function - accepts array of profiles and processes them all
CREATE OR REPLACE FUNCTION api_upsert_staff_v4(
    profiles types.i_upsert_staff_v4_profile[],  -- Array of profiles to upsert
    current_profile_id uuid  -- current user's profile_id for role validation
)
RETURNS TABLE (
    profile_ids uuid[],
    created_count integer,
    updated_count integer,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        COALESCE(profiles, ARRAY[]::types.i_upsert_staff_v4_profile[]) AS profiles,
        current_profile_id AS current_profile_id
),
profiles_expanded AS (
    -- Expand profiles array with row numbers for processing
    SELECT 
        profile_data,
        row_number() OVER () as profile_idx,
        profile_data.first_name AS first_name,
        profile_data.last_name AS last_name,
        profile_data.emails AS emails,
        COALESCE(profile_data.primary_email_index, 0) AS primary_email_index,
        profile_data.emails[COALESCE(profile_data.primary_email_index, 0) + 1] AS primary_email,  -- PostgreSQL arrays are 1-indexed
        profile_data.role AS role,
        COALESCE(profile_data.active, true) AS active,
        COALESCE(profile_data.department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(profile_data.cohort_ids, ARRAY[]::uuid[]) AS cohort_ids
    FROM params p
    CROSS JOIN LATERAL unnest(p.profiles) AS profile_data
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
    -- Validate role hierarchy for each profile
    SELECT 
        pe.profile_idx,
        pe.role as profile_role,
        CASE 
            WHEN cur.role = 'superadmin'::profile_role AND pe.role::profile_role IN ('superadmin'::profile_role, 'admin'::profile_role, 'instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'admin'::profile_role AND pe.role::profile_role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'instructional'::profile_role AND pe.role::profile_role IN ('member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'member'::profile_role AND pe.role::profile_role = 'guest'::profile_role THEN true
            ELSE false
        END as can_assign
    FROM current_user_role cur
    CROSS JOIN profiles_expanded pe
),
existing_profiles AS (
    -- Find existing profiles by email in profile_emails table
    SELECT DISTINCT ON (pe_exp.primary_email)
        pe.profile_id as id,
        pe.email,
        pe_exp.profile_idx
    FROM profiles_expanded pe_exp
    LEFT JOIN profile_emails pe ON pe.email = pe_exp.primary_email AND pe.active = true
    WHERE pe.profile_id IS NOT NULL
),
all_emails_expanded AS (
    -- Extract all emails with their ordering for all profiles
    SELECT 
        pe.profile_idx,
        email_val as email,
        CASE 
            WHEN (idx - 1) = pe.primary_email_index THEN true
            ELSE false
        END as is_primary,
        idx - 1 as email_index
    FROM profiles_expanded pe
    CROSS JOIN LATERAL unnest(pe.emails) WITH ORDINALITY AS t(email_val, idx)
),
profile_upsert_with_idx AS (
    -- Prepare profile data with existing profile IDs
    SELECT 
        pe.profile_idx,
        pe.first_name,
        pe.last_name,
        pe.role,
        pe.active,
        pe.primary_email,
        COALESCE(ep.id, gen_random_uuid()) as profile_id,
        ep.id IS NULL as will_create
    FROM profiles_expanded pe
    LEFT JOIN existing_profiles ep ON ep.profile_idx = pe.profile_idx
    WHERE EXISTS (SELECT 1 FROM role_validation rv WHERE rv.profile_idx = pe.profile_idx AND rv.can_assign = true)
),
profile_upsert AS (
    -- Insert or update profiles (only if role validation passes)
    INSERT INTO profiles (
        id, first_name, last_name, role, active, updated_at
    )
    SELECT
        pwi.profile_id,
        pwi.first_name,
        pwi.last_name,
        pwi.role::profile_role,
        pwi.active,
        NOW()
    FROM profile_upsert_with_idx pwi
    ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = CASE 
            WHEN EXISTS (SELECT 1 FROM role_validation rv JOIN profile_upsert_with_idx pwi2 ON pwi2.profile_idx = rv.profile_idx WHERE pwi2.profile_id = profiles.id AND rv.can_assign = true) 
            THEN EXCLUDED.role::profile_role
            ELSE profiles.role::profile_role
        END,
        active = EXCLUDED.active,
        updated_at = NOW()
    RETURNING id
),
profile_upsert_with_created AS (
    -- Join back to get created status
    SELECT 
        pu.id,
        pwi.will_create as created
    FROM profile_upsert pu
    JOIN profile_upsert_with_idx pwi ON pwi.profile_id = pu.id
),
email_deactivate_all AS (
    -- Deactivate all existing emails for all profiles being upserted
    UPDATE profile_emails SET
        active = false,
        updated_at = NOW()
    WHERE profile_id IN (SELECT id FROM profile_upsert)
),
email_upsert AS (
    -- Insert or update all emails for all profiles
    INSERT INTO profile_emails (profile_id, email, is_primary, active)
    SELECT 
        pu.id,
        aee.email,
        aee.is_primary,
        true
    FROM profile_upsert pu
    JOIN profile_upsert_with_idx pwi ON pwi.profile_id = pu.id
    JOIN all_emails_expanded aee ON aee.profile_idx = pwi.profile_idx
    WHERE EXISTS (SELECT 1 FROM role_validation rv WHERE rv.profile_idx = pwi.profile_idx AND rv.can_assign = true)
    ORDER BY aee.profile_idx, aee.email_index
    ON CONFLICT (profile_id, email) DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        active = true,
        updated_at = NOW()
),
dept_cleanup AS (
    -- Delete existing department relationships for all profiles
    DELETE FROM profile_departments
    WHERE profile_id IN (SELECT id FROM profile_upsert)
),
dept_insert AS (
    -- Insert department relationships (first one as primary) for all profiles
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active, created_at, updated_at)
    SELECT 
        pu.id,
        dept_id,
        (ROW_NUMBER() OVER (PARTITION BY pu.id ORDER BY dept_id) = 1) as is_primary,
        true,
        NOW(),
        NOW()
    FROM profile_upsert pu
    JOIN profile_upsert_with_idx pwi ON pwi.profile_id = pu.id
    JOIN profiles_expanded pe ON pe.profile_idx = pwi.profile_idx
    CROSS JOIN unnest(pe.department_ids) as dept_id
    WHERE cardinality(pe.department_ids) > 0
    ON CONFLICT (profile_id, department_id) DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        active = true,
        updated_at = NOW()
),
cohort_insert AS (
    -- Insert cohort relationships for all profiles
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        cohort_id,
        pu.id,
        true
    FROM profile_upsert pu
    JOIN profile_upsert_with_idx pwi ON pwi.profile_id = pu.id
    JOIN profiles_expanded pe ON pe.profile_idx = pwi.profile_idx
    CROSS JOIN unnest(pe.cohort_ids) as cohort_id
    WHERE cardinality(pe.cohort_ids) > 0
    ON CONFLICT (cohort_id, profile_id) DO UPDATE SET
        active = true
),
results AS (
    SELECT 
        ARRAY_AGG(puc.id ORDER BY puc.id) as profile_ids,
        COUNT(*) FILTER (WHERE puc.created = true)::integer as created_count,
        COUNT(*) FILTER (WHERE puc.created = false)::integer as updated_count,
        (SELECT actor_name FROM user_profile LIMIT 1) as actor_name
    FROM profile_upsert_with_created puc
)
SELECT 
    COALESCE(r.profile_ids, ARRAY[]::uuid[]) as profile_ids,
    COALESCE(r.created_count, 0) as created_count,
    COALESCE(r.updated_count, 0) as updated_count,
    COALESCE(r.actor_name, 'System') as actor_name
FROM results r
$$;

COMMIT;
