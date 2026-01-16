DROP FUNCTION IF EXISTS api_get_auth_items_v4(uuid, uuid);
CREATE OR REPLACE FUNCTION api_get_auth_items_v4(
    auth_id uuid,
    department_id uuid
)
RETURNS TABLE (
    name text,
    value text,
    encrypted boolean
)
LANGUAGE sql
STABLE
AS $$
WITH dept_settings AS (
    -- Get department-specific settings if department_id provided
    SELECT DISTINCT s.setting_id as settings_id
    FROM settings_resource s
    JOIN department_settings ds ON ds.settings_id = s.setting_id AND ds.active = true
    WHERE (api_get_auth_items_v4.department_id IS NOT NULL AND ds.department_id = api_get_auth_items_v4.department_id)
      AND s.active = true
),
default_settings AS (
    -- Get default settings (no department links)
    SELECT s.setting_id as settings_id
    FROM settings_resource s
    WHERE s.active = true
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.setting_id AND sd.active = true
      )
    LIMIT 1
),
-- Try department-specific settings first
dept_encrypted_items AS (
    SELECT i.name, kr.key as value, i.encrypted
    FROM auth_items ai_j
    JOIN items_resource i ON i.id = ai_j.item_id
    JOIN setting_auth_keys sak ON sak.auth_item_id = i.id AND sak.active = true
    JOIN dept_settings ds ON sak.settings_id = ds.settings_id
    JOIN keys_resource kr ON kr.id = sak.key_id AND EXISTS (SELECT 1 FROM key_flags kf WHERE kf.key_id = kr.id AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
    WHERE ai_j.auth_id = api_get_auth_items_v4.auth_id AND i.encrypted = true
),
-- Fall back to default settings if department-specific has no keys
default_encrypted_items AS (
    SELECT i.name, kr.key as value, i.encrypted
    FROM auth_items ai_j
    JOIN items_resource i ON i.id = ai_j.item_id
    JOIN setting_auth_keys sak ON sak.auth_item_id = i.id AND sak.active = true
    JOIN default_settings ds ON sak.settings_id = ds.settings_id
    JOIN keys_resource kr ON kr.id = sak.key_id AND EXISTS (SELECT 1 FROM key_flags kf WHERE kf.key_id = kr.id AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
    WHERE ai_j.auth_id = api_get_auth_items_v4.auth_id 
      AND i.encrypted = true
      -- Only use default if department-specific didn't have this key
      AND NOT EXISTS (
          SELECT 1 FROM dept_encrypted_items dei 
          WHERE dei.name = i.name
      )
),
-- Combine encrypted items (dept first, then default fallback)
encrypted_items AS (
    SELECT name, value, encrypted FROM dept_encrypted_items
    UNION ALL
    SELECT name, value, encrypted FROM default_encrypted_items
),
-- Same logic for non-encrypted items
dept_non_encrypted_items AS (
    SELECT i.name, sav.value, i.encrypted
    FROM auth_items ai_j
    JOIN items_resource i ON i.id = ai_j.item_id
    JOIN setting_auth_values sav ON sav.auth_item_id = i.id
    JOIN dept_settings ds ON sav.settings_id = ds.settings_id
    WHERE ai_j.auth_id = api_get_auth_items_v4.auth_id AND i.encrypted = false
),
default_non_encrypted_items AS (
    SELECT i.name, sav.value, i.encrypted
    FROM auth_items ai_j
    JOIN items_resource i ON i.id = ai_j.item_id
    JOIN setting_auth_values sav ON sav.auth_item_id = i.id
    JOIN default_settings ds ON sav.settings_id = ds.settings_id
    WHERE ai_j.auth_id = api_get_auth_items_v4.auth_id 
      AND i.encrypted = false
      AND NOT EXISTS (
          SELECT 1 FROM dept_non_encrypted_items dni 
          WHERE dni.name = i.name
      )
),
non_encrypted_items AS (
    SELECT name, value, encrypted FROM dept_non_encrypted_items
    UNION ALL
    SELECT name, value, encrypted FROM default_non_encrypted_items
)
SELECT name, value, encrypted 
FROM encrypted_items
UNION ALL
SELECT name, value, encrypted 
FROM non_encrypted_items
ORDER BY name
$$;