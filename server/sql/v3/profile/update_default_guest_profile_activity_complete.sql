-- Update default guest profile activity status and insert activity in a single transaction
-- Parameters: $1=last_active (timestamp with time zone), $2=active (boolean)
-- Returns: profile_id if updated, or no rows if profile doesn't exist
WITH get_default_guest AS (
    -- Get default guest profile ID
    SELECT id::text as profile_id
    FROM profiles
    WHERE role = 'guest' AND default_profile = true
    LIMIT 1
),
update_profile AS (
    -- Update default guest profile active status
    UPDATE profiles 
    SET active = $2::bool
    WHERE id IN (SELECT profile_id::uuid FROM get_default_guest)
    RETURNING id::text as profile_id
),
insert_activity AS (
    -- Insert activity record
    INSERT INTO profile_activity (profile_id, last_active)
    SELECT 
        gdg.profile_id::uuid,
        $1::timestamp with time zone
    FROM get_default_guest gdg
)
SELECT profile_id FROM update_profile

