-- Update settings: deactivate current active row, insert new active row
-- Parameters: 
--   $1 = primary_color (text)
--   $2 = accent (text)
--   $3 = background (text)
--   $4 = surface (text)
--   $5 = success (text)
--   $6 = warning (text)
--   $7 = error (text)
--   $8 = sidebar_background (text)
--   $9 = sidebar_primary (text)
--   $10 = chart1 (text)
--   $11 = chart2 (text)
--   $12 = chart3 (text)
--   $13 = chart4 (text)
--   $14 = chart5 (text)
--   $15 = guest_login_enabled (boolean)
--   $16 = success_threshold (integer)
--   $17 = warning_threshold (integer)
--   $18 = danger_threshold (integer)
--   $19 = profile_id (uuid or "guest-profile-id")
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $19::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $19::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $19::text IS NULL OR $19::text = '' THEN NULL::uuid
            ELSE $19::uuid
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
        $15::boolean,
        $16::integer,
        $17::integer,
        $18::integer
    )
    RETURNING id::text as settings_id
)
SELECT settings_id FROM insert_new

