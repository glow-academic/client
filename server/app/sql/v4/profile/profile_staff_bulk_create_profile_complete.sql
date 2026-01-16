-- Bulk create staff profiles with validation, department inserts, and all emails in single function
-- Converted to PostgreSQL function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_bulk_create_staff_v4(uuid[], text[], text[], text[], text[], uuid[], uuid, text[], uuid[]);

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_bulk_create_staff_v4(
    profile_ids uuid[],
    first_names text[],
    last_names text[],
    primary_emails text[],
    roles text[],
    department_ids uuid[],
    profile_id uuid,  -- current user's profile_id for audit
    additional_email_profiles uuid[],  -- profile_ids for additional emails (parallel to additional_emails)
    additional_emails text[]  -- flattened array of additional emails
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
        profile_ids AS profile_ids,
        first_names AS first_names,
        last_names AS last_names,
        primary_emails AS primary_emails,
        roles AS roles,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        profile_id AS profile_id,
        COALESCE(additional_email_profiles, ARRAY[]::uuid[]) AS additional_email_profiles,
        COALESCE(additional_emails, ARRAY[]::text[]) AS additional_emails
),
user_profile AS (
    SELECT 
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' ||
            (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
email_check AS (
    -- Check if any emails already exist in profile_emails
    SELECT array_agg(DISTINCT pe.email) as existing_emails
    FROM profile_emails pe
    CROSS JOIN params p
    WHERE (pe.email = ANY(p.primary_emails) 
       OR (cardinality(p.additional_emails) > 0 AND pe.email = ANY(p.additional_emails)))
       AND pe.active = true
),
profiles_data AS (
    -- Prepare profile data using unnest (maintains parallel array relationship)
    SELECT 
        t.profile_id,
        t.first_name,
        t.last_name,
        t.email,
        t.role,
        t.dept_id
    FROM UNNEST(
        (SELECT profile_ids FROM params), 
        (SELECT first_names FROM params), 
        (SELECT last_names FROM params), 
        (SELECT primary_emails FROM params), 
        (SELECT roles FROM params),
        (SELECT department_ids FROM params)
    ) AS t(profile_id, first_name, last_name, email, role, dept_id)
),
-- Insert all unique first_names INTO names_resource table
first_names_resources AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT DISTINCT first_name, NOW(), NOW()
    FROM profiles_data
    WHERE first_name IS NOT NULL AND first_name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name
),
-- Insert all unique last_names INTO names_resource table
last_names_resources AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT DISTINCT last_name, NOW(), NOW()
    FROM profiles_data
    WHERE last_name IS NOT NULL AND last_name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name
),
profile_insert AS (
    -- Insert all profiles without first_name, last_name, active columns
    INSERT INTO profile_artifact (
        id
    )
    SELECT 
        pd.profile_id
    FROM profiles_data pd
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE existing_emails IS NOT NULL)
    RETURNING id
),
-- Insert roles via profile_roles junction
roles_resources AS (
    INSERT INTO roles_resource (role, created_at, updated_at, active, generated, mcp, call_id)
    SELECT DISTINCT pd.role::profile_role, NOW(), NOW(), true, false, false, NULL::uuid
    FROM profiles_data pd
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE existing_emails IS NOT NULL)
    ON CONFLICT (role) DO UPDATE SET updated_at = NOW()
    RETURNING id as role_id, role
),
profile_roles_insert AS (
    INSERT INTO profile_roles (profile_id, role_id, created_at, updated_at, generated, mcp)
    SELECT pd.profile_id, rr.role_id, NOW(), NOW(), false, false
    FROM profiles_data pd
    JOIN roles_resources rr ON rr.role = pd.role::profile_role
    WHERE EXISTS (SELECT 1 FROM profile_insert pi WHERE pi.id = pd.profile_id)
    RETURNING profile_id
),
-- Link profiles to first_names
link_profile_first_names AS (
    INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
    SELECT 
        pd.profile_id,
        fnr.name_id,
        'first'::type_profile_names,
        NOW(),
        NOW()
    FROM profiles_data pd
    JOIN first_names_resources fnr ON fnr.name = pd.first_name
    WHERE EXISTS (SELECT 1 FROM profile_insert pi WHERE pi.id = pd.profile_id)
      AND pd.first_name IS NOT NULL AND pd.first_name != ''
    ON CONFLICT (profile_id, name_id, type) DO UPDATE SET updated_at = NOW()
),
-- Link profiles to last_names
link_profile_last_names AS (
    INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
    SELECT 
        pd.profile_id,
        lnr.name_id,
        'last'::type_profile_names,
        NOW(),
        NOW()
    FROM profiles_data pd
    JOIN last_names_resources lnr ON lnr.name = pd.last_name
    WHERE EXISTS (SELECT 1 FROM profile_insert pi WHERE pi.id = pd.profile_id)
      AND pd.last_name IS NOT NULL AND pd.last_name != ''
    ON CONFLICT (profile_id, name_id, type) DO UPDATE SET updated_at = NOW()
),
-- Link profile active flags
link_profile_active_flags AS (
    INSERT INTO profile_flags (profile_id, flag_id, value, created_at, updated_at) SELECT pi.id,
        f.id,
        TRUE,
        NOW(),
        NOW()
    FROM profile_insert pi
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
    ON CONFLICT (profile_id, flag_id) DO UPDATE SET 
        value = TRUE,
        updated_at = NOW()
),
primary_email_insert AS (
    -- Insert all primary emails into profile_emails (set as primary)
    INSERT INTO profile_emails (profile_id, email, is_primary, active)
    SELECT 
        pd.profile_id,
        pd.email,
        true,  -- is_primary
        true   -- active
    FROM profiles_data pd
    WHERE EXISTS (SELECT 1 FROM profile_insert pi WHERE pi.id = pd.profile_id)
),
additional_emails_data AS (
    -- Prepare additional emails data using unnest
    SELECT 
        t.profile_id,
        t.email
    FROM UNNEST(
        (SELECT additional_email_profiles FROM params),
        (SELECT additional_emails FROM params)
    ) AS t(profile_id, email)
),
additional_email_insert AS (
    -- Insert all additional emails into profile_emails (set as non-primary)
    INSERT INTO profile_emails (profile_id, email, is_primary, active)
    SELECT 
        aed.profile_id,
        aed.email,
        false,  -- is_primary
        true    -- active
    FROM additional_emails_data aed
    WHERE EXISTS (SELECT 1 FROM profile_insert pi WHERE pi.id = aed.profile_id)
      AND NOT EXISTS (
          SELECT 1 FROM profile_emails pe 
          WHERE pe.email = aed.email AND pe.active = true
      )
),
department_insert AS (
    -- Insert all department relationships
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active)
    SELECT 
        pd.profile_id,
        pd.dept_id,
        true,  -- is_primary
        true  -- active
    FROM profiles_data pd
    WHERE pd.dept_id IS NOT NULL
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