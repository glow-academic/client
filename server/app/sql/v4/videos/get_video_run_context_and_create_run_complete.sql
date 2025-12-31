-- Get all data needed to run video agent AND create run in single atomic transaction
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
        WHERE proname = 'socket_get_video_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_video_run_context_and_create_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_video_run_context_and_create_run_v4(
    video_id uuid,
    profile_id uuid DEFAULT NULL
)
RETURNS TABLE (
    agent_id text,
    agent_name text,
    system_prompt text,
    temperature float,
    reasoning text,
    model_id text,
    model_name text,
    provider text,
    base_url text,
    api_key text,
    custom_model text,
    provider_id text,
    provider_name text,
    profile_id text,
    req_per_day integer,
    runs_today_count bigint,
    earliest_run_created_at timestamptz,
    department_id uuid,
    run_id text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    -- Explicitly cast parameters for asyncpg type inference
    SELECT video_id::uuid as video_id, profile_id::uuid as profile_id
),
video_department AS (
    -- Get first department_id from video_departments, or NULL if video has no department links (cross-department)
    SELECT 
        vd.department_id,
        v.id as video_id
    FROM params p
    JOIN videos v ON v.id = p.video_id
    LEFT JOIN video_departments vd ON vd.video_id = v.id AND vd.active = true
    ORDER BY vd.created_at
    LIMIT 1
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN video_department vd
    WHERE a.role = 'video'
    AND a.active = true
    AND (
        -- Include if agent is linked to the video's department
        (vd.department_id IS NOT NULL AND ad.department_id = vd.department_id)
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
        -- OR video has no department links (cross-department video)
        OR vd.department_id IS NULL
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN vd.department_id IS NOT NULL AND ad.department_id = vd.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile (or NULL if profile_id is NULL)
    SELECT 
        prl.requests_per_day as req_per_day
    FROM params p
    LEFT JOIN profiles prof ON prof.id = p.profile_id
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    WHERE p.profile_id IS NOT NULL
),
runs_today AS (
    -- Count model runs for the profile since start of day (or 0 if profile_id is NULL)
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM params p
    LEFT JOIN runs mr ON TRUE
    LEFT JOIN run_profiles mrp ON mrp.run_id = mr.id AND mrp.profile_id = p.profile_id
    WHERE p.profile_id IS NOT NULL
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
-- Use profile's primary department for settings resolution
profile_primary_department AS (
    SELECT pd.department_id
    FROM profile_departments pd
    CROSS JOIN params p
    WHERE pd.profile_id = p.profile_id
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
),
context_data AS (
    -- Get all context data (agent, model, provider, etc.)
    SELECT 
        -- Agent data
        a.id::text as agent_id,
        a.name as agent_name,
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(mtl.temperature, 0.0) as temperature,
        mrl.reasoning_level as reasoning,
        
        -- Model data
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(prov.value::text, '') as provider,
        COALESCE(me.base_url, '') as base_url,
        k.key as api_key,
        
        -- Custom model (if any) - indicated by presence of base_url in model_endpoints
        CASE WHEN me.base_url IS NOT NULL AND me.base_url != '' THEN m.value ELSE NULL END as custom_model,
        
        -- Provider data (provider enum is now on models table, no separate providers table)
        NULL::text as provider_id,
        COALESCE(prov.value::text, '') as provider_name,
        
        -- Profile data
        p.profile_id::text as profile_id,
        
        -- Rate limit data (for profile) - use COALESCE to handle NULL profile_id
        COALESCE(prl.req_per_day, 0) as req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,
        
        -- Department ID (from video_department, for agent selection)
        vd.department_id

    FROM best_agent ba
    INNER JOIN agents a ON a.id = ba.agent_id
    CROSS JOIN params p
    CROSS JOIN video_department vd
    -- Try department-specific prompt first, fall back to default prompt
    LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = vd.department_id AND adp_prompt.active = true
    LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
    -- Use department-specific prompt if available, otherwise use default
    LEFT JOIN prompts pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
    INNER JOIN models m ON m.id = a.model_id
    -- Join temperature from junction table
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true AND mtl.model_id = m.id
    -- Join reasoning from junction table
    -- IMPORTANT: Only join reasoning levels that belong to the agent's model (m.id = mrl.model_id)
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true AND mrl.model_id = m.id
    LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
    -- Get keys via settings system: provider -> active settings -> setting_provider_keys
    LEFT JOIN providers prov ON prov.id = m.provider_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.provider_id = prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
    LEFT JOIN profile_rate_limit prl ON TRUE
    LEFT JOIN runs_today rt ON TRUE
    -- Validate rate limit: raises exception if exceeded (function returns TRUE if valid)
    -- Only validate if profile_id is not NULL
    WHERE (p.profile_id IS NULL OR validate_rate_limit(COALESCE(prl.req_per_day, 0), COALESCE(rt.runs_today_count, 0)) = TRUE)
),
create_run AS (
    -- Create run record with all junction records (atomic with context query)
    INSERT INTO runs (input_tokens, output_tokens, key_id, agent_id)
    SELECT 0, 0, NULL, cd.agent_id::uuid
    FROM context_data cd
    RETURNING id
),
link_model AS (
    -- Link model to run
    INSERT INTO run_models (run_id, model_id, active)
    SELECT cr.id, cd.model_id::uuid, true
    FROM create_run cr
    CROSS JOIN context_data cd
    RETURNING run_id
),
link_profile AS (
    -- Link profile to run (only if profile_id is not NULL)
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, cd.profile_id::uuid, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE cd.profile_id IS NOT NULL
    RETURNING run_id
)
SELECT 
    -- Context data
    cd.agent_id,
    cd.agent_name,
    cd.system_prompt,
    cd.temperature,
    cd.reasoning,
    cd.model_id,
    cd.model_name,
    cd.provider,
    cd.base_url,
    cd.api_key,
    cd.custom_model,
    cd.provider_id,
    cd.provider_name,
    cd.profile_id,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at,
    cd.department_id,
    -- Run ID (created in same transaction)
    cr.id::text as run_id
FROM context_data cd
CROSS JOIN create_run cr
$$;

COMMIT;

