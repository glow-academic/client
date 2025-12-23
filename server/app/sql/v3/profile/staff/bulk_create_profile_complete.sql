-- Bulk create staff profiles with validation and department inserts in single query (DHH style)
-- Parameters: $1=profile_ids (uuid[]), $2=first_names (text[]), $3=last_names (text[]), 
--             $4=emails (text[]), $5=roles (text[]), $6=department_ids (uuid[], nullable, parallel array)
-- Returns: profile_ids (uuid[]), existing_emails (text[])

WITH email_check AS (
    -- Check if any emails already exist in profile_emails
    SELECT array_agg(email) as existing_emails
    FROM profile_emails 
    WHERE email = ANY($4::text[]) AND active = true
),
profiles_data AS (
    -- Prepare profile data using unnest (maintains parallel array relationship)
    -- Note: department_ids array must match profiles array (use NULL for profiles without departments)
    SELECT 
        t.profile_id,
        t.first_name,
        t.last_name,
        t.email,
        t.role,
        t.dept_id
    FROM UNNEST(
        $1::uuid[], 
        $2::text[], 
        $3::text[], 
        $4::text[], 
        $5::text[],
        COALESCE($6::uuid[], ARRAY[]::uuid[])
    ) AS t(profile_id, first_name, last_name, email, role, dept_id)
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
    -- Insert all emails into profile_emails (set as primary)
    INSERT INTO profile_emails (profile_id, email, is_primary, active)
    SELECT 
        pd.profile_id,
        pd.email,
        true,  -- is_primary
        true   -- active
    FROM profiles_data pd
    WHERE EXISTS (SELECT 1 FROM profile_insert pi WHERE pi.id = pd.profile_id)
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
-- Return created profile IDs and existing emails
SELECT 
    COALESCE(array_agg(pi.id ORDER BY pi.id), ARRAY[]::uuid[]) as profile_ids,
    COALESCE(ec.existing_emails, ARRAY[]::text[]) as existing_emails
FROM profile_insert pi
CROSS JOIN email_check ec
GROUP BY ec.existing_emails

