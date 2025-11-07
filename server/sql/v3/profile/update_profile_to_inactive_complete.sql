-- Update profile to inactive and insert activity in a single transaction
-- Parameters: $1=profile_id (uuid), $2=last_active (timestamp with time zone)
-- Returns: profile_id if updated, or no rows if profile doesn't exist
WITH update_profile AS (
    -- Update profile to inactive
    UPDATE profiles 
    SET active = false
    WHERE id = $1::uuid
    RETURNING id::text as profile_id
),
insert_activity AS (
    -- Insert activity record
    INSERT INTO profile_activity (profile_id, last_active)
    SELECT 
        up.profile_id::uuid,
        $2::timestamp with time zone
    FROM update_profile up
)
SELECT profile_id FROM update_profile

