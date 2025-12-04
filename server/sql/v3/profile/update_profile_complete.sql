-- Update profile with optional fields and activity tracking in a single transaction
-- Parameters: $1=profileId, $2=first_name (nullable text), $3=last_name (nullable text), $4=last_login (nullable timestamp with time zone), $5=role (nullable profile_role), $6=active (nullable bool), $7=unused (placeholder, req_per_day stored in separate table), $8=last_active (nullable timestamp with time zone)
-- Returns: Updated profile with all fields
-- Note: NULL parameters mean "don't update this field" (use COALESCE to keep existing value)
-- last_active is handled separately via profile_activity table
WITH resolve_profile_id AS (
    -- Resolve "guest-profile-id" to actual default guest profile ID
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT id::text FROM profiles WHERE role = 'guest' AND first_name = 'Default' ORDER BY created_at DESC LIMIT 1)
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
        updated_at = NOW()
    WHERE id IN (SELECT id FROM profile_exists)
      -- Dummy check for $7 to help PostgreSQL infer type (req_per_day not used here, always true)
      AND ($7::int IS NULL OR $7::int IS NOT NULL)
    RETURNING 
        id,
        first_name,
        last_name,
        role,
        active,
        default_profile,
        last_login,
        created_at,
        updated_at
),
insert_activity AS (
    -- Insert into profile_activity if last_active is provided
    INSERT INTO profile_activity (profile_id, last_active)
    SELECT 
        up.id,
        $8::timestamp with time zone
    FROM update_profile up
    WHERE $8::timestamp with time zone IS NOT NULL
),
get_updated_profile AS (
    -- Get the updated profile with all related data (use data directly from update_profile)
    SELECT 
        up.id,
        up.first_name,
        up.last_name,
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = up.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
        up.role,
        up.active,
        up.default_profile,
        (SELECT requests_per_day FROM profile_request_limits WHERE profile_id = up.id AND active = true LIMIT 1) as req_per_day,
        up.last_login,
        COALESCE(
            (SELECT last_active FROM profile_activity WHERE profile_id = up.id ORDER BY created_at DESC LIMIT 1),
            $8::timestamp with time zone
        ) as last_active,
        up.created_at,
        up.updated_at,
        (SELECT department_id FROM profile_departments WHERE profile_id = up.id AND is_primary = TRUE LIMIT 1) as primary_department_id
    FROM update_profile up
    LEFT JOIN profile_emails pe ON pe.profile_id = up.id AND pe.active = true
    GROUP BY up.id, up.first_name, up.last_name, up.role, up.active, 
             up.default_profile, up.last_login, up.created_at, up.updated_at
)
SELECT * FROM get_updated_profile

