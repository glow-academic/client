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
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf WHERE sf.setting_id = s.id AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE)
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
            (SELECT id FROM setting_artifact s WHERE EXISTS (SELECT 1 FROM setting_flags sf WHERE sf.setting_id = s.id AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) LIMIT 1)
        ) as settings_id
)
SELECT spk.key_id::text as key_id
FROM model_artifact m
LEFT JOIN model_providers mp ON mp.model_id = m.id
LEFT JOIN providers_resource p_prov ON p_prov.id = mp.providers_id
CROSS JOIN active_settings act_s
JOIN setting_provider_keys spk ON spk.providers_id = p_prov.id 
    AND spk.settings_id = act_s.settings_id 
    AND spk.active = true
JOIN keys k ON k.id = spk.key_id AND EXISTS (SELECT 1 FROM key_flags kf WHERE kf.key_id = k.id AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
WHERE m.id = model_id
LIMIT 1
$$;