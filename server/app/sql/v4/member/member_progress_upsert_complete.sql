-- Upsert user message and run, link run to group, link system/developer messages
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first
DROP FUNCTION IF EXISTS socket_member_progress_upsert_v4(uuid, text, boolean, uuid);

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_member_progress_upsert_v4(
    chat_id uuid,
    message_content text,
    audio boolean,
    upload_id uuid DEFAULT NULL
)
RETURNS TABLE (
    message_id text,
    run_id text,
    audio boolean,
    chat_id text,
    group_id text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT chat_id, message_content, audio, upload_id
),
-- Get member agent (role='member')
member_agent AS (
    SELECT id as agent_id
    FROM agents
    WHERE role = 'member'::agent_role AND active = true
    LIMIT 1
),
-- Get chat context
chat_context AS (
    SELECT 
        c.id as chat_id,
        c.title as chat_title,
        c.scenario_id,
        g.trace_id,
        sa.id as attempt_id,
        sa.simulation_id,
        ap.profile_id
    FROM params p
    JOIN chats c ON c.id = p.chat_id
    JOIN attempt_chats ac ON ac.chat_id = c.id
    JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    LEFT JOIN groups g ON g.id = (SELECT cg.group_id FROM chat_groups cg WHERE cg.chat_id = c.id LIMIT 1)
    LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
    LIMIT 1
),
-- Get or create group for chat
chat_group AS (
    SELECT cg.group_id
    FROM params p
    JOIN chat_groups cg ON cg.chat_id = p.chat_id
    LIMIT 1
),
create_group_if_needed AS (
    INSERT INTO groups (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM params p
    WHERE NOT EXISTS (SELECT 1 FROM chat_group)
    RETURNING id AS group_id
),
create_chat_group_if_needed AS (
    INSERT INTO chat_groups (chat_id, group_id, created_at, updated_at)
    SELECT p.chat_id, cg.group_id, NOW(), NOW()
    FROM params p
    CROSS JOIN create_group_if_needed cg
    WHERE NOT EXISTS (SELECT 1 FROM chat_group)
    ON CONFLICT (chat_id, group_id) DO NOTHING
    RETURNING group_id
),
selected_group AS (
    SELECT group_id FROM chat_group
    UNION ALL
    SELECT group_id FROM create_group_if_needed
    UNION ALL
    SELECT group_id FROM create_chat_group_if_needed
),
target_group AS (
    SELECT group_id
    FROM selected_group
    LIMIT 1
),
-- Get latest run for this chat (if exists)
latest_run AS (
    SELECT r.id as run_id
    FROM params p
    JOIN target_group tg ON true
    JOIN group_runs gr ON gr.group_id = tg.group_id
    JOIN runs r ON r.id = gr.run_id
    JOIN run_profiles rp ON rp.run_id = r.id AND rp.active = true
    JOIN chat_context cc ON cc.profile_id = rp.profile_id
    WHERE r.agent_id = (SELECT agent_id FROM member_agent)
    ORDER BY r.created_at DESC
    LIMIT 1
),
-- Upsert run (create if doesn't exist)
create_run_if_needed AS (
    INSERT INTO runs (input_tokens, output_tokens, key_id, agent_id)
    SELECT 0, 0, NULL, ma.agent_id
    FROM member_agent ma
    WHERE NOT EXISTS (SELECT 1 FROM latest_run)
    RETURNING id as run_id
),
upserted_run AS (
    SELECT run_id FROM latest_run
    UNION ALL
    SELECT run_id FROM create_run_if_needed
),
-- Link run to group (atomic)
link_run_to_group AS (
    INSERT INTO group_runs (group_id, run_id, idx, created_at, updated_at)
    SELECT
        tg.group_id,
        ur.run_id,
        COALESCE(
            (SELECT MAX(idx) FROM group_runs WHERE group_id = tg.group_id),
            -1
        ) + 1,
        NOW(),
        NOW()
    FROM target_group tg
    CROSS JOIN upserted_run ur
    ON CONFLICT (group_id, run_id) DO NOTHING
    RETURNING run_id
),
-- Link profile to run (if not already linked)
link_profile_to_run AS (
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT ur.run_id, cc.profile_id, true
    FROM upserted_run ur
    CROSS JOIN chat_context cc
    WHERE cc.profile_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM run_profiles rp 
          WHERE rp.run_id = ur.run_id 
          AND rp.profile_id = cc.profile_id 
          AND rp.active = true
      )
    RETURNING run_id
),
-- Get speak tool_id for member agent
get_speak_tool_id AS (
    SELECT id as tool_id
    FROM tools
    WHERE name = 'speak' AND agent_role = 'member'::agent_role AND active = true
    LIMIT 1
),
-- Get latest user message for this run (if exists, for upsert)
latest_user_message AS (
    SELECT m.id as message_id
    FROM upserted_run ur
    JOIN message_runs mr ON mr.run_id = ur.run_id
    JOIN messages m ON m.id = mr.message_id
    WHERE m.role = 'user'::message_role
    ORDER BY m.created_at DESC
    LIMIT 1
),
-- Upsert user message (create if empty, update if exists)
create_message_if_needed AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'user'::message_role, true, p.audio, NOW(), NOW()
    FROM params p
    WHERE NOT EXISTS (SELECT 1 FROM latest_user_message)
    RETURNING id as message_id, created_at, updated_at
),
-- Create synthetic tool call for new user messages
user_tool_call AS (
    INSERT INTO tool_calls (call_id, tool_id, completed, created_at, updated_at)
    SELECT 'member_progress_user_' || cm.message_id::text, gst.tool_id, true, cm.created_at, cm.updated_at
    FROM create_message_if_needed cm
    CROSS JOIN get_speak_tool_id gst
    WHERE NOT EXISTS (SELECT 1 FROM latest_user_message)
    RETURNING id as tool_call_id, created_at, updated_at
),
-- Get existing tool_call_id for existing user messages
existing_user_tool_call AS (
    SELECT DISTINCT mc.tool_call_id
    FROM latest_user_message lum
    JOIN message_content mc ON mc.message_id = lum.message_id AND mc.idx = 0
    LIMIT 1
),
-- Combine new and existing tool calls
user_tool_call_id AS (
    SELECT tool_call_id FROM user_tool_call
    UNION ALL
    SELECT tool_call_id FROM existing_user_tool_call
),
update_message_content_if_needed AS (
    INSERT INTO message_content (message_id, idx, content, tool_call_id, created_at, updated_at)
    SELECT cm.message_id, 0, p.message_content, utc.tool_call_id, cm.created_at, cm.updated_at
    FROM create_message_if_needed cm
    CROSS JOIN params p
    CROSS JOIN user_tool_call_id utc
    WHERE NOT EXISTS (SELECT 1 FROM latest_user_message)
),
update_existing_message AS (
    UPDATE messages
    SET audio = p.audio,
        updated_at = NOW()
    FROM params p
    WHERE id = (SELECT message_id FROM latest_user_message)
      AND EXISTS (SELECT 1 FROM latest_user_message)
    RETURNING id as message_id
),
update_existing_message_content AS (
    UPDATE message_content
    SET content = p.message_content,
        updated_at = NOW()
    FROM params p
    WHERE message_id = (SELECT message_id FROM latest_user_message)
      AND idx = 0
      AND EXISTS (SELECT 1 FROM latest_user_message)
),
upserted_message AS (
    SELECT message_id FROM create_message_if_needed
    UNION ALL
    SELECT message_id FROM update_existing_message
),
-- Link message to run
link_message_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT um.message_id, ur.run_id, NOW(), NOW()
    FROM upserted_message um
    CROSS JOIN upserted_run ur
    ON CONFLICT (message_id, run_id) DO UPDATE SET updated_at = NOW()
    RETURNING message_id, run_id
),
-- Link audio upload to message if upload_id provided
link_audio_if_provided AS (
    INSERT INTO message_audio (message_id, upload_id, created_at, updated_at)
    SELECT um.message_id, p.upload_id, NOW(), NOW()
    FROM upserted_message um
    CROSS JOIN params p
    WHERE p.upload_id IS NOT NULL
    ON CONFLICT (message_id, upload_id) DO UPDATE SET updated_at = NOW()
),
-- Create branch from latest message (if exists)
latest_message_for_branch AS (
    SELECT m.id as parent_id
    FROM params p
    JOIN chat_groups cg ON cg.chat_id = p.chat_id
    JOIN groups g ON g.id = cg.group_id
    JOIN group_runs gr ON gr.group_id = g.id
    JOIN runs r ON r.id = gr.run_id
    JOIN message_runs mr ON mr.run_id = r.id
    JOIN messages m ON m.id = mr.message_id
    WHERE m.role IN ('user'::message_role, 'assistant'::message_role, 'system'::message_role, 'developer'::message_role)
    ORDER BY m.created_at DESC
    LIMIT 1
),
create_branch AS (
    INSERT INTO message_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT 
        lmb.parent_id,
        um.message_id as child_id,
        true,
        NOW(),
        NOW()
    FROM upserted_message um
    CROSS JOIN latest_message_for_branch lmb
    WHERE lmb.parent_id IS NOT NULL
      AND lmb.parent_id != um.message_id  -- Prevent self-references
      AND NOT EXISTS (
          SELECT 1 FROM message_tree mt 
          WHERE mt.parent_id = lmb.parent_id 
          AND mt.child_id = um.message_id 
          AND mt.active = true
      )
    ON CONFLICT (parent_id, child_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
-- Get department_id for linking system/developer messages
resolved_dept AS (
    SELECT COALESCE(
        (SELECT sd.department_id FROM chat_context cc
         JOIN scenario_departments sd ON sd.scenario_id = cc.scenario_id AND sd.active = true LIMIT 1),
        (SELECT pd.department_id FROM chat_context cc
         JOIN profile_departments pd ON pd.profile_id = cc.profile_id AND pd.active = true LIMIT 1),
        (SELECT id FROM departments WHERE active = true LIMIT 1)
    ) as department_id
),
-- Link system/developer messages to run (reuse logic from link_system_developer_messages_to_run.sql)
run_info AS (
    SELECT 
        ur.run_id,
        ur.run_id as agent_id,  -- Will be resolved from run.agent_id below
        (SELECT rp.persona_id FROM run_personas rp WHERE rp.run_id = ur.run_id AND rp.active = true LIMIT 1) as persona_id,
        (SELECT department_id FROM resolved_dept) as department_id
    FROM upserted_run ur
),
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
    JOIN runs r ON r.id = ri.run_id
    JOIN agents a ON a.id = r.agent_id
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
agent_system_prompt AS (
    SELECT 
        COALESCE(pr_dept.system_prompt, pr_default.system_prompt) as system_prompt
    FROM run_info ri
    JOIN runs r ON r.id = ri.run_id
    JOIN agents a ON a.id = r.agent_id
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
    WHERE m.role = 'system'::message_role
    LIMIT 1
),
new_system_message AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'system'::message_role, false, false, NOW(), NOW()
    FROM system_message_content smc
    WHERE NOT EXISTS (SELECT 1 FROM existing_system_message)
    RETURNING id as system_message_id, created_at, updated_at
),
-- Get prompt tool_id for member agent
get_prompt_tool_id AS (
    SELECT id as tool_id
    FROM tools
    WHERE name = 'prompt' AND agent_role = 'member'::agent_role AND active = true
    LIMIT 1
),
-- Create synthetic tool call for new system messages
system_tool_call AS (
    INSERT INTO tool_calls (call_id, tool_id, completed, created_at, updated_at)
    SELECT 'member_progress_system_' || nsm.system_message_id::text, gpt.tool_id, true, nsm.created_at, nsm.updated_at
    FROM new_system_message nsm
    CROSS JOIN get_prompt_tool_id gpt
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
link_system AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT sm.system_message_id, ur.run_id, NOW(), NOW()
    FROM system_message sm
    CROSS JOIN upserted_run ur
    ON CONFLICT (message_id, run_id) DO UPDATE SET updated_at = NOW()
    RETURNING message_id as system_message_id
),
scenario_developer_content AS (
    SELECT DISTINCT
        'The following is the scenario for the chat: ' || ps.problem_statement as content
    FROM run_info ri
    JOIN upserted_run ur ON ur.run_id = ri.run_id
    JOIN target_group tg ON true
    JOIN chat_groups cg ON cg.group_id = tg.group_id
    JOIN chats c ON c.id = cg.chat_id
    JOIN scenario_problem_statements sps ON sps.scenario_id = c.scenario_id AND sps.active = true
    JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    WHERE ps.problem_statement IS NOT NULL 
    AND ps.problem_statement != ''
),
scenario_developer_hash AS (
    SELECT DISTINCT message_content_hash(sdc.content, 'developer') as hash, sdc.content
    FROM scenario_developer_content sdc
),
existing_scenario_developer_message AS (
    SELECT m.id as developer_message_id
    FROM messages m
    JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN scenario_developer_hash sdh ON message_content_hash(mc.content, 'developer') = sdh.hash
    WHERE m.role = 'developer'::message_role
    LIMIT 1
),
new_scenario_developer_message AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'developer'::message_role, false, false, NOW(), NOW()
    FROM scenario_developer_content sdc
    WHERE NOT EXISTS (SELECT 1 FROM existing_scenario_developer_message)
    RETURNING id as developer_message_id, created_at, updated_at
),
-- Get instruct tool_id for member agent
get_instruct_tool_id AS (
    SELECT id as tool_id
    FROM tools
    WHERE name = 'instruct' AND agent_role = 'member'::agent_role AND active = true
    LIMIT 1
),
-- Create synthetic tool call for new developer messages
developer_tool_call AS (
    INSERT INTO tool_calls (call_id, tool_id, completed, created_at, updated_at)
    SELECT 'member_progress_developer_' || nsdm.developer_message_id::text, git.tool_id, true, nsdm.created_at, nsdm.updated_at
    FROM new_scenario_developer_message nsdm
    CROSS JOIN get_instruct_tool_id git
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
link_developer AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT sdm.developer_message_id, ur.run_id, NOW(), NOW()
    FROM scenario_developer_message sdm
    CROSS JOIN upserted_run ur
    ON CONFLICT (message_id, run_id) DO UPDATE SET updated_at = NOW()
    RETURNING message_id as developer_message_id
),
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
    (SELECT message_id FROM upserted_message LIMIT 1)::text as message_id,
    (SELECT run_id FROM upserted_run LIMIT 1)::text as run_id,
    (SELECT audio FROM params LIMIT 1) as audio,
    (SELECT chat_id FROM params LIMIT 1)::text as chat_id,
    (SELECT group_id FROM target_group LIMIT 1)::text as group_id
$$;