-- Update staff profile with lookup, update, department, and request limit in single query (DHH style)
-- Parameters: $1=profile_id (uuid), $2=first_name, $3=last_name, $4=email, $5=role, $6=active, 
--             $7=primary_department_id (uuid), $8=requests_per_day (int, nullable), $9=default_profile (bool),
--             $10=intro_completed (bool, nullable), $11=chat_completed (bool, nullable)
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
        email = $4,
        role = $5,
        active = $6,
        default_profile = $9,
        viewed_intro = COALESCE($10, viewed_intro),
        viewed_chat = COALESCE($11, viewed_chat),
        updated_at = NOW()
    WHERE id = $1::uuid
        AND EXISTS (SELECT 1 FROM profile_check)
    RETURNING id, first_name, last_name
),
department_update AS (
    -- Update department relationship
    UPDATE profile_departments SET
        department_id = $7::uuid,
        updated_at = NOW()
    WHERE profile_id = $1::uuid
        AND EXISTS (SELECT 1 FROM profile_update)
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

