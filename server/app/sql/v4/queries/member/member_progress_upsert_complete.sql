-- Upsert user message and run, link run to group, link system/developer messages_entry
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first
DROP FUNCTION IF EXISTS socket_member_progress_upsert_v4(uuid, text, boolean, uuid);

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_member_progress_upsert_v4(
    chat_id uuid,
    message_contents text,
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
    SELECT chat_id, message_contents, audio, upload_id
),
-- Get member agent (role='member')
member_agent AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    
    
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    LIMIT 1
),
-- Unified chats CTE
all_chats AS (
    SELECT id, attempt_id, created_at, updated_at, title, completed, generated, mcp, active,
           false AS is_practice_chat
    FROM general_chats_entry
    UNION ALL
    SELECT id, attempt_id, created_at, updated_at, title, completed, generated, mcp, active,
           true AS is_practice_chat
    FROM practice_chats_entry
),
-- Unified attempts CTE
all_attempts AS (
    SELECT id, created_at, updated_at, infinite_mode, archived, generated, mcp, active,
           false AS is_practice_attempt
    FROM general_attempts_entry
    UNION ALL
    SELECT id, created_at, updated_at, infinite_mode, archived, generated, mcp, active,
           true AS is_practice_attempt
    FROM practice_attempts_entry
),
-- Unified chat→scenario connections
all_chat_scenarios AS (
    SELECT chat_id, scenarios_id
    FROM general_chats_scenarios_connection
    UNION ALL
    SELECT chat_id, scenarios_id
    FROM practice_chats_scenarios_connection
),
-- Unified attempt→simulation connections
all_attempt_simulations AS (
    SELECT attempt_id, simulations_id
    FROM general_attempts_simulations_connection
    UNION ALL
    SELECT attempt_id, simulations_id
    FROM practice_attempts_simulations_connection
),
-- Unified attempt→profile connections
all_attempt_profiles AS (
    SELECT attempt_id, profiles_id
    FROM general_attempts_profiles_connection
    UNION ALL
    SELECT attempt_id, profiles_id
    FROM practice_attempts_profiles_connection
),
-- Get chat context
chat_context AS (
    SELECT
        c.id as chat_id,
        (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as chat_title,
        (SELECT ssj.scenario_id FROM all_chat_scenarios acs JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = acs.scenarios_id WHERE acs.chat_id = c.id LIMIT 1) as scenario_id,
        NULL::uuid as trace_id,
        sa.id as attempt_id,
        (SELECT ssimj.simulation_id FROM all_attempt_simulations aas JOIN simulation_simulations_junction ssimj ON ssimj.simulations_id = aas.simulations_id WHERE aas.attempt_id = sa.id LIMIT 1) as simulation_id,
        (SELECT ppj.profile_id FROM all_attempt_profiles aap JOIN profile_profiles_junction ppj ON ppj.profiles_id = aap.profiles_id WHERE aap.attempt_id = sa.id LIMIT 1) as profile_id
    FROM params p
    JOIN all_chats c ON c.id = p.chat_id
    JOIN all_attempts sa ON sa.id = c.attempt_id
    LIMIT 1
),
-- Get or create group for chat (find existing group via runs linked to this chat's messages)
chat_group AS (
    SELECT r.group_id
    FROM params p
    JOIN messages_entry m ON m.chat_id = p.chat_id
    JOIN runs_entry r ON r.id = m.run_id
    WHERE r.group_id IS NOT NULL
    LIMIT 1
),
create_group_if_needed AS (
    INSERT INTO groups_entry (created_at, updated_at, session_id)
    SELECT NOW(), NOW(), (SELECT id FROM sessions_entry WHERE profile_id = (SELECT profile_id FROM chat_context) AND active = true ORDER BY created_at DESC LIMIT 1)
    FROM params p
    WHERE NOT EXISTS (SELECT 1 FROM chat_group)
    RETURNING id AS group_id
),
selected_group AS (
    SELECT group_id FROM chat_group
    UNION ALL
    SELECT group_id FROM create_group_if_needed
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
    JOIN runs_entry r ON r.group_id = tg.group_id
    JOIN chat_context cc ON true
    LEFT JOIN profile_runs_junction prj ON prj.run_id = r.id
    LEFT JOIN agent_runs_junction arj ON arj.run_id = r.id
    WHERE (cc.profile_id IS NULL OR prj.profile_id = cc.profile_id)
      AND arj.agent_id = (SELECT agent_id FROM member_agent)
    ORDER BY r.created_at DESC
    LIMIT 1
),
-- Upsert run (create if doesn't exist)
create_run_if_needed AS (
    INSERT INTO runs_entry (input_tokens, output_tokens)
    SELECT 0, 0
    FROM member_agent ma
    WHERE NOT EXISTS (SELECT 1 FROM latest_run)
    RETURNING id as run_id
),
-- Link new run to agent via junction
link_run_to_agent AS (
    INSERT INTO agent_runs_junction (agent_id, run_id)
    SELECT ma.agent_id, cr.run_id
    FROM member_agent ma
    CROSS JOIN create_run_if_needed cr
    RETURNING run_id
),
upserted_run AS (
    SELECT run_id FROM latest_run
    UNION ALL
    SELECT run_id FROM create_run_if_needed
),
-- Link run to group by updating run's group_id
link_run_to_group AS (
    UPDATE runs_entry
    SET group_id = tg.group_id, updated_at = NOW()
    FROM target_group tg
    CROSS JOIN upserted_run ur
    WHERE runs_entry.id = ur.run_id
      AND runs_entry.group_id IS NULL
    RETURNING runs_entry.id as run_id
),
-- Link run to profile via junction (if not already linked)
link_profile_to_run AS (
    INSERT INTO profile_runs_junction (profile_id, run_id)
    SELECT cc.profile_id, ur.run_id
    FROM upserted_run ur
    CROSS JOIN chat_context cc
    WHERE cc.profile_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM profile_runs_junction prj
          WHERE prj.run_id = ur.run_id AND prj.profile_id = cc.profile_id
      )
    ON CONFLICT DO NOTHING
    RETURNING run_id
),
-- Get speak tool_id for member agent (find by name only since 'contents' is now an entry type)
get_speak_tool_id AS (
    SELECT t.id as tool_id
    FROM tool_artifact t
    WHERE (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1) = 'speak' AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    LIMIT 1
),
-- Get latest user message for this run (if exists, for upsert)
latest_user_message AS (
    SELECT m.id as message_id
    FROM upserted_run ur
    JOIN messages_entry m ON m.run_id = ur.run_id
    WHERE m.role = 'user'::message_type
    ORDER BY m.created_at DESC
    LIMIT 1
),
-- Upsert user message (create if empty, update if exists)
create_message_if_needed AS (
    INSERT INTO messages_entry (role, completed, audio, created_at, updated_at)
    SELECT 'user'::message_type, true, p.audio, NOW(), NOW()
    FROM params p
    WHERE NOT EXISTS (SELECT 1 FROM latest_user_message)
    RETURNING id as message_id, created_at, updated_at
),
-- Create synthetic tool call for new user messages_entry
user_tool_call AS (
    INSERT INTO calls_entry (external_call_id, run_id, template_id, arguments_raw, completed, created_at, updated_at)
    SELECT
        'member_progress_user_' || cm.message_id::text,
        ur.run_id,
        (SELECT tao.args_outputs_id FROM tool_args_outputs_junction tao WHERE tao.tool_id = gst.tool_id LIMIT 1),
        '',
        true,
        cm.created_at,
        cm.updated_at
    FROM create_message_if_needed cm
    CROSS JOIN get_speak_tool_id gst
    CROSS JOIN upserted_run ur
    WHERE NOT EXISTS (SELECT 1 FROM latest_user_message)
    RETURNING id as tool_call_id, created_at, updated_at
),
-- Link tool call to tool via junction
link_user_tool_call_to_tool AS (
    INSERT INTO tool_calls_junction (tool_id, call_id)
    SELECT gst.tool_id, utc.tool_call_id
    FROM get_speak_tool_id gst
    CROSS JOIN user_tool_call utc
    WHERE NOT EXISTS (SELECT 1 FROM latest_user_message)
    RETURNING call_id
),
-- Get existing tool_call_id for existing user messages_entry (via calls_entry.run_id)
existing_user_tool_call AS (
    SELECT DISTINCT tc.id as tool_call_id
    FROM latest_user_message lum
    JOIN contents_entry ce ON ce.message_id = lum.message_id AND ce.idx = 0
    JOIN messages_entry m ON m.id = lum.message_id
    JOIN calls_entry tc ON tc.run_id = m.run_id
    LIMIT 1
),
-- Combine new and existing tool calls_entry
user_tool_call_id AS (
    SELECT tool_call_id FROM user_tool_call
    UNION ALL
    SELECT tool_call_id FROM existing_user_tool_call
),
insert_user_content_if_needed AS (
    INSERT INTO contents_entry (message_id, content, idx, created_at, updated_at)
    SELECT cm.message_id, p.message_contents, 0, cm.created_at, cm.updated_at
    FROM create_message_if_needed cm
    CROSS JOIN params p
    CROSS JOIN user_tool_call_id utc
    WHERE NOT EXISTS (SELECT 1 FROM latest_user_message)
),
update_existing_message AS (
    UPDATE messages_entry
    SET audio = p.audio,
        updated_at = NOW()
    FROM params p
    WHERE id = (SELECT message_id FROM latest_user_message)
      AND EXISTS (SELECT 1 FROM latest_user_message)
    RETURNING id as message_id
),
update_existing_message_content AS (
    UPDATE contents_entry
    SET content = p.message_contents,
        updated_at = NOW()
    FROM params p
    WHERE contents_entry.message_id = (SELECT message_id FROM latest_user_message)
      AND contents_entry.idx = 0
      AND EXISTS (SELECT 1 FROM latest_user_message)
),
upserted_message AS (
    SELECT message_id FROM create_message_if_needed
    UNION ALL
    SELECT message_id FROM update_existing_message
),
-- Link message to run (set run_id directly on message)
link_message_to_run AS (
    UPDATE messages_entry
    SET run_id = ur.run_id, updated_at = NOW()
    FROM upserted_message um
    CROSS JOIN upserted_run ur
    WHERE messages_entry.id = um.message_id
      AND (messages_entry.run_id IS NULL OR messages_entry.run_id = ur.run_id)
    RETURNING messages_entry.id as message_id, ur.run_id
),
-- Create audio record with upload_id if upload_id provided
create_audio_if_provided AS (
    INSERT INTO audios_entry (created_at, active, generated, call_id, upload_id)
    SELECT NOW(), true, false, utc.tool_call_id, p.upload_id
    FROM params p
    CROSS JOIN user_tool_call_id utc
    WHERE p.upload_id IS NOT NULL
    RETURNING id as audio_id
),
-- Audio is now linked via audios_entry.call_id -> calls_entry.run_id (no junction table needed)
link_audio_placeholder AS (
    SELECT 1 WHERE false  -- Placeholder CTE to maintain structure
),
-- Create branch from latest message (if exists)
latest_message_for_branch AS (
    SELECT m.id as parent_id
    FROM params p
    JOIN messages_entry m ON m.chat_id = p.chat_id
    WHERE m.role IN ('user'::message_type, 'assistant'::message_type, 'system'::message_type, 'developer'::message_type)
    ORDER BY m.created_at DESC
    LIMIT 1
),
create_branch AS (
    INSERT INTO message_tree_entry (parent_id, child_id, active, created_at, updated_at)
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
          SELECT 1 FROM message_tree_entry mt 
          WHERE mt.parent_id = lmb.parent_id 
          AND mt.child_id = um.message_id 
          AND mt.active = true
      )
    ON CONFLICT (parent_id, child_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
-- Get department_id for linking system/developer messages_entry
resolved_dept AS (
    SELECT COALESCE(
        (SELECT sd.department_id FROM chat_context cc
         JOIN scenario_departments_junction sd ON sd.scenario_id = cc.scenario_id AND sd.active = true LIMIT 1),
        (SELECT pd.department_id FROM chat_context cc
         JOIN profile_departments_junction pd ON pd.profile_id = cc.profile_id AND pd.active = true LIMIT 1),
        (SELECT id FROM department_artifact d WHERE EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true) LIMIT 1)
    ) as department_id
),
-- Link system/developer messages_entry to run (reuse logic from link_system_developer_messages_to_run.sql)
run_info AS (
    SELECT
        ur.run_id,
        ur.run_id as agent_id,  -- Will be resolved FROM runs_entry.agent_id below
        (SELECT department_id FROM resolved_dept) as department_id
    FROM upserted_run ur
),
agent_system_prompt AS (
    SELECT
        pr_default.system_prompt as system_prompt
    FROM run_info ri
    JOIN runs_entry r ON r.id = ri.run_id
    JOIN agent_runs_junction arj ON arj.run_id = r.id
    JOIN agents_resource a ON a.id = arj.agent_id
    LEFT JOIN agent_prompts_junction ap ON ap.agent_id = a.id AND ap.active = true
    LEFT JOIN prompts_resource pr_default ON pr_default.id = ap.prompt_id
    WHERE arj.agent_id IS NOT NULL
    AND pr_default.system_prompt IS NOT NULL
    AND pr_default.system_prompt != ''
),
system_message_content AS (
    SELECT system_prompt as content FROM agent_system_prompt
),
system_message_hash AS (
    SELECT DISTINCT message_content_hash(smc.content, 'system') as hash, smc.content
    FROM system_message_content smc
),
existing_system_message AS (
    SELECT m.id as system_message_id
    FROM messages_entry m
    JOIN contents_entry ce ON ce.message_id = m.id AND ce.idx = 0
    JOIN system_message_hash smh ON message_content_hash(ce.content, 'system') = smh.hash
    WHERE m.role = 'system'::message_type
    LIMIT 1
),
new_system_message AS (
    INSERT INTO messages_entry (role, completed, audio, created_at, updated_at)
    SELECT 'system'::message_type, false, false, NOW(), NOW()
    FROM system_message_content smc
    WHERE NOT EXISTS (SELECT 1 FROM existing_system_message)
    RETURNING id as system_message_id, created_at, updated_at
),
-- Insert system message content (no tool_call_id - prompt tool moved to prompt agent)
insert_system_content AS (
    INSERT INTO contents_entry (message_id, content, idx, created_at, updated_at)
    SELECT nsm.system_message_id, smc.content, 0, nsm.created_at, nsm.updated_at
    FROM new_system_message nsm
    CROSS JOIN system_message_content smc
    WHERE NOT EXISTS (SELECT 1 FROM existing_system_message)
),
system_message AS (
    SELECT system_message_id FROM existing_system_message
    UNION ALL
    SELECT system_message_id FROM new_system_message
),
link_system AS (
    UPDATE messages_entry
    SET run_id = ur.run_id, updated_at = NOW()
    FROM system_message sm
    CROSS JOIN upserted_run ur
    WHERE messages_entry.id = sm.system_message_id
      AND (messages_entry.run_id IS NULL OR messages_entry.run_id = ur.run_id)
    RETURNING messages_entry.id as system_message_id
),
scenario_developer_content AS (
    SELECT DISTINCT
        'The following is the scenario for the chat: ' || ps.problem_statement as content
    FROM run_info ri
    JOIN upserted_run ur ON ur.run_id = ri.run_id
    JOIN params p ON true
    JOIN all_chat_scenarios acs ON acs.chat_id = p.chat_id
    JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = acs.scenarios_id
    JOIN scenario_problem_statements_junction sps ON sps.scenario_id = ssj.scenario_id AND sps.active = true
    JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
    WHERE ps.problem_statement IS NOT NULL
    AND ps.problem_statement != ''
),
scenario_developer_hash AS (
    SELECT DISTINCT message_content_hash(sdc.content, 'developer') as hash, sdc.content
    FROM scenario_developer_content sdc
),
existing_scenario_developer_message AS (
    SELECT m.id as developer_message_id
    FROM messages_entry m
    JOIN contents_entry ce ON ce.message_id = m.id AND ce.idx = 0
    JOIN scenario_developer_hash sdh ON message_content_hash(ce.content, 'developer') = sdh.hash
    WHERE m.role = 'developer'::message_type
    LIMIT 1
),
new_scenario_developer_message AS (
    INSERT INTO messages_entry (role, completed, audio, created_at, updated_at)
    SELECT 'developer'::message_type, false, false, NOW(), NOW()
    FROM scenario_developer_content sdc
    WHERE NOT EXISTS (SELECT 1 FROM existing_scenario_developer_message)
    RETURNING id as developer_message_id, created_at, updated_at
),
-- Insert developer message content (no tool_call_id - instruct tool moved to prompt agent)
insert_scenario_developer_content AS (
    INSERT INTO contents_entry (message_id, content, idx, created_at, updated_at)
    SELECT nsdm.developer_message_id, sdc.content, 0, nsdm.created_at, nsdm.updated_at
    FROM new_scenario_developer_message nsdm
    CROSS JOIN scenario_developer_content sdc
    WHERE NOT EXISTS (SELECT 1 FROM existing_scenario_developer_message)
),
scenario_developer_message AS (
    SELECT developer_message_id FROM existing_scenario_developer_message
    UNION ALL
    SELECT developer_message_id FROM new_scenario_developer_message
),
link_developer AS (
    UPDATE messages_entry
    SET run_id = ur.run_id, updated_at = NOW()
    FROM scenario_developer_message sdm
    CROSS JOIN upserted_run ur
    WHERE messages_entry.id = sdm.developer_message_id
      AND (messages_entry.run_id IS NULL OR messages_entry.run_id = ur.run_id)
    RETURNING messages_entry.id as developer_message_id
),
link_system_to_developer AS (
    INSERT INTO message_tree_entry (parent_id, child_id, active, created_at, updated_at)
    SELECT DISTINCT
        ls.system_message_id as parent_id,
        ld.developer_message_id as child_id,
        true as active,
        NOW() as created_at,
        NOW() as updated_at
    FROM link_system ls
    JOIN link_developer ld ON true
    WHERE NOT EXISTS (
        SELECT 1 FROM message_tree_entry mt 
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