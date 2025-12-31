-- Get agent's model information with proper API key resolution
-- Parameters: $1=agent_id (uuid), $2=profile_id (uuid, required)
-- Returns: model_name, provider, base_url, api_key
-- Uses profile's primary department to resolve settings and prioritize settings with keys
WITH profile_primary_department AS (
    SELECT pd.department_id
    FROM profile_departments pd
    WHERE pd.profile_id = $2::uuid
      AND pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
default_settings AS (
    SELECT s.id as settings_id
    FROM settings s
    WHERE s.active = true
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND s.active = true 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys k ON k.id = spk.key_id
    WHERE spk.active = true AND k.active = true
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND s.active = true AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
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
            (SELECT settings_id FROM dept_specific_settings_with_keys),
            (SELECT settings_id FROM default_settings_with_keys),
            (SELECT settings_id FROM settings_with_keys LIMIT 1),
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM settings WHERE active = true LIMIT 1)
        ) as settings_id
)
SELECT 
    m.value as model_name,
    COALESCE(p.value::text, '') as provider,
    COALESCE(me.base_url, '') as base_url,
    k.key as api_key
FROM agents a
INNER JOIN models m ON m.id = a.model_id
LEFT JOIN providers p ON p.id = m.provider_id
LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
CROSS JOIN active_settings act_s
LEFT JOIN setting_provider_keys spk ON spk.provider_id = p.id 
    AND spk.settings_id = act_s.settings_id 
    AND spk.active = true
LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
WHERE a.id = $1::uuid
  AND a.active = true
LIMIT 1

