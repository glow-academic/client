-- Update settings: deactivate current active row, insert new active row
-- Parameters: 
--   $1 = organization_name (text)
--   $2 = primary_color (text)
--   $3 = accent (text)
--   $4 = background (text)
--   $5 = surface (text)
--   $6 = success (text)
--   $7 = warning (text)
--   $8 = error (text)
--   $9 = sidebar_background (text)
--   $10 = sidebar_primary (text)
--   $11 = chart1 (text)
--   $12 = chart2 (text)
--   $13 = chart3 (text)
--   $14 = chart4 (text)
--   $15 = chart5 (text)
--   $16 = profile_id (uuid or "guest-profile-id")
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $16::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $16::text IS NULL OR $16::text = '' THEN NULL::uuid
            ELSE $16::uuid
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
        chart5
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
        $15::text
    )
    RETURNING id::text as settings_id
)
SELECT settings_id FROM insert_new

