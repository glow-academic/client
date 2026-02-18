-- Create staff profile with validation and department insert in single query (DHH style)
-- Parameters: $1=profile_id (uuid), $2=first_name, $3=last_name, $4=alias, $5=role,
--             $6=active, $7=default_profile, $8=viewed_intro, $9=viewed_chat, $10=department_id (uuid, nullable)
-- Returns: id, first_name, last_name, alias_exists (boolean)

WITH alias_check AS (
    -- Check if alias already exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE alias = $4) as alias_exists
),
profile_insert AS (
    -- Insert profile (only if alias doesn't exist)
    INSERT INTO profiles (
        id, first_name, last_name, alias, role, active,
        default_profile, viewed_intro, viewed_chat
    )
    SELECT
        $1::uuid, $2, $3, $4, $5, $6,
        $7, $8, $9
    WHERE NOT EXISTS (SELECT 1 FROM alias_check WHERE alias_exists = true)
    RETURNING id, first_name, last_name
),
resolved_department AS (
    -- Use provided department_id, or fall back to the default guest profile's department
    SELECT COALESCE(
        $10::uuid,
        (SELECT pd.department_id FROM profile_departments pd
         JOIN profiles p ON p.id = pd.profile_id
         WHERE p.role = 'guest' AND p.default_profile = true AND pd.is_primary = true
         LIMIT 1)
    ) AS department_id
),
department_insert AS (
    -- Insert department relationship if resolved and profile was created
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active)
    SELECT
        pi.id, rd.department_id, true, true
    FROM profile_insert pi, resolved_department rd
    WHERE rd.department_id IS NOT NULL
    ON CONFLICT (profile_id, department_id) DO NOTHING
),
rate_limit_insert AS (
    -- Set default rate limit for guest profiles (25 requests/day)
    INSERT INTO profile_request_limits (profile_id, requests_per_day, active)
    SELECT pi.id, 25, true
    FROM profile_insert pi
    WHERE $5 = 'guest'
    ON CONFLICT (profile_id) DO NOTHING
)
-- Return profile info and alias check result (always returns a row)
SELECT
    pi.id,
    pi.first_name,
    pi.last_name,
    ac.alias_exists
FROM alias_check ac
LEFT JOIN profile_insert pi ON true
LIMIT 1

