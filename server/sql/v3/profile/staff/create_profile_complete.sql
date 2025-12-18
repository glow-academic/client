-- Create staff profile with validation, cohort, and department insert in single query (DHH style)
-- Parameters: $1=profile_id (uuid), $2=first_name, $3=last_name, $4=email, $5=role, 
--             $6=active, $7=cohort_ids (uuid[]), $8=department_ids (uuid[]), $9=primary_department_index (int, nullable), $10=current_profile_id (uuid)
-- Returns: id, first_name, last_name, email_exists (boolean), actor_name

WITH actor_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $10::uuid
),
email_check AS (
    -- Check if email already exists in profile_emails
    SELECT EXISTS(SELECT 1 FROM profile_emails WHERE email = $4 AND active = true) as email_exists
),
profile_insert AS (
    -- Insert profile (only if email doesn't exist)
    INSERT INTO profiles (
        id, first_name, last_name, role, active
    )
    SELECT 
        $1::uuid, $2, $3, $5, $6
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    RETURNING id, first_name, last_name
),
email_insert AS (
    -- Insert email into profile_emails (set as primary)
    INSERT INTO profile_emails (profile_id, email, is_primary, active)
    SELECT 
        pi.id, $4, true, true
    FROM profile_insert pi
    WHERE NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
),
cohort_insert AS (
    -- Insert cohort relationships if provided and profile was created
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        cohort_id,
        pi.id,
        true
    FROM profile_insert pi
    CROSS JOIN unnest($7::uuid[]) as cohort_id
    WHERE COALESCE(array_length($7::uuid[], 1), 0) > 0
        AND NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    ON CONFLICT (cohort_id, profile_id) DO NOTHING
),
department_insert AS (
    -- Insert department relationships if provided and profile was created (set primary based on index)
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active)
    SELECT 
        pi.id,
        dept.dept_id,
        (dept.ord - 1 = COALESCE($9::int, 0)) as is_primary,
        true
    FROM profile_insert pi
    CROSS JOIN unnest($8::uuid[]) WITH ORDINALITY AS dept(dept_id, ord)
    WHERE COALESCE(array_length($8::uuid[], 1), 0) > 0
        AND NOT EXISTS (SELECT 1 FROM email_check WHERE email_exists = true)
    ON CONFLICT (profile_id, department_id) DO NOTHING
)
-- Return profile info and email check result (always returns a row)
SELECT 
    pi.id,
    pi.first_name,
    pi.last_name,
    ec.email_exists,
    ap.actor_name
FROM email_check ec
CROSS JOIN actor_profile ap
LEFT JOIN profile_insert pi ON true
LIMIT 1

