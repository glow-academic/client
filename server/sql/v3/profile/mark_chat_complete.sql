-- Mark profile chat as complete with existence check in a single transaction
-- Parameters: $1=profileId (may be "guest-profile-id")
-- Returns: profile_id if updated, or no rows if profile doesn't exist
WITH resolve_profile_id AS (
    -- Resolve "guest-profile-id" to actual default guest profile ID
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT id::text FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            ELSE $1::text
        END as resolved_profile_id
),
profile_exists AS (
    -- Check if profile exists
    SELECT id
    FROM profiles
    WHERE id = (SELECT resolved_profile_id::uuid FROM resolve_profile_id)
),
update_profile AS (
    -- Update profile with viewed_chat = true only if profile exists
    UPDATE profiles 
    SET viewed_chat = true, updated_at = NOW()
    WHERE id IN (SELECT id FROM profile_exists)
    RETURNING id::text as profile_id
)
SELECT profile_id FROM update_profile

