-- Get key_id for a model using default settings (no profile)
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_key_id_for_model_default_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_key_id_for_model_default_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_key_id_for_model_default_v4(
    model_id uuid
)
RETURNS TABLE (
    key_id text
)
LANGUAGE sql
STABLE
AS $$
WITH default_settings AS (
    SELECT s.id as settings_id
    FROM setting s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE)
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
            (SELECT id FROM setting s WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) LIMIT 1)
        ) as settings_id
)
SELECT spk.key_id::text as key_id
FROM model m
LEFT JOIN model_domains md_j ON md_j.model_id = m.id
LEFT JOIN domains d ON d.id = md_j.domain_id
LEFT JOIN domain_providers dp ON dp.domain_id = d.id
CROSS JOIN active_settings act_s
JOIN setting_provider_keys spk ON spk.provider = dp.provider 
    AND spk.settings_id = act_s.settings_id 
    AND spk.active = true
JOIN keys k ON k.id = spk.key_id AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
WHERE m.id = model_id
LIMIT 1
$$;