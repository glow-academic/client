-- Generate hints for a simulation message - complete unit of work
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
        WHERE proname = 'socket_get_hint_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_hint_run_context_and_create_run_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_get_hint_run_context_and_create_run_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_get_hint_run_context_and_create_run_v4_document AS (
    document_id uuid,
    name text,
    file_path text,
    mime_type text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_get_hint_run_context_and_create_run_v4(
    message_id uuid,
    chat_id uuid,
    department_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    -- Standardized output schema matching text generation handler
    agent_id text,
    agent_name text,
    agent_role text,  -- Required: used for dispatch mapping
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
    run_id text,
    group_id uuid,
    trace_id text,
    tools types.i_get_text_run_context_and_create_run_v4_tool[],
    developer_instruction_template text,
    developer_instruction_schema_id uuid,
    department_name text,
    developer_message_id uuid,
    upload_id uuid,
    file_path text,
    mime_type text,
    -- Agent-specific fields (minimal)
    message_id text,
    chat_id text,
    documents types.i_get_hint_run_context_and_create_run_v4_document[]
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT message_id, chat_id, department_id, profile_id
),
target_message AS (
    SELECT m.id, c.id AS chat_id, m.role, mc.content, m.created_at
    FROM messages m
    LEFT JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
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
    SELECT sc.id, ac.attempt_id, sc.scenario_id, g.trace_id, sc.title
    FROM chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    LEFT JOIN chat_groups cg ON cg.chat_id = sc.id
    LEFT JOIN groups g ON g.id = cg.group_id
    JOIN target_message tm ON tm.chat_id = sc.id
),
attempt_info AS (
    SELECT sa.id, sa.simulation_id
    FROM simulation_attempts sa
    JOIN chat_info ci ON ci.attempt_id = sa.id
),
scenario_info AS (
    SELECT s.id, ps.problem_statement
    FROM scenarios s
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    JOIN chat_info ci ON ci.scenario_id = s.id
),
profile_info AS (
    SELECT profile_id as profile_id
    FROM attempt_profiles ap
    JOIN attempt_info ai ON ai.id = ap.attempt_id
    WHERE ap.active = true
      AND ap.profile_id = profile_id
    LIMIT 1
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.role = 'hint'::agent_role
    AND a.active = true
    AND (
        -- Include if agent is linked to the specified department
        ad.department_id = department_id
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = department_id THEN 0 ELSE 1 END
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile (via attempt_profiles)
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles p
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    WHERE p.id = profile_id
),
runs_today AS (
    -- Count model runs for this profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = profile_id
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
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
-- Document data for composite type aggregation
document_data AS (
    SELECT 
        d.id as document_id,
        d.name,
        u.file_path,
        u.mime_type
    FROM scenario_info si
    CROSS JOIN scenario_documents sd
    JOIN documents d ON d.id = sd.document_id
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    WHERE sd.scenario_id = si.id AND sd.active = true
),
-- Get or create group (for trace_id and group_id)
existing_group AS (
    SELECT g.id as group_id, g.trace_id
    FROM chat_info ci
    JOIN chat_groups cg ON cg.chat_id = ci.id
    JOIN groups g ON g.id = cg.group_id
    LIMIT 1
),
create_group_if_needed AS (
    INSERT INTO groups (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM chat_info ci
    WHERE NOT EXISTS (SELECT 1 FROM existing_group)
    RETURNING id as group_id, trace_id
),
group_data AS (
    SELECT 
        COALESCE(
            (SELECT group_id FROM existing_group LIMIT 1),
            (SELECT group_id FROM create_group_if_needed LIMIT 1),
            gen_random_uuid()::uuid
        ) as group_id,
        COALESCE(
            (SELECT trace_id FROM existing_group LIMIT 1),
            (SELECT trace_id FROM create_group_if_needed LIMIT 1),
            gen_random_uuid()::text
        ) as trace_id
),
-- Get agent tools as composite type array
agent_tools_data AS (
    SELECT 
        ba.agent_id,
        COALESCE(
            ARRAY_AGG(
                (t.id, t.name, COALESCE(t.description, ''), t.tool_type, t.agent_role::text, t.arguments, t.argument_descriptions, t.argument_defaults, t.active)::types.i_get_text_run_context_and_create_run_v4_tool
                ORDER BY t.tool_type, t.name
            ),
            '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]
        ) as tools
    FROM best_agent ba
    LEFT JOIN agent_tools at ON at.agent_id = ba.agent_id AND at.active = true
    LEFT JOIN tools t ON t.id = at.tool_id AND t.active = true
    GROUP BY ba.agent_id
),
-- Get developer instruction using agent role
developer_instruction_data AS (
    SELECT 
        ba.agent_id,
        di.template as developer_instruction_template,
        dis.schema_id as developer_instruction_schema_id
    FROM best_agent ba
    INNER JOIN agents a ON a.id = ba.agent_id
    LEFT JOIN agent_role_developer_instruction_types ardit ON ardit.agent_role = a.role
    LEFT JOIN developer_instructions di ON di.type = ardit.developer_instruction_type AND di.active = true
    LEFT JOIN developer_instruction_schemas dis ON dis.developer_instruction_id = di.id
    LIMIT 1
),
-- Get department name
department_data AS (
    SELECT 
        p_params.department_id,
        d.title as department_name
    FROM params p_params
    LEFT JOIN departments d ON d.id = p_params.department_id
),
-- Context data with rate limit info
context_data AS (
    SELECT 
        -- Standardized fields
        a.id::text as agent_id,
        a.name as agent_name,
        a.role::text as agent_role,
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(mtl.temperature, 0.0) as temperature,
        mrl.reasoning_level as reasoning,
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(p.value::text, '') as provider,
        COALESCE(me.base_url, '') as base_url,
        k.key as api_key,
        COALESCE(pi.profile_id, p_params.profile_id)::text as profile_id,
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,
        -- Tools data
        COALESCE(atd.tools, '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]) as tools,
        -- Developer instruction data
        did.developer_instruction_template,
        did.developer_instruction_schema_id,
        -- Department data
        dd.department_name,
        -- Agent-specific fields
        tm.id::text as message_id,
        ci.id::text as chat_id,
        -- Aggregate documents as composite type array
        COALESCE(
            (SELECT ARRAY_AGG(
                (dd_doc.document_id, dd_doc.name, dd_doc.file_path, dd_doc.mime_type)::types.i_get_hint_run_context_and_create_run_v4_document
                ORDER BY dd_doc.document_id
            ) FROM document_data dd_doc),
            '{}'::types.i_get_hint_run_context_and_create_run_v4_document[]
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
    CROSS JOIN group_data gd
    INNER JOIN agents a ON a.id = ba.agent_id
    LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = p_params.department_id AND adp_prompt.active = true
    LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
    LEFT JOIN prompts pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
    INNER JOIN models m ON m.id = a.model_id
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true AND mtl.model_id = m.id
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true AND mrl.model_id = m.id
    LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
    LEFT JOIN providers p ON p.id = m.provider_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.provider_id = p.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
    -- Join tools data
    LEFT JOIN agent_tools_data atd ON atd.agent_id = ba.agent_id
    -- Join developer instruction data
    LEFT JOIN developer_instruction_data did ON did.agent_id = ba.agent_id
    -- Join department data
    LEFT JOIN department_data dd ON dd.department_id = p_params.department_id
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
    INNER JOIN agents a ON a.id = ba.agent_id
    INNER JOIN models m ON m.id = a.model_id
    RETURNING run_id
),
link_profile AS (
    -- Link profile to run if provided
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, cd.profile_id::uuid, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE cd.profile_id IS NOT NULL
    RETURNING run_id
),
link_group AS (
    -- Link group to run
    INSERT INTO group_runs (group_id, run_id, idx, created_at, updated_at)
    SELECT gd.group_id, lp.run_id, 0, NOW(), NOW()
    FROM link_profile lp
    CROSS JOIN group_data gd
    RETURNING run_id
),
-- Create and link developer message if template exists
developer_message_content AS (
    SELECT 
        cd.developer_instruction_template as content,
        lg.run_id
    FROM context_data cd
    CROSS JOIN link_group lg
    WHERE cd.developer_instruction_template IS NOT NULL
    LIMIT 1
),
developer_message_hash AS (
    SELECT 
        dmc.content,
        dmc.run_id,
        message_content_hash(dmc.content, 'developer') as hash
    FROM developer_message_content dmc
),
existing_developer_message AS (
    SELECT 
        m.id, 
        m.created_at,
        dmh.run_id
    FROM messages m
    JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN developer_message_hash dmh ON message_content_hash(mc.content, 'developer') = dmh.hash
    WHERE m.role = 'developer'
    LIMIT 1
),
new_developer_message AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'developer'::message_role, false, false, NOW(), NOW()
    FROM developer_message_hash dmh
    WHERE NOT EXISTS (SELECT 1 FROM existing_developer_message)
    RETURNING id, created_at, updated_at
),
insert_developer_message_content AS (
    INSERT INTO message_content (message_id, idx, content, created_at, updated_at)
    SELECT 
        nm.id, 
        0, 
        (SELECT content FROM developer_message_hash LIMIT 1), 
        nm.created_at, 
        nm.updated_at
    FROM new_developer_message nm
),
developer_message_final AS (
    SELECT id, run_id FROM existing_developer_message
    UNION ALL
    SELECT 
        nm.id, 
        (SELECT run_id FROM developer_message_hash LIMIT 1) as run_id
    FROM new_developer_message nm
),
link_developer_message_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT dmf.id, dmf.run_id, NOW(), NOW()
    FROM developer_message_final dmf
    ON CONFLICT (message_id, run_id) 
    DO UPDATE SET updated_at = NOW()
    RETURNING message_id, run_id
)
SELECT 
    -- Standardized output schema
    cd.agent_id,
    cd.agent_name,
    cd.agent_role,
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
    cr.run_id::text as run_id,
    gd.group_id,
    gd.trace_id::text as trace_id,
    cd.tools,
    cd.developer_instruction_template,
    cd.developer_instruction_schema_id,
    cd.department_name,
    ldm.message_id as developer_message_id,
    NULL::uuid as upload_id,
    NULL::text as file_path,
    NULL::text as mime_type,
    -- Agent-specific fields
    cd.message_id,
    cd.chat_id,
    cd.documents
FROM context_data cd
CROSS JOIN create_run cr
CROSS JOIN link_model lm
CROSS JOIN link_profile lp
CROSS JOIN link_group lg
CROSS JOIN group_data gd
LEFT JOIN link_developer_message_to_run ldm ON true
$$;