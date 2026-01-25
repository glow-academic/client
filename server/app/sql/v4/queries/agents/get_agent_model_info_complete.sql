-- Get agent's model information with proper API key resolution
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_agent_model_info_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agent_model_info_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_agent_model_info_v4(
    agent_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    model_name text,
    provider text,
    base_url text,
    api_key text
)
LANGUAGE sql
STABLE
AS $$
WITH profile_primary_department AS (
    SELECT pd.department_id
    FROM profile_departments_junction pd
    WHERE pd.profile_id = profile_id
      AND pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
default_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings_junction sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings_junction sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true) 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys_junction spk
    JOIN keys_resource kr ON kr.id = spk.key_id
    WHERE spk.active = true AND kr.active
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings_junction sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings_junction sd 
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
            (SELECT s.id FROM setting_artifact s WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true) LIMIT 1)
        ) as settings_id
)
SELECT 
    (SELECT v.value FROM model_values_junction mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) as model_name,
    COALESCE((SELECT n.name FROM model_providers_junction mp JOIN providers_resource p ON p.id = mp.providers_id JOIN provider_providers_junction ppj ON ppj.providers_id = p.id JOIN provider_artifact pr ON pr.id = ppj.provider_id JOIN provider_names_junction pn ON pn.provider_id = pr.id JOIN names_resource n ON n.id = pn.name_id WHERE mp.model_id = m.id LIMIT 1), '') as provider,
    COALESCE((SELECT e.base_url FROM model_endpoints_junction me_j JOIN endpoints_resource e ON e.id = me_j.endpoint_id WHERE me_j.model_id = m.id AND e.active = true LIMIT 1), '') as base_url,
    kr.key as api_key
FROM agent_artifact a
INNER JOIN agent_models_junction am ON am.agent_id = a.id
INNER JOIN models_resource m ON m.id = am.model_id
LEFT JOIN model_providers_junction mp ON mp.model_id = m.id
LEFT JOIN providers_resource p ON p.id = mp.providers_id
CROSS JOIN active_settings act_s
LEFT JOIN setting_provider_keys_junction spk ON spk.providers_id = p.id 
    AND spk.settings_id = act_s.settings_id 
    AND spk.active = true
LEFT JOIN keys_resource kr ON kr.id = spk.key_id AND kr.active
WHERE a.id = agent_id
  AND EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
LIMIT 1
$$;