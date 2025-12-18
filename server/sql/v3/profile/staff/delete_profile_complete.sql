-- Delete staff profile with validation and name lookup in single query (DHH style)
-- Parameters: $1=profile_id (uuid), $2=current_profile_id (uuid)
-- Returns: id, first_name, last_name, name (concatenated), deleted (boolean), actor_name

WITH actor_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
profile_check AS (
    -- Check if profile exists and get details
    SELECT 
        id,
        first_name,
        last_name,
        first_name || ' ' || last_name as name
    FROM profiles 
    WHERE id = $1::uuid
),
profile_delete AS (
    -- Delete profile (only if exists)
    DELETE FROM profiles
    WHERE id = $1::uuid
        AND EXISTS (SELECT 1 FROM profile_check)
    RETURNING id, first_name, last_name, first_name || ' ' || last_name as name
)
-- Return profile info with deletion status
SELECT 
    pc.id,
    pc.first_name,
    pc.last_name,
    pc.name,
    CASE WHEN pd.id IS NOT NULL THEN true ELSE false END as deleted,
    ap.actor_name
FROM profile_check pc
CROSS JOIN actor_profile ap
LEFT JOIN profile_delete pd ON pd.id = pc.id
LIMIT 1

