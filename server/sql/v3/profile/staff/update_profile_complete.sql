-- Update staff profile with lookup, update, department, and request limit in single query (DHH style)
-- Parameters: $1=profile_id (uuid), $2=first_name, $3=last_name, $4=email, $5=role, $6=active, 
--             $7=primary_department_id (uuid), $8=requests_per_day (int, nullable), $9=default_profile (bool)
-- Note: $4=email is now the primary email to update (replaces existing primary email)
-- Returns: id, first_name, last_name, name (concatenated)

WITH profile_check AS (
    -- Check if profile exists and get name
    SELECT 
        id,
        first_name,
        last_name,
        first_name || ' ' || last_name as name
    FROM profiles 
    WHERE id = $1::uuid
),
profile_update AS (
    -- Update profile (only if exists)
    UPDATE profiles SET
        first_name = $2,
        last_name = $3,
        role = $5,
        active = $6,
        default_profile = $9,
        updated_at = NOW()
    WHERE id = $1::uuid
        AND EXISTS (SELECT 1 FROM profile_check)
    RETURNING id, first_name, last_name
),
email_deactivate AS (
    -- Deactivate current primary email
    UPDATE profile_emails SET
        is_primary = false,
        active = false,
        updated_at = NOW()
    WHERE profile_id = $1::uuid
        AND is_primary = true
        AND EXISTS (SELECT 1 FROM profile_update)
        AND $4::text IS NOT NULL
),
email_update AS (
    -- Insert or activate new primary email
    INSERT INTO profile_emails (profile_id, email, is_primary, active)
    SELECT 
        pu.id, $4::text, true, true
    FROM profile_update pu
    WHERE $4::text IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM profile_emails WHERE email = $4::text AND active = true)
    ON CONFLICT (email) DO UPDATE SET
        profile_id = EXCLUDED.profile_id,
        is_primary = true,
        active = true,
        updated_at = NOW()
),
department_deactivate_primary AS (
    -- Deactivate current primary department (if different from new one)
    UPDATE profile_departments SET
        is_primary = false,
        updated_at = NOW()
    WHERE profile_id = $1::uuid
        AND is_primary = true
        AND EXISTS (SELECT 1 FROM profile_update)
        AND $7::uuid IS NOT NULL
        AND department_id != $7::uuid
),
department_update AS (
    -- Insert or update department relationship (set as primary)
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active)
    SELECT 
        pu.id, $7::uuid, true, true
    FROM profile_update pu
    WHERE $7::uuid IS NOT NULL
        AND EXISTS (SELECT 1 FROM profile_update)
    ON CONFLICT (profile_id, department_id) DO UPDATE SET
        is_primary = true,
        active = true,
        updated_at = NOW()
    RETURNING profile_id
),
request_limit_upsert AS (
    -- Upsert request limit if provided
    INSERT INTO profile_request_limits (profile_id, requests_per_day, active)
    SELECT 
        pu.id, $8::int, true
    FROM profile_update pu
    WHERE $8::int IS NOT NULL
        AND EXISTS (SELECT 1 FROM profile_update)
    ON CONFLICT (profile_id)
    DO UPDATE SET 
        requests_per_day = EXCLUDED.requests_per_day,
        active = true,
        updated_at = NOW()
)
-- Return profile info (always returns a row if profile exists)
SELECT 
    pc.id,
    pc.first_name,
    pc.last_name,
    pc.name
FROM profile_check pc
LIMIT 1

