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
    -- Get chat and related IDs (simulation derived from parent home/practice)
    SELECT
        c.id as chat_id,
        ac.attempt_id,
        COALESCE(home_sim.simulations_id, prac_sim.simulations_id) as simulation_id
    FROM chat_resolved_entry c
    JOIN attempt_chat_entry ac ON ac.chat_resolved_id = c.id
    JOIN attempt_entry a ON a.id = ac.attempt_id
    LEFT JOIN attempt_home_entry ahe ON ahe.attempt_id = a.id AND ahe.active = true
    LEFT JOIN attempt_practice_entry ape ON ape.attempt_id = a.id AND ape.active = true
    LEFT JOIN home_simulations_connection home_sim ON home_sim.home_id = ahe.home_id AND home_sim.active = true
    LEFT JOIN practice_simulations_connection prac_sim ON prac_sim.practice_id = ape.practice_id AND prac_sim.active = true
    WHERE c.id = p_chat_id
    LIMIT 1
),
-- Get OpenAI provider and API key from providers_resource via models_resource.provider_id
openai_provider AS (
    SELECT n.name as provider_name, pr.key as api_key
    FROM providers_resource pr
    JOIN provider_providers_junction ppj ON ppj.providers_id = pr.id
    JOIN provider_names_junction pnj ON pnj.provider_id = ppj.provider_id
    JOIN names_resource n ON n.id = pnj.name_id
    WHERE LOWER(n.name) = 'openai'
      AND pr.key IS NOT NULL AND pr.key != ''
    LIMIT 1
)
SELECT
    ci.chat_id,
    ci.attempt_id,
    ci.simulation_id,
    op.api_key,
    op.provider_name
FROM chat_info ci
LEFT JOIN openai_provider op ON TRUE
$$;
