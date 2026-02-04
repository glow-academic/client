-- Get voice session context for a chat
-- Returns API key needed to start a realtime voice session
-- MVP version: just gets OpenAI API key from settings

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_voice_session_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_voice_session_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_get_voice_session_context_v4(
    p_profile_id uuid,
    p_chat_id uuid
)
RETURNS TABLE (
    -- Chat info
    chat_id uuid,
    attempt_id uuid,
    simulation_id uuid,

    -- API key (from OpenAI provider in settings)
    api_key text,
    provider_name text
)
LANGUAGE sql
STABLE
AS $$
WITH chat_info AS (
    -- Get chat and related IDs
    SELECT
        c.id as chat_id,
        c.attempt_id,
        sas.simulations_id as simulation_id
    FROM simulation_chats_entry c
    JOIN simulation_attempts_simulations_connection sas ON sas.attempt_id = c.attempt_id AND sas.active = true
    WHERE c.id = p_chat_id
    LIMIT 1
),
-- Get profile's primary department for settings resolution
profile_primary_department AS (
    SELECT pd.department_id
    FROM profile_departments_junction pd
    WHERE pd.profile_id = p_profile_id
      AND pd.is_primary = TRUE
      AND pd.active = true
    LIMIT 1
),
-- Get OpenAI provider ID (for Realtime API)
openai_provider AS (
    SELECT p.id as providers_id, n.name as provider_name
    FROM providers_resource p
    JOIN provider_providers_junction ppj ON ppj.providers_id = p.id
    JOIN provider_artifact pa ON pa.id = ppj.provider_id
    JOIN provider_names_junction pnj ON pnj.provider_id = pa.id
    JOIN names_resource n ON n.id = pnj.name_id
    WHERE LOWER(n.name) = 'openai'
    LIMIT 1
),
-- Get active settings with OpenAI key
active_settings_with_key AS (
    SELECT
        s.id as settings_id,
        kr.key as api_key
    FROM setting_artifact s
    JOIN setting_provider_keys_junction spk ON spk.settings_id = s.id AND spk.active = true
    JOIN keys_resource kr ON kr.id = spk.key_id AND kr.active
    CROSS JOIN openai_provider op
    WHERE spk.providers_id = op.providers_id
      AND EXISTS (
          SELECT 1 FROM setting_flags_junction sf
          JOIN flags_resource f ON sf.flag_id = f.id
          WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true
      )
    -- Prefer department-specific settings
    ORDER BY
        CASE WHEN EXISTS (
            SELECT 1 FROM department_settings_junction ds
            JOIN profile_primary_department ppd ON ds.department_id = ppd.department_id
            WHERE ds.settings_id = s.id AND ds.active = true
        ) THEN 0 ELSE 1 END
    LIMIT 1
)
SELECT
    ci.chat_id,
    ci.attempt_id,
    ci.simulation_id,
    ask.api_key,
    op.provider_name
FROM chat_info ci
LEFT JOIN active_settings_with_key ask ON TRUE
LEFT JOIN openai_provider op ON TRUE
$$;
