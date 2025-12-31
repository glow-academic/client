-- Get key_id for a model using default settings (no profile)
-- Parameters: $1=model_id (uuid)
-- Returns: key_id (text)
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
active_settings AS (
    SELECT 
        COALESCE(
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM settings WHERE active = true LIMIT 1)
        ) as settings_id
)
SELECT spk.key_id::text as key_id
FROM models m
JOIN providers p ON p.id = m.provider_id
CROSS JOIN active_settings act_s
JOIN setting_provider_keys spk ON spk.provider_id = p.id 
    AND spk.settings_id = act_s.settings_id 
    AND spk.active = true
JOIN keys k ON k.id = spk.key_id AND k.active = true
WHERE m.id = $1::uuid
LIMIT 1

