-- List all auth entries with item counts and permissions
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $1::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    -- Resolve "guest-profile-id" to actual default guest profile ID
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT p.role
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
auth_item_counts AS (
    SELECT 
        auth_id,
        COUNT(*) as num_items
    FROM auth_items
    GROUP BY auth_id
),
auth_sample_items AS (
    SELECT 
        ai.auth_id,
        jsonb_agg(
            jsonb_build_object(
                'auth_item_id', ai.id::text,
                'name', ai.name,
                'description', ai.description
            ) ORDER BY ai.name
        ) as sample_items
    FROM (
        SELECT id, auth_id, name, description,
               ROW_NUMBER() OVER (PARTITION BY auth_id ORDER BY name) as rn
        FROM auth_items
    ) ai
    WHERE ai.rn <= 3
    GROUP BY ai.auth_id
)
SELECT 
    a.id as auth_id,
    a.name,
    a.description,
    a.active,
    a.updated_at,
    COALESCE(aic.num_items, 0) as num_items,
    COALESCE(asi.sample_items, '[]'::jsonb) as sample_items_json,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_delete,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_duplicate
FROM auth a
LEFT JOIN auth_item_counts aic ON aic.auth_id = a.id
LEFT JOIN auth_sample_items asi ON asi.auth_id = a.id
CROSS JOIN user_profile up
ORDER BY a.updated_at DESC NULLS LAST

