-- Update profile with optional fields and activity tracking in a single transaction
-- Parameters: $1=profileId, $2=first_name (nullable text), $3=last_name (nullable text), $4=last_login (nullable timestamp with time zone), $5=role (nullable profile_role), $6=active (nullable bool), $7=viewed_intro (nullable bool), $8=viewed_chat (nullable bool), $9=unused (placeholder, req_per_day stored in separate table), $10=last_active (nullable timestamp with time zone)
-- Returns: Updated profile with all fields
-- Note: NULL parameters mean "don't update this field" (use COALESCE to keep existing value)
-- last_active is handled separately via profile_activity table
WITH resolve_profile_id AS (
    -- Resolve "guest-profile-id" to actual default guest profile ID
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT id::text FROM profiles WHERE role = 'guest' AND default_profile = true LIMIT 1)
            ELSE $1::text
        END as resolved_profile_id
),
profile_exists AS (
    -- Check if profile exists
    SELECT id::uuid
    FROM profiles
    WHERE id = (SELECT resolved_profile_id::uuid FROM resolve_profile_id)
),
update_profile AS (
    -- Update profile fields (only update non-NULL parameters, keep existing values for NULL)
    UPDATE profiles
    SET 
        first_name = COALESCE($2::text, first_name),
        last_name = COALESCE($3::text, last_name),
        last_login = COALESCE($4::timestamp with time zone, last_login),
        role = COALESCE($5::profile_role, role),
        active = COALESCE($6::bool, active),
        viewed_intro = COALESCE($7::bool, viewed_intro),
        viewed_chat = COALESCE($8::bool, viewed_chat),
        updated_at = NOW()
    WHERE id IN (SELECT id FROM profile_exists)
      -- Dummy check for $9 to help PostgreSQL infer type (req_per_day not used here, always true)
      AND ($9::int IS NULL OR $9::int IS NOT NULL)
    RETURNING id::text as profile_id
),
insert_activity AS (
    -- Insert into profile_activity if last_active is provided
    INSERT INTO profile_activity (profile_id, last_active)
    SELECT 
        (SELECT resolved_profile_id::uuid FROM resolve_profile_id),
        $10::timestamp with time zone
    WHERE $10 IS NOT NULL
        AND EXISTS (SELECT 1 FROM update_profile)
),
get_updated_profile AS (
    -- Get the updated profile with all related data
    SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.alias,
        p.role,
        p.active,
        p.viewed_intro,
        p.viewed_chat,
        p.default_profile,
        (SELECT requests_per_day FROM profile_request_limits WHERE profile_id = p.id AND active = true LIMIT 1) as req_per_day,
        p.last_login,
        (SELECT last_active FROM profile_activity WHERE profile_id = p.id ORDER BY created_at DESC LIMIT 1) as last_active,
        p.created_at,
        p.updated_at,
        (SELECT department_id FROM profile_departments WHERE profile_id = p.id AND is_primary = TRUE LIMIT 1) as primary_department_id
    FROM profiles p
    WHERE p.id IN (SELECT id FROM profile_exists)
)
SELECT * FROM get_updated_profile

