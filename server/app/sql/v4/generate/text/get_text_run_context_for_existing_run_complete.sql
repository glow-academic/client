-- Get all data needed to run text generation agent for existing run
-- Takes run_id and returns full context (agent config, tools, messages, etc.)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- NOTE: The type i_get_text_run_context_and_create_run_v4_tool is already defined in
-- get_text_run_context_and_create_run_complete.sql and reused here
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_text_run_context_for_existing_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_text_run_context_for_existing_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
-- Takes run_id and returns full context for agent execution
CREATE OR REPLACE FUNCTION socket_get_text_run_context_for_existing_run_v4(
    run_id uuid,
    agent_id uuid,
    resource_id uuid,
    resource_type text,
    message_ids uuid[] DEFAULT NULL,  -- Includes user regeneration message (if created) + context messages
    group_id uuid DEFAULT NULL
)
RETURNS TABLE (
    agent_id text,
    agent_name text,
    agent_role text,
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
    group_id uuid,
    trace_id text,
    tools types.i_get_text_run_context_and_create_run_v4_tool[],
    developer_instruction_template text,
    developer_instruction_schema_id uuid,
    department_name text,
    developer_message_id uuid,
    upload_id uuid,
    file_path text,
    mime_type text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        run_id AS run_id,
        agent_id AS agent_id,
        resource_id AS resource_id,
        resource_type AS resource_type,
        message_ids AS message_ids,
        group_id AS group_id
),
-- Validate run exists
existing_run AS (
    SELECT 
        r.id as run_id,
        r.agent_id,
        gd.group_id,
        gd.trace_id
    FROM runs r
    CROSS JOIN params p
    LEFT JOIN group_runs gr ON gr.run_id = r.id
    LEFT JOIN groups g ON g.id = gr.group_id
    LEFT JOIN LATERAL (
        SELECT 
            COALESCE(gr.group_id, p.group_id) as group_id,
            COALESCE(g.trace_id, gen_random_uuid()::text) as trace_id
    ) gd ON true
    WHERE r.id = p.run_id
    LIMIT 1
),
-- Get group_id and trace_id
group_data AS (
    SELECT 
        er.group_id,
        er.trace_id
    FROM existing_run er
),
-- Get agent
selected_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    CROSS JOIN params p
    WHERE a.id = p.agent_id
      AND a.active = true
    LIMIT 1
),
-- Get profile from run
run_profile AS (
    SELECT rp.profile_id
    FROM run_profiles rp
    CROSS JOIN params p
    WHERE rp.run_id = p.run_id
      AND rp.active = true
    LIMIT 1
),
-- Get rate limit info (for display, not validation)
profile_rate_limit AS (
    SELECT 
        prl.requests_per_day as req_per_day
    FROM run_profile rp
    LEFT JOIN profile_request_limits prl ON prl.profile_id = rp.profile_id AND prl.active = true
),
runs_today AS (
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    CROSS JOIN run_profile rp
    WHERE mrp.profile_id = rp.profile_id
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
profile_primary_department AS (
    SELECT pd.department_id
    FROM run_profile rp
    JOIN profile_departments pd ON pd.profile_id = rp.profile_id
    WHERE pd.is_primary = TRUE 
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
-- Get agent tools as composite type array
agent_tools_data AS (
    SELECT 
        sa.agent_id,
        COALESCE(
            ARRAY_AGG(
                (t.id, t.name, COALESCE(t.description, ''), t.tool_type, t.agent_role::text, t.arguments, t.argument_descriptions, t.argument_defaults, t.active)::types.i_get_text_run_context_and_create_run_v4_tool
                ORDER BY t.tool_type, t.name
            ),
            '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]
        ) as tools
    FROM selected_agent sa
    LEFT JOIN agent_tools at ON at.agent_id = sa.agent_id AND at.active = true
    LEFT JOIN tools t ON t.id = at.tool_id AND t.active = true
    GROUP BY sa.agent_id
),
-- Get developer instruction using agent role
developer_instruction_data AS (
    SELECT 
        sa.agent_id,
        di.template as developer_instruction_template,
        dis.schema_id as developer_instruction_schema_id
    FROM selected_agent sa
    INNER JOIN agents a ON a.id = sa.agent_id
    LEFT JOIN agent_role_developer_instruction_types ardit ON ardit.agent_role = a.role
    LEFT JOIN developer_instructions di ON di.type = ardit.developer_instruction_type AND di.active = true
    LEFT JOIN developer_instruction_schemas dis ON dis.developer_instruction_id = di.id
    LIMIT 1
),
-- Get department name (from agent_departments or profile primary department)
department_data AS (
    SELECT 
        COALESCE(
            (SELECT ad.department_id FROM agent_departments ad 
             JOIN selected_agent sa ON ad.agent_id = sa.agent_id 
             WHERE ad.active = true LIMIT 1),
            (SELECT ppd.department_id FROM profile_primary_department ppd)
        ) as department_id
),
department_name_data AS (
    SELECT d.title as department_name
    FROM department_data dd
    LEFT JOIN departments d ON d.id = dd.department_id
),
-- Get upload info if exists (for audio input) - get from messages linked to run
upload_info AS (
    SELECT DISTINCT
        u.id as upload_id,
        u.file_path,
        u.mime_type
    FROM params p
    JOIN message_runs mr ON mr.run_id = p.run_id
    JOIN message_audio ma ON ma.message_id = mr.message_id
    JOIN uploads u ON u.id = ma.upload_id
    LIMIT 1
),
-- Context data with agent config
context_data AS (
    SELECT 
        -- Agent data
        a.id::text as agent_id,
        a.name as agent_name,
        a.role::text as agent_role,
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(mtl.temperature, 0.0) as temperature,
        mrl.reasoning_level as reasoning,
        
        -- Model data
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(prov.value::text, '') as provider,
        COALESCE(me.base_url, '') as base_url,
        k.key as api_key,
        
        -- Profile data
        rp.profile_id::text as profile_id,
        
        -- Rate limit data (for display)
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,
        
        -- Tools data
        COALESCE(atd.tools, '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]) as tools,
        
        -- Developer instruction data
        did.developer_instruction_template,
        did.developer_instruction_schema_id,
        
        -- Department data
        dnd.department_name

    FROM selected_agent sa
    INNER JOIN agents a ON a.id = sa.agent_id
    CROSS JOIN run_profile rp
    -- Try department-specific prompt first, fall back to default prompt
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = ad.department_id AND adp_prompt.active = true
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
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    -- Join tools data
    LEFT JOIN agent_tools_data atd ON atd.agent_id = sa.agent_id
    -- Join developer instruction data
    LEFT JOIN developer_instruction_data did ON did.agent_id = sa.agent_id
    -- Join department data
    CROSS JOIN department_name_data dnd
),
-- Create and link developer message if template exists
developer_message_content AS (
    SELECT 
        cd.developer_instruction_template as content,
        er.run_id
    FROM context_data cd
    CROSS JOIN existing_run er
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
    -- Context data
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
    -- Group ID and trace_id (from groups table)
    gd.group_id,
    gd.trace_id::text as trace_id,
    -- Tools array
    cd.tools,
    -- Developer instruction
    cd.developer_instruction_template,
    cd.developer_instruction_schema_id,
    -- Department name
    cd.department_name,
    -- Developer message ID (if created/linked)
    ldm.message_id as developer_message_id,
    -- Upload info (for audio input, when upload_id is provided)
    ui.upload_id,
    ui.file_path,
    ui.mime_type
FROM context_data cd
CROSS JOIN existing_run er
CROSS JOIN group_data gd
LEFT JOIN link_developer_message_to_run ldm ON true
LEFT JOIN upload_info ui ON true
$$;

