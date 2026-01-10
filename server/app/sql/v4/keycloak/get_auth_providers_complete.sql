DROP FUNCTION IF EXISTS api_get_auth_providers_v4(uuid);
CREATE OR REPLACE FUNCTION api_get_auth_providers_v4(
    department_id uuid
)
RETURNS TABLE (
    id uuid,
    slug text,
    provider_id text,
    name text
)
LANGUAGE sql
STABLE
AS $$
WITH dept_settings AS (
    -- Get department-specific settings if department_id provided
    SELECT DISTINCT s.id as settings_id
    FROM setting s
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE (api_get_auth_providers_v4.department_id IS NOT NULL AND ds.department_id = api_get_auth_providers_v4.department_id)
      AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
    LIMIT 1
),
default_settings AS (
    -- Get default settings (no department links)
    SELECT s.id as settings_id
    FROM setting s
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
-- Check if department-specific settings has keys for any provider
dept_settings_has_keys AS (
    SELECT 
        (SELECT settings_id FROM dept_settings LIMIT 1) as settings_id,
        EXISTS (
            SELECT 1 
            FROM setting_auth_keys sak
            JOIN dept_settings ds ON ds.settings_id = sak.settings_id
            WHERE sak.active = true
        ) as has_keys
),
-- Determine which settings to use (settings-based realm selection)
selected_settings AS (
    SELECT 
        CASE 
            -- If department_id is NULL, use default settings (master realm)
            WHEN api_get_auth_providers_v4.department_id IS NULL THEN (SELECT settings_id FROM default_settings)
            -- If department-specific settings has keys, use it
            WHEN (SELECT has_keys FROM dept_settings_has_keys) = true 
                THEN (SELECT settings_id FROM dept_settings LIMIT 1)
            -- Otherwise, fallback to default settings (master realm)
            ELSE (SELECT settings_id FROM default_settings)
        END as settings_id
),
settings_auths AS (
    -- Get auths linked to the selected settings
    SELECT DISTINCT a.id
    FROM auths a
    JOIN setting_auths sa ON sa.auth_id = a.id AND sa.active = true
    JOIN selected_settings ss ON sa.settings_id = ss.settings_id
    WHERE EXISTS (SELECT 1 FROM auth_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.auth_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_auth_flags AND af.value = true)
)
-- Return providers for the selected settings
SELECT DISTINCT
    a.id, 
    (SELECT s.value FROM auth_slugs as_j JOIN slugs s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1) as slug, 
    (SELECT p.value FROM auth_protocols ap JOIN protocols p ON p.id = ap.protocol_id WHERE ap.auth_id = a.id LIMIT 1) as provider_id, 
    (SELECT n.name FROM auth_names an JOIN names n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1) 
FROM auths a
WHERE EXISTS (SELECT 1 FROM auth_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.auth_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_auth_flags AND af.value = true)
  AND EXISTS (SELECT 1 FROM settings_auths sa WHERE sa.id = a.id)
ORDER BY (SELECT s.value FROM auth_slugs as_j JOIN slugs s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1)
$$;