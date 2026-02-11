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
    FROM setting_artifact s
    JOIN department_settings_junction ds ON ds.settings_id = s.id AND ds.active = true
    WHERE (api_get_auth_items_v4.department_id IS NOT NULL AND ds.department_id = api_get_auth_items_v4.department_id)
      AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true)
),
default_settings AS (
    -- Get default settings (no department links)
    SELECT s.id as settings_id
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings_junction sd
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
-- Map auth_artifact.id -> auths_resource.id via auth_auths_junction
auth_resource_mapping AS (
    SELECT aaj.auths_id as auths_resource_id
    FROM auth_auths_junction aaj
    WHERE aaj.auth_id = api_get_auth_items_v4.auth_id
    LIMIT 1
),
-- Try department-specific settings first
dept_encrypted_items AS (
    SELECT DISTINCT ON (i.name) i.name, kr.key as value, i.encrypted
    FROM auth_items_junction ai_j
    JOIN items_resource i ON i.id = ai_j.item_id
    JOIN auth_resource_mapping arm ON true
    JOIN setting_auth_item_keys_junction sak ON sak.active = true
    JOIN dept_settings ds ON sak.setting_id = ds.settings_id
    JOIN auth_item_keys_resource akr ON akr.id = sak.auth_item_keys_id AND akr.active = true
    JOIN keys_resource kr ON kr.id = akr.key_id AND kr.active
    WHERE ai_j.auth_id = api_get_auth_items_v4.auth_id AND i.encrypted = true
      AND akr.auth_id = arm.auths_resource_id
      AND akr.item_id = ai_j.item_id
    ORDER BY i.name, kr.created_at DESC
),
-- Fall back to default settings if department-specific has no keys
default_encrypted_items AS (
    SELECT DISTINCT ON (i.name) i.name, kr.key as value, i.encrypted
    FROM auth_items_junction ai_j
    JOIN items_resource i ON i.id = ai_j.item_id
    JOIN auth_resource_mapping arm ON true
    JOIN setting_auth_item_keys_junction sak ON sak.active = true
    JOIN default_settings ds ON sak.setting_id = ds.settings_id
    JOIN auth_item_keys_resource akr ON akr.id = sak.auth_item_keys_id AND akr.active = true
    JOIN keys_resource kr ON kr.id = akr.key_id AND kr.active
    WHERE ai_j.auth_id = api_get_auth_items_v4.auth_id
      AND i.encrypted = true
      AND akr.auth_id = arm.auths_resource_id
      AND akr.item_id = ai_j.item_id
      -- Only use default if department-specific didn't have this key
      AND NOT EXISTS (
          SELECT 1 FROM dept_encrypted_items dei
          WHERE dei.name = i.name
      )
    ORDER BY i.name, kr.created_at DESC
),
-- Combine encrypted items (dept first, then default fallback)
encrypted_items AS (
    SELECT name, value, encrypted FROM dept_encrypted_items
    UNION ALL
    SELECT name, value, encrypted FROM default_encrypted_items
),
-- Same logic for non-encrypted items
dept_non_encrypted_items AS (
    SELECT DISTINCT ON (i.name) i.name, sav.value, i.encrypted
    FROM auth_items_junction ai_j
    JOIN items_resource i ON i.id = ai_j.item_id
    JOIN setting_auth_values_junction sav ON sav.auth_item_id = i.id
    JOIN dept_settings ds ON sav.settings_id = ds.settings_id
    WHERE ai_j.auth_id = api_get_auth_items_v4.auth_id AND i.encrypted = false
    ORDER BY i.name, sav.created_at DESC
),
default_non_encrypted_items AS (
    SELECT DISTINCT ON (i.name) i.name, sav.value, i.encrypted
    FROM auth_items_junction ai_j
    JOIN items_resource i ON i.id = ai_j.item_id
    JOIN setting_auth_values_junction sav ON sav.auth_item_id = i.id
    JOIN default_settings ds ON sav.settings_id = ds.settings_id
    WHERE ai_j.auth_id = api_get_auth_items_v4.auth_id
      AND i.encrypted = false
      AND NOT EXISTS (
          SELECT 1 FROM dept_non_encrypted_items dni
          WHERE dni.name = i.name
      )
    ORDER BY i.name, sav.created_at DESC
),
non_encrypted_items AS (
    SELECT name, value, encrypted FROM dept_non_encrypted_items
    UNION ALL
    SELECT name, value, encrypted FROM default_non_encrypted_items
)
SELECT DISTINCT ON (name) name, value, encrypted
FROM (
    SELECT name, value, encrypted FROM encrypted_items
    UNION ALL
    SELECT name, value, encrypted FROM non_encrypted_items
) combined_items
ORDER BY name, encrypted DESC
$$;
