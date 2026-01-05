-- Link system and developer messages to a run with proper message_tree structure
-- Converted to PostgreSQL function
-- Returns: system_message_id, developer_message_id (both nullable)
-- 
-- For simulation runs (with personas):
--   - Links system message (persona prompt, department-specific or default)
--   - Links developer message (scenario description if chat_id provided)
--   - Creates message_tree: system → developer → (will link to first user when created)
--
-- For agent runs:
--   - Links system message (agent prompt, department-specific or default)
--   - Developer messages are linked separately (hint, grade agents)
--
-- Note: message_tree linking to first user message happens when user message is created
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_link_system_developer_messages_to_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_link_system_developer_messages_to_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_link_system_developer_messages_to_run_v4(
    run_id uuid,
    department_id uuid DEFAULT NULL,
    chat_id uuid DEFAULT NULL
)
RETURNS TABLE (
    system_message_id uuid,
    developer_message_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH run_info AS (
    SELECT 
        r.id as run_id,
        r.agent_id,
        (SELECT rp.persona_id FROM run_personas rp WHERE rp.run_id = r.id AND rp.active = true LIMIT 1) as persona_id,
        COALESCE(
            department_id,
            -- Try to get department from chat
            (SELECT sd.department_id FROM runs r2
             JOIN group_runs gr ON gr.run_id = r2.id
             JOIN groups g ON g.id = gr.group_id
             JOIN chat_groups cg ON cg.group_id = g.id
             JOIN chats c ON c.id = cg.chat_id
             JOIN scenario_departments sd ON sd.scenario_id = c.scenario_id AND sd.active = true
             WHERE r2.id = r.id LIMIT 1),
            -- Try to get department from profile
            (SELECT pd.department_id FROM run_profiles rpf
             JOIN profile_departments pd ON pd.profile_id = rpf.profile_id AND pd.active = true
             WHERE rpf.run_id = r.id AND rpf.active = true LIMIT 1),
            -- Fallback to any active department
            (SELECT id FROM departments WHERE active = true LIMIT 1)
        ) as department_id
    FROM runs r
    WHERE r.id = run_id
),
-- Get system prompt for persona runs
-- System prompt comes from the agent (department-specific or default), then persona instructions are appended
persona_system_prompt AS (
    SELECT 
        CASE 
            WHEN p.instructions IS NOT NULL AND p.instructions != '' THEN
                COALESCE(pr_dept.system_prompt, pr_default.system_prompt) || E'\n\n' || p.instructions
            ELSE
                COALESCE(pr_dept.system_prompt, pr_default.system_prompt)
        END as system_prompt
    FROM run_info ri
    JOIN run_personas rp ON rp.run_id = ri.run_id AND rp.active = true
    JOIN personas p ON p.id = rp.persona_id
    JOIN agents a ON a.id = ri.agent_id
    LEFT JOIN agent_department_prompts adp ON adp.agent_id = a.id 
        AND adp.department_id = ri.department_id
        AND adp.active = true
    LEFT JOIN prompts pr_dept ON pr_dept.id = adp.prompt_id
    LEFT JOIN agent_prompts ap ON ap.agent_id = a.id AND ap.active = true
    LEFT JOIN prompts pr_default ON pr_default.id = ap.prompt_id
    WHERE ri.persona_id IS NOT NULL
    AND COALESCE(pr_dept.system_prompt, pr_default.system_prompt) IS NOT NULL
    AND COALESCE(pr_dept.system_prompt, pr_default.system_prompt) != ''
),
-- Get system prompt for agent runs
agent_system_prompt AS (
    SELECT 
        COALESCE(pr_dept.system_prompt, pr_default.system_prompt) as system_prompt
    FROM run_info ri
    JOIN agents a ON a.id = ri.agent_id
    LEFT JOIN agent_department_prompts adp ON adp.agent_id = a.id 
        AND adp.department_id = ri.department_id
        AND adp.active = true
    LEFT JOIN prompts pr_dept ON pr_dept.id = adp.prompt_id
    LEFT JOIN agent_prompts ap ON ap.agent_id = a.id AND ap.active = true
    LEFT JOIN prompts pr_default ON pr_default.id = ap.prompt_id
    WHERE ri.agent_id IS NOT NULL
    AND ri.persona_id IS NULL
    AND COALESCE(pr_dept.system_prompt, pr_default.system_prompt) IS NOT NULL
    AND COALESCE(pr_dept.system_prompt, pr_default.system_prompt) != ''
),
-- Get or create system message with MD5 deduplication
system_message_content AS (
    SELECT system_prompt as content FROM persona_system_prompt
    UNION ALL
    SELECT system_prompt as content FROM agent_system_prompt
),
system_message_hash AS (
    SELECT DISTINCT message_content_hash(smc.content, 'system') as hash, smc.content
    FROM system_message_content smc
),
existing_system_message AS (
    SELECT m.id as system_message_id
    FROM messages m
    JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN system_message_hash smh ON message_content_hash(mc.content, 'system') = smh.hash
    WHERE m.role = 'system'
    LIMIT 1
),
new_system_message AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'system'::message_role, false, false, NOW(), NOW()
    FROM system_message_content smc
    WHERE NOT EXISTS (SELECT 1 FROM existing_system_message)
    RETURNING id as system_message_id, created_at, updated_at
),
-- Create synthetic tool call for new system messages
system_tool_call AS (
    INSERT INTO tool_calls (call_id, tool_id, completed, created_at, updated_at)
    SELECT 'link_sys_dev_system_' || nsm.system_message_id::text, NULL, true, nsm.created_at, nsm.updated_at
    FROM new_system_message nsm
    WHERE NOT EXISTS (SELECT 1 FROM existing_system_message)
    RETURNING id as tool_call_id, created_at, updated_at
),
-- Get existing tool_call_id for existing system messages
existing_system_tool_call AS (
    SELECT DISTINCT mc.tool_call_id
    FROM existing_system_message esm
    JOIN message_content mc ON mc.message_id = esm.system_message_id AND mc.idx = 0
    LIMIT 1
),
-- Combine new and existing tool calls
system_tool_call_id AS (
    SELECT tool_call_id FROM system_tool_call
    UNION ALL
    SELECT tool_call_id FROM existing_system_tool_call
),
insert_system_content AS (
    INSERT INTO message_content (message_id, idx, content, tool_call_id, created_at, updated_at)
    SELECT nsm.system_message_id, 0, smc.content, stc.tool_call_id, nsm.created_at, nsm.updated_at
    FROM new_system_message nsm
    CROSS JOIN system_message_content smc
    CROSS JOIN system_tool_call_id stc
    WHERE NOT EXISTS (SELECT 1 FROM existing_system_message)
),
system_message AS (
    SELECT system_message_id FROM existing_system_message
    UNION ALL
    SELECT system_message_id FROM new_system_message
),
-- Link system message to run
link_system AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT sm.system_message_id, run_id, NOW(), NOW()
    FROM system_message sm
    ON CONFLICT (message_id, run_id) DO UPDATE SET updated_at = NOW()
    RETURNING message_id as system_message_id
),
-- Get scenario developer message (for simulation runs with chat_id)
-- Use developer_instructions table for scenario_statement type
scenario_developer_template AS (
    SELECT di.template
    FROM run_info ri
    JOIN agents a ON a.id = ri.agent_id
    JOIN agent_role_developer_instruction_types ardit ON ardit.agent_role = a.role
    JOIN developer_instructions di ON di.type = ardit.developer_instruction_type
    WHERE ardit.developer_instruction_type = 'scenario_statement'::developer_instruction_type
    LIMIT 1
),
scenario_developer_content AS (
    SELECT DISTINCT
        -- Use template from developer_instructions if available, otherwise fallback to hardcoded
        COALESCE(
            REPLACE(sdt.template, '{{ problem_statement }}', ps.problem_statement),
            'The following is the scenario for the chat: ' || ps.problem_statement
        ) as content
    FROM run_info ri
    JOIN group_runs gr ON gr.run_id = ri.run_id
    JOIN groups g ON g.id = gr.group_id
    JOIN chat_groups cg ON cg.group_id = g.id
    JOIN chats c ON c.id = cg.chat_id
    JOIN scenario_problem_statements sps ON sps.scenario_id = c.scenario_id AND sps.active = true
    JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    CROSS JOIN LATERAL (SELECT template FROM scenario_developer_template LIMIT 1) sdt
    WHERE chat_id IS NOT NULL
    AND c.id = chat_id
    AND ps.problem_statement IS NOT NULL 
    AND ps.problem_statement != ''
),
-- Get or create developer message for scenario with MD5 deduplication
scenario_developer_hash AS (
    SELECT DISTINCT message_content_hash(sdc.content, 'developer') as hash, sdc.content
    FROM scenario_developer_content sdc
),
existing_scenario_developer_message AS (
    SELECT m.id as developer_message_id
    FROM messages m
    JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN scenario_developer_hash sdh ON message_content_hash(mc.content, 'developer') = sdh.hash
    WHERE m.role = 'developer'
    LIMIT 1
),
new_scenario_developer_message AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'developer'::message_role, false, false, NOW(), NOW()
    FROM scenario_developer_content sdc
    WHERE NOT EXISTS (SELECT 1 FROM existing_scenario_developer_message)
    RETURNING id as developer_message_id, created_at, updated_at
),
-- Create synthetic tool call for new developer messages
developer_tool_call AS (
    INSERT INTO tool_calls (call_id, tool_id, completed, created_at, updated_at)
    SELECT 'link_sys_dev_developer_' || nsdm.developer_message_id::text, NULL, true, nsdm.created_at, nsdm.updated_at
    FROM new_scenario_developer_message nsdm
    WHERE NOT EXISTS (SELECT 1 FROM existing_scenario_developer_message)
    RETURNING id as tool_call_id, created_at, updated_at
),
-- Get existing tool_call_id for existing developer messages
existing_developer_tool_call AS (
    SELECT DISTINCT mc.tool_call_id
    FROM existing_scenario_developer_message esdm
    JOIN message_content mc ON mc.message_id = esdm.developer_message_id AND mc.idx = 0
    LIMIT 1
),
-- Combine new and existing tool calls
developer_tool_call_id AS (
    SELECT tool_call_id FROM developer_tool_call
    UNION ALL
    SELECT tool_call_id FROM existing_developer_tool_call
),
insert_scenario_developer_content AS (
    INSERT INTO message_content (message_id, idx, content, tool_call_id, created_at, updated_at)
    SELECT nsdm.developer_message_id, 0, sdc.content, dtc.tool_call_id, nsdm.created_at, nsdm.updated_at
    FROM new_scenario_developer_message nsdm
    CROSS JOIN scenario_developer_content sdc
    CROSS JOIN developer_tool_call_id dtc
    WHERE NOT EXISTS (SELECT 1 FROM existing_scenario_developer_message)
),
scenario_developer_message AS (
    SELECT developer_message_id FROM existing_scenario_developer_message
    UNION ALL
    SELECT developer_message_id FROM new_scenario_developer_message
),
-- Link developer message to run
link_developer AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT sdm.developer_message_id, run_id, NOW(), NOW()
    FROM scenario_developer_message sdm
    ON CONFLICT (message_id, run_id) DO UPDATE SET updated_at = NOW()
    RETURNING message_id as developer_message_id
),
-- Link system → developer in message_tree (if both exist)
link_system_to_developer AS (
    INSERT INTO message_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT DISTINCT
        ls.system_message_id as parent_id,
        ld.developer_message_id as child_id,
        true as active,
        NOW() as created_at,
        NOW() as updated_at
    FROM link_system ls
    JOIN link_developer ld ON true
    WHERE NOT EXISTS (
        SELECT 1 FROM message_tree mt 
        WHERE mt.parent_id = ls.system_message_id 
        AND mt.child_id = ld.developer_message_id 
        AND mt.active = true
    )
)
SELECT 
    (SELECT system_message_id FROM link_system LIMIT 1) as system_message_id,
    (SELECT developer_message_id FROM link_developer LIMIT 1) as developer_message_id
$$;