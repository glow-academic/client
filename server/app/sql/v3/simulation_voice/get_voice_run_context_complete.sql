-- Get all data needed to run simulation voice agent
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_voice_run_context_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_voice_run_context_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_get_voice_run_context_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types for documents (composite type instead of JSONB)
CREATE TYPE types.i_get_voice_run_context_v3_document AS (
    id text,
    name text,
    url text,
    type text,
    created_at timestamptz
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_get_voice_run_context_v3(
    chat_id uuid,
    run_id uuid
)
RETURNS TABLE (
    chat_id uuid,
    chat_title text,
    created_at timestamptz,
    trace_id text,
    attempt_id uuid,
    simulation_id uuid,
    scenario_id uuid,
    problem_statement text,
    department_id uuid,
    persona_id uuid,
    persona_name text,
    system_prompt text,
    temperature float,
    reasoning text,
    voice_system_prompt text,
    voice_temperature float,
    voice_reasoning text,
    model_id uuid,
    model_name text,
    custom_model text,
    voice_model_id uuid,
    voice_model_name text,
    voice_custom_model text,
    provider_id uuid,
    provider_name text,
    base_url text,
    voice_provider_id uuid,
    voice_provider text,
    voice_base_url text,
    settings_id uuid,
    api_key text,
    voice_api_key text,
    profile_id uuid,
    agent_id uuid,
    voice_agent_id uuid,
    documents types.i_get_voice_run_context_v3_document[]
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT chat_id AS chat_id, run_id AS run_id
),
scenario_dept AS (
    SELECT 
        s.id as scenario_id,
        (SELECT sd.department_id FROM scenario_departments sd 
         WHERE sd.scenario_id = s.id AND sd.active = true LIMIT 1) as department_id
    FROM params p
    JOIN chats sc ON sc.id = p.chat_id
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios s ON s.id = sc.scenario_id
),
profile_dept AS (
    -- Get first department from profile's accessible departments
    SELECT d.id as department_id
    FROM params p
    JOIN departments d ON d.active = true
    JOIN profile_departments pd ON pd.department_id = d.id
    JOIN attempt_profiles ap ON ap.profile_id = pd.profile_id
    JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id
    WHERE ac.chat_id = p.chat_id 
      AND ap.active = true
    LIMIT 1
),
any_active_dept AS (
    -- Get any active department as last resort
    SELECT id as department_id
    FROM departments
    WHERE active = true
    LIMIT 1
),
resolved_dept AS (
    -- Resolve department_id with fallback: scenario -> profile -> any active
    SELECT COALESCE(
        (SELECT department_id FROM scenario_dept),
        (SELECT department_id FROM profile_dept),
        (SELECT department_id FROM any_active_dept)
    ) as department_id
),
profile_from_attempt AS (
    -- Get profile_id from attempt_profiles for settings resolution
    SELECT ap.profile_id
    FROM params p
    JOIN attempt_chats ac ON ac.chat_id = p.chat_id
    JOIN attempt_profiles ap ON ap.attempt_id = ac.attempt_id
    WHERE ap.active = true
    LIMIT 1
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
default_settings AS (
    -- Get settings with no department links (cross-department/default)
    SELECT s.id as settings_id
    FROM settings s
    WHERE s.active = true
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
profile_primary_department AS (
    -- Get profile's primary department ID
    SELECT pd.department_id
    FROM profile_from_attempt pfa
    JOIN profile_departments pd ON pd.profile_id = pfa.profile_id
    WHERE pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
dept_specific_settings AS (
    -- Get department-specific settings (if primary_department_id exists)
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE s.active = true 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    -- Settings that have at least one active provider key
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys k ON k.id = spk.key_id
    WHERE spk.active = true AND k.active = true
),
dept_specific_settings_with_keys AS (
    -- Department-specific settings that have keys
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE s.active = true AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    -- Default settings that have keys
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
    -- Prefer department-specific with keys, then default with keys, then any with keys, then fallback
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings_with_keys),
            (SELECT settings_id FROM default_settings_with_keys),
            (SELECT settings_id FROM settings_with_keys LIMIT 1),
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM settings WHERE active = true LIMIT 1)
        ) as settings_id
),
documents_data AS (
    -- Get documents as composite type array
    SELECT 
        s.id as scenario_id,
        COALESCE(
            ARRAY_AGG(
                (d.id::text, d.name, COALESCE(u.file_path, ''), COALESCE(u.mime_type, ''), d.created_at)::types.i_get_voice_run_context_v3_document
                ORDER BY d.created_at
            ) FILTER (WHERE d.id IS NOT NULL AND sd.active = true AND d.active = true),
            ARRAY[]::types.i_get_voice_run_context_v3_document[]
        ) as documents
    FROM params p
    JOIN chats sc ON sc.id = p.chat_id
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios s ON s.id = sc.scenario_id
    LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
    LEFT JOIN documents d ON d.id = sd.document_id
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    GROUP BY s.id
)
SELECT 
    -- Chat data
    sc.id as chat_id,
    sc.title as chat_title,
    sc.created_at,
    COALESCE(g.trace_id, '') as trace_id,
    -- Attempt data
    sa.id as attempt_id,
    sa.simulation_id,
    -- Scenario data
    s.id as scenario_id,
    COALESCE(ps.problem_statement, '') as problem_statement,
    (SELECT department_id FROM resolved_dept) as department_id,
    -- Persona data (text fields - kept for compatibility)
    -- Get persona from scenario_personas (chats don't have persona_id directly)
    (SELECT p_persona.id FROM scenario_personas sp 
     JOIN personas p_persona ON p_persona.id = sp.persona_id 
     WHERE sp.scenario_id = s.id AND sp.active = true AND p_persona.active = true 
     LIMIT 1) as persona_id,
    (SELECT p_persona.name FROM scenario_personas sp 
     JOIN personas p_persona ON p_persona.id = sp.persona_id 
     WHERE sp.scenario_id = s.id AND sp.active = true AND p_persona.active = true 
     LIMIT 1) as persona_name,
    -- Persona fields not available directly from personas table (return NULL for compatibility)
    NULL::text as system_prompt,
    NULL::float as temperature,
    NULL::text as reasoning,
    -- Voice persona fields (preferred for voice mode) - not available from personas table
    NULL::text as voice_system_prompt,
    NULL::float as voice_temperature,
    NULL::text as voice_reasoning,
    -- Model data (text fields - kept for compatibility) - personas table doesn't have model_id anymore
    NULL::uuid as model_id,
    NULL::text as model_name,
    NULL::text as custom_model,
    -- Voice model fields (preferred for voice mode) - personas table doesn't have voice_model_id anymore
    NULL::uuid as voice_model_id,
    NULL::text as voice_model_name,
    NULL::text as voice_custom_model,
    -- Provider data (text fields - kept for compatibility) - not available from personas
    NULL::uuid as provider_id,
    NULL::text as provider_name,
    NULL::text as base_url,
    -- Voice provider fields (preferred for voice mode) - not available from personas
    NULL::uuid as voice_provider_id,
    NULL::text as voice_provider,
    NULL::text as voice_base_url,
    -- Settings data (for API keys)
    st.id as settings_id,
    -- API keys (text - kept for compatibility) - not available from personas
    NULL::text as api_key,
    -- Voice API keys (preferred for voice mode) - not available from personas
    NULL::text as voice_api_key,
    -- Profile data
    pf.profile_id,
    -- Agent data (text - kept for compatibility)
    sim.simulation_text_agent_id as agent_id,
    -- Voice agent data (preferred for voice mode)
    sim.simulation_voice_agent_id as voice_agent_id,
    -- Documents data (composite type array)
    COALESCE(dd.documents, ARRAY[]::types.i_get_voice_run_context_v3_document[]) as documents
FROM params p_params
JOIN chats sc ON sc.id = p_params.chat_id
JOIN attempt_chats ac ON ac.chat_id = sc.id
INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
INNER JOIN scenarios s ON s.id = sc.scenario_id
INNER JOIN simulations sim ON sim.id = sa.simulation_id
LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
LEFT JOIN chat_groups cg ON cg.chat_id = sc.id
LEFT JOIN groups g ON g.id = cg.group_id
LEFT JOIN active_settings ast ON true
LEFT JOIN settings st ON st.id = ast.settings_id
LEFT JOIN profile_from_attempt pf ON true
LEFT JOIN documents_data dd ON dd.scenario_id = s.id
WHERE sc.id = p_params.chat_id
LIMIT 1
$$;

COMMIT;
