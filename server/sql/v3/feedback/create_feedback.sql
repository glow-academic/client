-- Parameters: $1=type, $2=message, $3=profile_id (uuid or "guest-profile-id")
-- Returns: feedback_id, actor_name
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $3::uuid AND sdg.active = true
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
            WHEN $3::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $3::text IS NULL OR $3::text = '' THEN NULL::uuid
            ELSE $3::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        rpi.resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
new_feedback AS (
    INSERT INTO feedback (type, message, profile_id, created_at)
    SELECT 
        $1::feedback_type,
        $2,
        rpi.resolved_profile_id,
        NOW()
    FROM resolve_profile_id rpi
    WHERE rpi.resolved_profile_id IS NOT NULL
    RETURNING id as feedback_id
)
SELECT 
    nf.feedback_id,
    ap.actor_name
FROM new_feedback nf
CROSS JOIN actor_profile ap

