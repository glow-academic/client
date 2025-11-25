-- Create staff profile with validation and department insert in single query (DHH style)
-- Parameters: $1=profile_id (uuid), $2=first_name, $3=last_name, $4=email, $5=role, 
--             $6=active, $7=default_profile, $8=department_id (uuid, nullable)
-- Returns: id, first_name, last_name, email_exists (boolean)

WITH email_check AS (
    -- Check if email already exists in profile_emails
    SELECT EXISTS(SELECT 1 FROM profile_emails WHERE email = $4 AND active = true) as email_exists
),
profile_insert AS (
    -- Insert profile (only if email doesn't exist)
    INSERT INTO profiles (
        id, first_name, last_name, role, active, 
        default_profile
    )
    SELECT 
        $1::uuid, $2, $3, $5, $6,
        $7
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
department_insert AS (
    -- Insert department relationship if provided and profile was created
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active)
    SELECT 
        pi.id, $8::uuid, true, true
    FROM profile_insert pi
    WHERE $8::uuid IS NOT NULL
    ON CONFLICT (profile_id, department_id) DO NOTHING
)
-- Return profile info and email check result (always returns a row)
SELECT 
    pi.id,
    pi.first_name,
    pi.last_name,
    ec.email_exists
FROM email_check ec
LEFT JOIN profile_insert pi ON true
LIMIT 1

