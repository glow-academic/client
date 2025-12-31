-- Get active auth providers for Keycloak sync filtered by settings
-- Parameters: $1 = department_id (optional UUID, NULL for default settings)
--             Note: This is kept for backward compatibility, but logic determines settings based on keys
-- Returns: id, slug, auth_type (as provider_id), name
-- Strategy: Determine which settings has keys, then return providers for that settings
--           If department-specific settings has keys → use that settings
--           If not → use default settings (master realm)
WITH dept_settings AS (
    -- Get department-specific settings if department_id provided
    SELECT DISTINCT s.id as settings_id
    FROM settings s
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE ($1::uuid IS NOT NULL AND ds.department_id = $1::uuid)
      AND s.active = true
    LIMIT 1
),
default_settings AS (
    -- Get default settings (no department links)
    SELECT s.id as settings_id
    FROM settings s
    WHERE s.active = true
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
            WHEN $1::uuid IS NULL THEN (SELECT settings_id FROM default_settings)
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
    FROM auth a
    JOIN setting_auths sa ON sa.auth_id = a.id AND sa.active = true
    JOIN selected_settings ss ON sa.settings_id = ss.settings_id
    WHERE a.active = true
)
-- Return providers for the selected settings
SELECT DISTINCT
    a.id, 
    a.slug, 
    a.auth_type as provider_id, 
    a.name 
FROM auth a
WHERE a.active = true
  AND EXISTS (SELECT 1 FROM settings_auths sa WHERE sa.id = a.id)
ORDER BY a.slug;

