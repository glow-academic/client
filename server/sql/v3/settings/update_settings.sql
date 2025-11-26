-- Update settings: deactivate current active row, insert new active row
-- Parameters: 
--   $1 = organization_name (text)
--   $2 = organization_description (text)
--   $3 = primary_color (text)
--   $4 = accent (text)
--   $5 = background (text)
--   $6 = surface (text)
--   $7 = success (text)
--   $8 = warning (text)
--   $9 = error (text)
--   $10 = sidebar_background (text)
--   $11 = sidebar_primary (text)
--   $12 = chart1 (text)
--   $13 = chart2 (text)
--   $14 = chart3 (text)
--   $15 = chart4 (text)
--   $16 = chart5 (text)
--   $17 = guest_login_enabled (boolean)
--   $18 = success_threshold (integer)
--   $19 = warning_threshold (integer)
--   $20 = danger_threshold (integer)
--   $21 = profile_id (uuid or "guest-profile-id")
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $21::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $21::text IS NULL OR $21::text = '' THEN NULL::uuid
            ELSE $21::uuid
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
    INSERT INTO settings (
        active,
        organization_name,
        organization_description,
        primary_color,
        accent,
        background,
        surface,
        success,
        warning,
        error,
        sidebar_background,
        sidebar_primary,
        chart1,
        chart2,
        chart3,
        chart4,
        chart5,
        guest_login_enabled,
        success_threshold,
        warning_threshold,
        danger_threshold
    )
    VALUES (
        true,
        $1::text,
        $2::text,
        $3::text,
        $4::text,
        $5::text,
        $6::text,
        $7::text,
        $8::text,
        $9::text,
        $10::text,
        $11::text,
        $12::text,
        $13::text,
        $14::text,
        $15::text,
        $16::text,
        $17::boolean,
        $18::integer,
        $19::integer,
        $20::integer
    )
    RETURNING id::text as settings_id
)
SELECT settings_id FROM insert_new

