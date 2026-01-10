-- Get all data needed to run prompt agent AND create run in single atomic transaction
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_prompt_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_prompt_run_context_and_create_run_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_prompt_run_context_and_create_run_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types for composite structures (none needed for prompt agent currently)

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_get_prompt_run_context_and_create_run_v4(
    chat_id uuid,
    profile_id uuid,
    group_id uuid DEFAULT NULL
)
RETURNS TABLE (
    chat_id text,
    chat_title text,
    trace_id text,
    attempt_id text,
    simulation_id text,
    scenario_id text,
    department_id text,
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
    agent_id text,
    profile_id text,
    req_per_day integer,
    runs_today_count bigint,
    earliest_run_created_at timestamptz,
    run_id text,
    group_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        chat_id AS chat_id,
        profile_id AS profile_id,
        group_id AS group_id
),
scenario_dept AS (
    SELECT 
        s.id as scenario_id,
        (SELECT sd.department_id FROM scenario_departments sd 
         WHERE sd.scenario_id = s.id AND sd.active = true LIMIT 1) as department_id
    FROM chat sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios s ON s.id = sc.scenario_id
    CROSS JOIN params p
    WHERE sc.id = p.chat_id
),
profile_dept AS (
    -- Get first department from profile's accessible departments
    SELECT d.id as department_id
    FROM department d
    JOIN profile_departments pd ON pd.department_id = d.id
    JOIN attempt_profiles ap ON ap.profile_id = pd.profile_id
    JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id
    CROSS JOIN params p
    WHERE ac.chat_id = p.chat_id 
      AND ap.active = true 
      AND EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = true)
    LIMIT 1
),
any_active_dept AS (
    -- Get any active department as last resort
    SELECT id as department_id
    FROM department d
    WHERE EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = TRUE)
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
profile_rate_limit AS (
    -- Get rate limit for the profile (via attempt_profiles)
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profile prof
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    CROSS JOIN params p
    WHERE prof.id = (SELECT ap.profile_id FROM attempt_profiles ap 
                  JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id 
                  CROSS JOIN params p2
                  WHERE ac.chat_id = p2.chat_id AND ap.active = true LIMIT 1)
),
runs_today AS (
    -- Count model runs for this profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM run mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    CROSS JOIN params p
    WHERE mrp.profile_id = (SELECT ap.profile_id FROM attempt_profiles ap 
                            JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id 
                            CROSS JOIN params p2
                            WHERE ac.chat_id = p2.chat_id AND ap.active = true LIMIT 1)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
profile_from_attempt AS (
    -- Get profile_id from attempt_profiles for settings resolution
    SELECT ap.profile_id
    FROM attempt_profiles ap 
    JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id 
    CROSS JOIN params p
    WHERE ac.chat_id = p.chat_id AND ap.active = true
    LIMIT 1
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
default_settings AS (
    -- Get settings with no department links (cross-department/default)
    SELECT s.id as settings_id
    FROM setting s
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
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
    FROM setting s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true) 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    -- Settings that have at least one active provider key
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys k ON k.id = spk.key_id
    WHERE spk.active = true AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
),
dept_specific_settings_with_keys AS (
    -- Department-specific settings that have keys
    SELECT s.id as settings_id
    FROM setting s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    -- Default settings that have keys
    SELECT s.id as settings_id
    FROM setting s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
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
            (SELECT id FROM setting s WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) LIMIT 1)
        ) as settings_id
),
create_group_if_needed AS (
    -- Create new group if group_id is NULL
    INSERT INTO groups (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM params p
    WHERE p.group_id IS NULL
    RETURNING id as group_id, trace_id
),
group_data AS (
    -- Use existing group if provided, otherwise use newly created group
    SELECT 
        COALESCE(
            (SELECT g.id FROM groups g CROSS JOIN params p_group WHERE g.id = p_group.group_id),
            (SELECT cg.group_id FROM create_group_if_needed cg)
        ) as group_id,
        COALESCE(
            (SELECT g.trace_id FROM groups g CROSS JOIN params p_group WHERE g.id = p_group.group_id),
            (SELECT cg.trace_id FROM create_group_if_needed cg)
        ) as trace_id
),
-- Get prompt agent (role='prompt')
prompt_agent AS (
    SELECT a.id as agent_id
    FROM agent a
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('agent' AS artifacts)
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    ORDER BY a.created_at ASC
    LIMIT 1
),
context_data AS (
    -- Get all context data (agent, model, provider, etc.)
    SELECT 
        -- Chat data
        sc.id::text as chat_id,
        sc.title as chat_title,
        g.trace_id,
        
        -- Attempt data
        sa.id::text as attempt_id,
        sa.simulation_id::text,
        
        -- Scenario data
        s.id::text as scenario_id,
        (SELECT department_id::text FROM resolved_dept) as department_id,
        
        -- Prompt agent/model data
        COALESCE(
            COALESCE(pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt),
            ''
        ) as system_prompt,
        COALESCE(mtl.temperature, 0.0) as temperature,
        mrl.reasoning_level as reasoning,
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(dp.provider::text, '') as provider,
        COALESCE(e.base_url, '') as base_url,
        k.key as api_key,
        CASE WHEN e.base_url IS NOT NULL AND e.base_url != '' THEN m.value ELSE NULL END as custom_model,
        NULL::text as provider_id,
        COALESCE(dp.provider::text, '') as provider_name,
        pa.agent_id::text as agent_id,
        
        -- Profile data (via attempt_profiles junction)
        ap.profile_id::text as profile_id,
        
        -- Rate limit data
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at

    FROM chat sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios s ON s.id = sc.scenario_id
    JOIN chat_groups cg ON cg.chat_id = sc.id
    JOIN groups g ON g.id = cg.group_id

    -- Prompt agent joins
    CROSS JOIN prompt_agent pa
    JOIN agents a ON a.id = pa.agent_id AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    LEFT JOIN agent_models am ON am.agent_id = a.id
    LEFT JOIN models m ON m.id = am.model_id
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true AND mtl.model_id = m.id
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true AND mrl.model_id = m.id
    LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id 
        AND adp_prompt.department_id = (SELECT department_id FROM resolved_dept)
        AND adp_prompt.active = true
    LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
    LEFT JOIN model_endpoints me_j ON me_j.model_id = m.id
    LEFT JOIN endpoints e ON e.id = me_j.endpoint_id AND e.active = true
    -- Get keys via settings system: provider -> active settings -> setting_provider_keys
    LEFT JOIN model_domains md_j ON md_j.model_id = m.id
    LEFT JOIN domains d ON d.id = md_j.domain_id
    LEFT JOIN domain_providers dp ON dp.domain_id = d.id
    -- Providers is now an enum, no need to join providers table
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.provider = dp.provider 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
    LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    CROSS JOIN resolved_dept
    CROSS JOIN params p_final
    WHERE sc.id = p_final.chat_id
        -- Validate rate limit: raises exception if exceeded (function returns TRUE if valid)
        AND validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
    GROUP BY sc.id, sc.title, g.trace_id,
             sa.id, sa.simulation_id,
             s.id,
             -- Prompt agent fields
             pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt, COALESCE(mtl.temperature, 0.0), mrl.reasoning_level,
             m.id, m.value, dp.provider, k.key, e.base_url, pa.agent_id, act_s.settings_id,
             -- Other fields
             ap.profile_id,
             prl.req_per_day, rt.runs_today_count, rt.earliest_run_created_at
),
create_run AS (
    -- Create run record with all junction records (atomic with context query)
    INSERT INTO run (input_tokens, output_tokens, key_id, agent_id)
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
    -- Link profile to run
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, cd.profile_id::uuid, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE cd.profile_id IS NOT NULL
    RETURNING run_id
),
link_group AS (
    -- Link run to group via group_runs junction table
    INSERT INTO group_runs (group_id, run_id, idx)
    SELECT 
        gd.group_id,
        cr.id as run_id,
        COALESCE(
            (SELECT MAX(idx) FROM group_runs WHERE group_id = gd.group_id),
            -1
        ) + 1 as idx
    FROM group_data gd
    CROSS JOIN create_run cr
    RETURNING group_id, run_id
)
SELECT 
    -- Context data
    cd.chat_id,
    cd.chat_title,
    cd.trace_id,
    cd.attempt_id,
    cd.simulation_id,
    cd.scenario_id,
    cd.department_id,
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
    cd.agent_id,
    cd.profile_id,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at,
    -- Run ID (created in same transaction)
    cr.id::text as run_id,
    -- Group ID (from groups table)
    gd.group_id
FROM context_data cd
CROSS JOIN create_run cr
CROSS JOIN group_data gd
$$;

