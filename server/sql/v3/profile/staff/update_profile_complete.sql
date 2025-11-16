-- Update staff profile with lookup, update, department, and request limit in single query (DHH style)
-- Parameters: $1=profile_id (uuid), $2=role, $3=active, $4=department_id (uuid), 
--             $5=requests_per_day (int, nullable)
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
        role = $2,
        active = $3,
        updated_at = NOW()
    WHERE id = $1::uuid
        AND EXISTS (SELECT 1 FROM profile_check)
    RETURNING id, first_name, last_name
),
department_update AS (
    -- Update department relationship
    UPDATE profile_departments SET
        department_id = $4::uuid,
        updated_at = NOW()
    WHERE profile_id = $1::uuid
        AND EXISTS (SELECT 1 FROM profile_update)
    RETURNING profile_id
),
request_limit_upsert AS (
    -- Upsert request limit if provided
    INSERT INTO profile_request_limits (profile_id, requests_per_day, active)
    SELECT 
        pu.id, $5::int, true
    FROM profile_update pu
    WHERE $5::int IS NOT NULL
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

