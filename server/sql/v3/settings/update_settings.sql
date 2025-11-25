-- Update settings: deactivate current active row, insert new active row
-- Parameters: $1 = color (text), $2 = organization_name (text), $3 = profile_id (uuid or "guest-profile-id")
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $3::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $3::text IS NULL OR $3::text = '' THEN NULL::uuid
            ELSE $3::uuid
        END as resolved_profile_id
),
deactivate_current AS (
    -- Deactivate the current active settings row
    UPDATE settings
    SET active = false
    WHERE active = true
),
insert_new AS (
    -- Insert new active settings row
    INSERT INTO settings (active, color, organization_name)
    VALUES (true, $1::text, $2::text)
    RETURNING id::text as settings_id
)
SELECT settings_id FROM insert_new

