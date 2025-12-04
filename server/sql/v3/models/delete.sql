-- Delete model with usage checks (personas and agents) and name fetch - returns usage counts, name, and deleted (boolean)
-- Parameters: $1 = model_id (uuid), $2 = profile_id (uuid or "guest-profile-id")
-- Returns: personas_usage_count (int), agents_usage_count (int), name (text), deleted (boolean)

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $2::uuid AND sdg.active = true
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
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
personas_usage_check AS (
    SELECT COUNT(*) as usage_count
    FROM personas
    WHERE model_id = $1
),
agents_usage_check AS (
    SELECT COUNT(*) as usage_count
    FROM agents
    WHERE model_id = $1
),
model_info AS (
    SELECT name FROM models WHERE id = $1
),
delete_result AS (
    DELETE FROM models 
    WHERE id = $1 
      AND (SELECT usage_count FROM personas_usage_check) = 0
      AND (SELECT usage_count FROM agents_usage_check) = 0
      AND EXISTS(SELECT 1 FROM model_info)
    RETURNING id
)
SELECT 
    (SELECT usage_count FROM personas_usage_check) as personas_usage_count,
    (SELECT usage_count FROM agents_usage_check) as agents_usage_count,
    (SELECT name FROM model_info) as name,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted

