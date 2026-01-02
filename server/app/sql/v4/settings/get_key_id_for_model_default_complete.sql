-- Get key_id for a model using default settings (no profile)
-- Converted to PostgreSQL function

BEGIN;

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
WHERE m.id = model_id
LIMIT 1
$$;

COMMIT;

