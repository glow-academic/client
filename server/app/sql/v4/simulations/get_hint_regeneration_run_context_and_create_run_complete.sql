-- Get all data needed to run hint regeneration agent AND create run in single atomic transaction
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
        WHERE proname = 'socket_get_hint_regeneration_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_hint_regeneration_run_context_and_create_run_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_hint_regen_run_context_create_run_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate composite types
CREATE TYPE types.i_hint_regen_run_context_create_run_v4_msg AS (
    role text,
    content text
);

CREATE TYPE types.i_hint_regen_run_context_create_run_v4_document AS (
    document_id uuid,
    name text,
    file_path text,
    mime_type text
);

-- 4) Recreate function
-- group_id is REQUIRED (not NULL) for regeneration - uses existing group
-- Gets all messages from all previous runs in the group
-- Links existing system/developer messages to the new run
CREATE OR REPLACE FUNCTION socket_get_hint_regeneration_run_context_and_create_run_v4(
    message_id uuid,
    chat_id uuid,
    department_id uuid,
    profile_id uuid,
    hint_agent_id uuid,
    group_id uuid,  -- REQUIRED for regeneration (not NULL)
    user_instructions text DEFAULT NULL
)
RETURNS TABLE (
    message_id text,
    message_created_at timestamptz,
    chat_id text,
    attempt_id text,
    scenario_id text,
    trace_id text,
    chat_title text,
    simulation_id text,
    problem_statement text,
    agent_id text,
    agent_name text,
    system_prompt text,
    temperature float,
    reasoning text,
    model_id text,
    model_name text,
    provider_name text,
    base_url text,
    api_key text,
    provider_id text,
    profile_id text,
    req_per_day integer,
    runs_today_count bigint,
    earliest_run_created_at timestamptz,
    documents types.i_hint_regen_run_context_create_run_v4_document[],
    run_id text,
    group_id uuid,
    previous_messages types.i_hint_regen_run_context_create_run_v4_msg[]  -- All messages from all previous runs in group
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT message_id, chat_id, department_id, profile_id, hint_agent_id, group_id, user_instructions
),
group_data AS (
    -- Use existing group (required for regeneration)
    SELECT 
        g.id as group_id,
        g.trace_id
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
    JOIN messages m ON m.id = mr.message_id
    LEFT JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
        LEFT JOIN contents cnt ON cnt.id = mc.content_id
    ORDER BY gr.idx ASC, m.created_at ASC  -- Order by run idx first, then message created_at
),
previous_messages_array AS (
    -- Aggregate all previous messages into composite type array
    SELECT COALESCE(
        ARRAY_AGG(
            (role, content)::types.i_hint_regen_run_context_create_run_v4_msg
            ORDER BY run_idx, created_at
        ),
        '{}'::types.i_hint_regen_run_context_create_run_v4_msg[]
    ) as previous_messages
    FROM previous_messages_all_runs
),
target_message AS (
    SELECT m.id, c.id AS chat_id, m.role, cnt.content, m.created_at
    FROM messages m
    LEFT JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
        LEFT JOIN contents cnt ON cnt.id = mc.content_id
    JOIN message_runs mr ON mr.message_id = m.id
    JOIN runs r ON r.id = mr.run_id
    JOIN group_runs gr ON gr.run_id = r.id
    JOIN groups g ON g.id = gr.group_id
    JOIN chat_groups cg ON cg.group_id = g.id
    JOIN chats c ON c.id = cg.chat_id
    CROSS JOIN params p
    WHERE m.id = p.message_id AND c.id = p.chat_id
),
chat_info AS (
    SELECT sc.id, ac.attempt_id, sc.scenario_id, gd.trace_id, sc.title
    FROM chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    CROSS JOIN group_data gd
    JOIN target_message tm ON tm.chat_id = sc.id
),
attempt_info AS (
    SELECT sa.id, sa.simulation_id
    FROM simulation_attempts sa
    JOIN chat_info ci ON ci.attempt_id = sa.id
),
scenario_info AS (
    SELECT s.id, ps.problem_statement
    FROM scenario_artifact s
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
    JOIN chat_info ci ON ci.scenario_id = s.id
),
profile_info AS (
    SELECT ap.profile_id
    FROM attempt_profiles ap
    JOIN attempt_info ai ON ai.id = ap.attempt_id
    CROSS JOIN params p_params
    WHERE ap.active = true
      AND ap.profile_id = p_params.profile_id
    LIMIT 1
),
best_agent AS (
    -- Use the provided hint_agent_id directly (UI handles filtering and selection)
    SELECT a.id as agent_id
    FROM agent_artifact a
    CROSS JOIN params p
    WHERE a.id = p.hint_agent_id
    AND EXISTS (SELECT 1 FROM agent_flags af WHERE af.agent_id = a.id AND af.type = 'active'::type_agent_flags AND af.value = true)
    -- Domain check removed - no longer needed
),
profile_rate_limit AS (
    -- Get rate limit for the profile (via attempt_profiles)
    SELECT 
        prl.requests_per_day as req_per_day
    FROM params p_params
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p_params.profile_id AND prl.active = true
),
runs_today AS (
    -- Count model runs for this profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    CROSS JOIN params p
    WHERE mrp.profile_id = p.profile_id
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
default_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf WHERE sf.setting_id = s.id AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
profile_primary_department AS (
    SELECT pd.department_id
    FROM profile_info pi
    JOIN profile_departments pd ON pd.profile_id = pi.profile_id
    WHERE pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM scenario_flags sf WHERE sf.scenario_id = s.id AND sf.type = 'active'::type_scenario_flags AND sf.value = true) 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys k ON k.id = spk.key_id
    WHERE spk.active = true AND EXISTS (SELECT 1 FROM key_flags kf WHERE kf.key_id = k.id AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM scenario_flags sf WHERE sf.scenario_id = s.id AND sf.type = 'active'::type_scenario_flags AND sf.value = true) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
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
            (SELECT settings_id FROM dept_specific_settings_with_keys),
            (SELECT settings_id FROM default_settings_with_keys),
            (SELECT settings_id FROM settings_with_keys LIMIT 1),
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM setting_artifact s WHERE EXISTS (SELECT 1 FROM setting_flags sf WHERE sf.setting_id = s.id AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) LIMIT 1)
        ) as settings_id
),
-- Document data for composite type aggregation
document_data AS (
    SELECT 
        d.id as document_id,
        (SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
        u.file_path,
        u.mime_type
    FROM scenario_info si
    CROSS JOIN scenario_documents sd
    JOIN documents_resource d ON d.id = sd.document_id
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    WHERE sd.scenario_id = si.id AND sd.active = true
),
-- Context data with rate limit info
context_data AS (
    SELECT 
        tm.id::text as message_id,
        tm.created_at as message_created_at,
        ci.id::text as chat_id,
        ci.attempt_id::text as chat_attempt_id,
        ci.scenario_id::text,
        ci.trace_id,
        ci.title as chat_title,
        ai.id::text as attempt_id,
        ai.simulation_id::text,
        si.problem_statement,
        a.id::text as agent_id,
        (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(tl.temperature, 0.0) as temperature,
        rl.reasoning_level as reasoning,
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(n_prov.name, '') as provider_name,
        COALESCE(e.base_url, '') as base_url,
        k.key as api_key,
        p_prov.id::text as provider_id,
        COALESCE(pi.profile_id, p_params.profile_id)::uuid as profile_id,
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,
        -- Aggregate documents as composite type array
        COALESCE(
            (SELECT ARRAY_AGG(
                (dd.document_id, dd.name, dd.file_path, dd.mime_type)::types.i_hint_regen_run_context_create_run_v4_document
                ORDER BY dd.document_id
            ) FROM document_data dd),
            '{}'::types.i_hint_regen_run_context_create_run_v4_document[]
        ) as documents
    FROM target_message tm
    CROSS JOIN chat_info ci
    CROSS JOIN attempt_info ai
    CROSS JOIN scenario_info si
    LEFT JOIN profile_info pi ON true
    CROSS JOIN best_agent ba
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    CROSS JOIN params p_params
    INNER JOIN agents_resource a ON a.id = ba.agent_id
    LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = p_params.department_id AND adp_prompt.active = true
    LEFT JOIN prompts_resource pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts_resource pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
    LEFT JOIN prompts_resource pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
    INNER JOIN agent_models am ON am.agent_id = a.id
    INNER JOIN models_resource m ON m.id = am.model_id
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.temperature_level_id = atl.temperature_level_id AND mtl.model_id = m.id 
LEFT JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id AND tl.active = true
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl ON mrl.reasoning_level_id = arl.reasoning_level_id AND mrl.model_id = m.id 
LEFT JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id AND rl.active = true
    LEFT JOIN model_endpoints me_j ON me_j.model_id = m.id
    LEFT JOIN endpoints_resource e ON e.id = me_j.endpoint_id AND e.active = true
    LEFT JOIN model_providers mp ON mp.model_id = m.id
    LEFT JOIN providers_resource p_prov ON p_prov.id = mp.providers_id
    LEFT JOIN provider_artifact pr_prov ON pr_prov.id = p_prov.provider_id
    LEFT JOIN provider_names pn_prov ON pn_prov.provider_id = pr_prov.id
    LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.name_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.providers_id = p_prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND EXISTS (SELECT 1 FROM key_flags kf WHERE kf.key_id = k.id AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
    -- Validate rate limit: raises exception if exceeded
    WHERE validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
),
create_run AS (
    -- Create run record
    INSERT INTO runs (input_tokens, output_tokens, agent_id)
    SELECT 0, 0, cd.agent_id::uuid
    FROM context_data cd
    RETURNING id as run_id
),
link_model AS (
    -- Link model to run
    INSERT INTO run_models (run_id, model_id, active)
    SELECT cr.run_id, m.id, true
    FROM create_run cr
    CROSS JOIN best_agent ba
    INNER JOIN agents_resource a ON a.id = ba.agent_id
    INNER JOIN agent_models am ON am.agent_id = a.id
    INNER JOIN models_resource m ON m.id = am.model_id
    RETURNING run_id
),
link_profile AS (
    -- Link profile to run if provided
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, profile_id, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE profile_id IS NOT NULL
    RETURNING run_id
),
link_group AS (
    -- Link run to existing group via group_runs junction table
    INSERT INTO group_runs (group_id, run_id, idx)
    SELECT 
        gd.group_id,
        cr.run_id,
        (SELECT COALESCE(MAX(idx), -1) + 1 FROM group_runs WHERE group_id = gd.group_id) as idx
    FROM group_data gd
    CROSS JOIN create_run cr
    RETURNING group_id, run_id
),
link_existing_messages AS (
    -- Link existing system/developer messages from previous runs to new run
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT DISTINCT mr.message_id, cr.run_id, NOW(), NOW()
    FROM previous_runs_in_group prig
    CROSS JOIN create_run cr
    JOIN message_runs mr ON mr.run_id = prig.run_id
    JOIN messages m ON m.id = mr.message_id
    WHERE m.role IN ('system'::message_role, 'developer'::message_role)
    ON CONFLICT (message_id, run_id)
    DO UPDATE SET updated_at = NOW()
)
SELECT 
    -- Context data from context_data CTE
    cd.message_id,
    cd.message_created_at,
    cd.chat_id,
    cd.attempt_id,
    cd.scenario_id,
    cd.trace_id,
    cd.chat_title,
    cd.simulation_id,
    cd.problem_statement,
    cd.agent_id,
    cd.agent_name,
    cd.system_prompt,
    cd.temperature,
    cd.reasoning,
    cd.model_id,
    cd.model_name,
    cd.provider_name,
    cd.base_url,
    cd.api_key,
    cd.provider_id,
    cd.profile_id,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at,
    cd.documents,
    -- Run ID (created in this transaction)
    cr.run_id::text as run_id,
    -- Group ID and trace_id (from existing group)
    gd.group_id,
    -- Previous messages (from all previous runs in group)
    pma.previous_messages
FROM context_data cd
CROSS JOIN create_run cr
CROSS JOIN group_data gd
CROSS JOIN previous_messages_array pma
$$;