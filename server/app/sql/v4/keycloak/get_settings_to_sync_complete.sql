-- Get all settings that need syncing (default settings → 'master' realm + department-specific settings with keys)
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infra_get_settings_to_sync_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infra_get_settings_to_sync_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION infra_get_settings_to_sync_v4()
RETURNS TABLE (
    realm_name text
)
LANGUAGE sql
STABLE
AS $$
    -- Default settings → 'master' realm
    SELECT 'master'::text as realm_name
    WHERE EXISTS (
        SELECT 1 FROM setting_artifact s
        JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
        WHERE EXISTS (SELECT 1 FROM setting_flags sf WHERE sf.setting_id = s.id AND sf.type = 'active'::type_setting_flags AND sf.value = true)
          AND NOT EXISTS (
              SELECT 1 FROM department_settings sd 
              WHERE sd.settings_id = s.id AND sd.active = true
          )
    )
    UNION
    -- Department-specific settings with keys → use settings_id as realm
    SELECT DISTINCT s.id::text as realm_name
    FROM setting_artifact s
    JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE EXISTS (SELECT 1 FROM setting_flags sf WHERE sf.setting_id = s.id AND sf.type = 'active'::type_setting_flags AND sf.value = true)
      AND EXISTS (
          SELECT 1 FROM setting_auth_keys sak
          WHERE sak.settings_id = s.id AND sak.active = true
      );
$$;
