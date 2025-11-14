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
department_insert AS (
    -- Insert department relationship if provided and profile was created
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active)
    SELECT 
        pi.id, $10::uuid, true, true
    FROM profile_insert pi
    WHERE $10::uuid IS NOT NULL
    ON CONFLICT (profile_id, department_id) DO NOTHING
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

