-- Delete staff profile with validation and name lookup in single query (DHH style)
-- Parameters: $1=profile_id (uuid)
-- Returns: id, first_name, last_name, name (concatenated), default_profile (boolean), deleted (boolean)

WITH profile_check AS (
    -- Check if profile exists and get details
    SELECT 
        id,
        first_name,
        last_name,
        first_name || ' ' || last_name as name,
        default_profile
    FROM profiles 
    WHERE id = $1::uuid
),
profile_delete AS (
    -- Delete profile (only if exists and not default)
    DELETE FROM profiles
    WHERE id = $1::uuid
        AND EXISTS (SELECT 1 FROM profile_check WHERE default_profile = false)
    RETURNING id, first_name, last_name, first_name || ' ' || last_name as name
)
-- Return profile info with deletion status
SELECT 
    pc.id,
    pc.first_name,
    pc.last_name,
    pc.name,
    pc.default_profile,
    CASE WHEN pd.id IS NOT NULL THEN true ELSE false END as deleted
FROM profile_check pc
LEFT JOIN profile_delete pd ON pd.id = pc.id
LIMIT 1

