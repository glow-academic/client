BEGIN;
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
    SELECT DISTINCT s.id as settings_id
    FROM settings s
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE (api_get_auth_items_v4.department_id IS NOT NULL AND ds.department_id = api_get_auth_items_v4.department_id)
      AND s.active = true
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
-- Try department-specific settings first
dept_encrypted_items AS (
    SELECT ai.name, k.key as value, ai.encrypted
    FROM auth_items ai
    JOIN setting_auth_keys sak ON sak.auth_item_id = ai.id AND sak.active = true
    JOIN dept_settings ds ON sak.settings_id = ds.settings_id
    JOIN keys k ON k.id = sak.key_id AND k.active = true
    WHERE ai.auth_id = api_get_auth_items_v4.auth_id AND ai.encrypted = true
),
-- Fall back to default settings if department-specific has no keys
default_encrypted_items AS (
    SELECT ai.name, k.key as value, ai.encrypted
    FROM auth_items ai
    JOIN setting_auth_keys sak ON sak.auth_item_id = ai.id AND sak.active = true
    JOIN default_settings ds ON sak.settings_id = ds.settings_id
    JOIN keys k ON k.id = sak.key_id AND k.active = true
    WHERE ai.auth_id = api_get_auth_items_v4.auth_id 
      AND ai.encrypted = true
      -- Only use default if department-specific didn't have this key
      AND NOT EXISTS (
          SELECT 1 FROM dept_encrypted_items dei 
          WHERE dei.name = ai.name
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
    SELECT ai.name, sav.value, ai.encrypted
    FROM auth_items ai
    JOIN setting_auth_values sav ON sav.auth_item_id = ai.id
    JOIN dept_settings ds ON sav.settings_id = ds.settings_id
    WHERE ai.auth_id = api_get_auth_items_v4.auth_id AND ai.encrypted = false
),
default_non_encrypted_items AS (
    SELECT ai.name, sav.value, ai.encrypted
    FROM auth_items ai
    JOIN setting_auth_values sav ON sav.auth_item_id = ai.id
    JOIN default_settings ds ON sav.settings_id = ds.settings_id
    WHERE ai.auth_id = api_get_auth_items_v4.auth_id 
      AND ai.encrypted = false
      AND NOT EXISTS (
          SELECT 1 FROM dept_non_encrypted_items dni 
          WHERE dni.name = ai.name
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
COMMIT;

