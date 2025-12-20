-- Get auth items (encrypted + non-encrypted) for a given auth_id
-- Joins with default settings to get values/keys
-- Returns: name, value, encrypted
-- Parameters: $1 = auth_id
WITH default_settings AS (
    SELECT s.id as settings_id
    FROM settings s
    WHERE s.active = true
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
encrypted_items AS (
    SELECT ai.name, k.key as value, ai.encrypted
    FROM auth_items ai
    JOIN setting_auth_keys sak ON sak.auth_item_id = ai.id AND sak.active = true
    JOIN default_settings ds ON sak.settings_id = ds.settings_id
    JOIN keys k ON k.id = sak.key_id AND k.active = true
    WHERE ai.auth_id = $1 AND ai.encrypted = true
),
non_encrypted_items AS (
    SELECT ai.name, sav.value, ai.encrypted
    FROM auth_items ai
    JOIN setting_auth_values sav ON sav.auth_item_id = ai.id
    JOIN default_settings ds ON sav.settings_id = ds.settings_id
    WHERE ai.auth_id = $1 AND ai.encrypted = false
)
SELECT name, value, encrypted 
FROM encrypted_items
UNION ALL
SELECT name, value, encrypted 
FROM non_encrypted_items
ORDER BY name;

