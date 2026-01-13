-- Get all data needed to run image regeneration agent AND create run in single atomic transaction
-- Uses existing group_id to get previous context from previous run
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
        WHERE proname = 'socket_get_image_regeneration_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_image_regeneration_run_context_and_create_run_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_image_regen_run_context_create_run_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate composite types
CREATE TYPE types.i_image_regen_run_context_create_run_v4_msg AS (
    role text,
    content text
);

-- 4) Recreate function
-- group_id is REQUIRED (not NULL) for regeneration - uses existing group
-- Gets all messages from all previous runs in the group
-- Links existing system/developer messages to the new run
CREATE OR REPLACE FUNCTION socket_get_image_regeneration_run_context_and_create_run_v4(
    image_id uuid,
    agent_id uuid,
    group_id uuid,profile_id uuid DEFAULT NULL,
    department_id uuid DEFAULT NULL,
      -- REQUIRED for regeneration (not NULL)
    user_instructions text DEFAULT NULL
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
    profile_id text,
    req_per_day integer,
    runs_today_count bigint,
    earliest_run_created_at timestamptz,
    department_id uuid,
    run_id text,
    group_id uuid,
    previous_messages types.i_image_regen_run_context_create_run_v4_msg[]  -- All messages from all previous runs in group
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        image_id::uuid as image_id,
        agent_id::uuid as agent_id,
        profile_id::uuid as profile_id,
        department_id::uuid as department_id,
        group_id::uuid as group_id,
        user_instructions::text as user_instructions
),
group_data AS (
    -- Use existing group (required for regeneration)
    SELECT 
        g.id as group_id
    FROM groups g
    CROSS JOIN params p
    WHERE g.id = p.group_id
),
previous_runs_in_group AS (
    -- Get all previous runs in the group (all runs except the one we're about to create)
    SELECT gr.run_id
    FROM group_runs gr
    CROSS JOIN params p
    WHERE gr.group_id = p.group_id
    ORDER BY gr.idx ASC  -- Order by idx to maintain chronological order
),
previous_messages_all_runs AS (
    -- Get all messages from all previous runs in the group
    -- Ordered chronologically across all runs
    SELECT 
        m.role,
        cnt.content,
        m.created_at,
        gr.idx as run_idx
    FROM previous_runs_in_group prig
    JOIN group_runs gr ON gr.run_id = prig.run_id
    JOIN message_runs mr ON mr.run_id = prig.run_id
    JOIN message m ON m.id = mr.message_id
    LEFT JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
        LEFT JOIN contents cnt ON cnt.id = mc.content_id
    ORDER BY gr.idx ASC, m.created_at ASC  -- Order by run idx first, then message created_at
),
previous_messages_array AS (
    -- Aggregate all previous messages into composite type array
    SELECT COALESCE(
        ARRAY_AGG(
            (role, content)::types.i_image_regen_run_context_create_run_v4_msg
            ORDER BY run_idx, created_at
        ),
        '{}'::types.i_image_regen_run_context_create_run_v4_msg[]
    ) as previous_messages
    FROM previous_messages_all_runs
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agent a
    CROSS JOIN params p
    WHERE a.id = p.agent_id
      AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
),
profile_rate_limit AS (
    -- Get rate limit for the profile (or NULL if profile_id is NULL)
    SELECT
        rl.requests_per_day as req_per_day
    FROM profile prof
    LEFT JOIN profile_request_limits prl
        ON prl.profile_id = prof.id AND prl.active = true
    LEFT JOIN request_limits rl ON prl.request_limit_id = rl.id
    CROSS JOIN params p
    WHERE prof.id = p.profile_id
      AND p.profile_id IS NOT NULL
),
runs_today AS (
    -- Count model runs for the profile since start of day (or 0 if profile_id is NULL)
    SELECT
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM run mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    CROSS JOIN params p
    WHERE mrp.profile_id = p.profile_id
      AND p.profile_id IS NOT NULL
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
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
    FROM setting s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM setting s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true)
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys k ON k.id = spk.key_id
    WHERE spk.active = true AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true)
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
            (SELECT s.id FROM setting s WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true) LIMIT 1)
        ) as settings_id
),
context_data AS (
    -- Get all context data (agent, model, provider, etc.)
    SELECT
        -- Agent data
        a.id::text as agent_id,
        (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(mtl.temperature, 0.0) as temperature,
        mrl.reasoning_level as reasoning,

        -- Model data
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(n_prov.name, '') as provider,
        COALESCE(e.base_url, '') as base_url,
        k.key as api_key,

        -- Profile data
        p.profile_id::text as profile_id,

        -- Rate limit data (for profile) - use COALESCE to handle NULL profile_id
        COALESCE(prl.req_per_day, 0) as req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,

        -- Department ID
        p.department_id
    FROM best_agent ba
    INNER JOIN agents a ON a.id = ba.agent_id
    CROSS JOIN params p
    -- Try department-specific prompt first, fall back to default prompt
    LEFT JOIN agent_department_prompts adp_prompt
        ON adp_prompt.agent_id = a.id
        AND adp_prompt.department_id = p.department_id
        AND adp_prompt.active = true
    LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
    LEFT JOIN prompts pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
    INNER JOIN agent_models am ON am.agent_id = a.id
    INNER JOIN models m ON m.id = am.model_id
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl
        ON mtl.id = atl.model_temperature_level_id
        AND mtl.active = true
        AND mtl.model_id = m.id
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl
        ON mrl.id = arl.model_reasoning_level_id
        AND mrl.active = true
        AND mrl.model_id = m.id
    LEFT JOIN model_endpoints me_j ON me_j.model_id = m.id
    LEFT JOIN endpoints e ON e.id = me_j.endpoint_id AND e.active = true
    LEFT JOIN model_providers mp ON mp.model_id = m.id
    LEFT JOIN providers p_prov ON p_prov.id = mp.providers_id
    LEFT JOIN provider pr_prov ON pr_prov.id = p_prov.provider_id
    LEFT JOIN provider_names pn_prov ON pn_prov.provider_id = pr_prov.id
    LEFT JOIN names n_prov ON n_prov.id = pn_prov.name_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk
        ON spk.providers_id = p_prov.id
        AND spk.settings_id = act_s.settings_id
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
    LEFT JOIN profile_rate_limit prl ON TRUE
    LEFT JOIN runs_today rt ON TRUE
    -- Validate rate limit: raises exception if exceeded (function returns TRUE if valid)
    -- Only validate if profile_id is not NULL
    WHERE (p.profile_id IS NULL OR validate_rate_limit(COALESCE(prl.req_per_day, 0), COALESCE(rt.runs_today_count, 0)) = TRUE)
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
    -- Link profile to run (only if profile_id is not NULL)
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, cd.profile_id::uuid, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE cd.profile_id IS NOT NULL
    RETURNING run_id
),
link_group AS (
    -- Link run to existing group via group_runs junction table
    INSERT INTO group_runs (group_id, run_id, idx)
    SELECT 
        gd.group_id,
        cr.id as run_id,
        (SELECT COALESCE(MAX(idx), -1) + 1 FROM group_runs WHERE group_id = gd.group_id) as idx
    FROM group_data gd
    CROSS JOIN create_run cr
    RETURNING group_id, run_id
),
link_existing_messages AS (
    -- Link existing system/developer messages from previous runs to new run
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT DISTINCT mr.message_id, cr.id, NOW(), NOW()
    FROM previous_runs_in_group prig
    CROSS JOIN create_run cr
    JOIN message_runs mr ON mr.run_id = prig.run_id
    JOIN message m ON m.id = mr.message_id
    WHERE m.role IN ('system'::message_role, 'developer'::message_role)
    ON CONFLICT (message_id, run_id)
    DO UPDATE SET updated_at = NOW()
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
    cd.profile_id,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at,
    cd.department_id,
    -- Run ID (created in same transaction)
    cr.id::text as run_id,
    -- Group ID (from existing group)
    gd.group_id,
    -- Previous messages (from all previous runs in group)
    pma.previous_messages
FROM context_data cd
CROSS JOIN create_run cr
CROSS JOIN group_data gd
CROSS JOIN previous_messages_array pma
$$;