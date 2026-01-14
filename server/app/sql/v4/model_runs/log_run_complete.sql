DROP FUNCTION IF EXISTS api_log_run_v4(uuid, uuid, integer, integer, integer, integer, integer, integer, integer, text[], text);
CREATE OR REPLACE FUNCTION api_log_run_v4(
    run_id uuid,
    input_text_tokens integer,
    input_audio_tokens integer,
    input_image_tokens integer,
    output_text_tokens integer,
    output_audio_tokens integer,
    cached_text_tokens integer,
    cached_audio_tokens integer,
    department_id uuid DEFAULT NULL,
    developer_contents text[] DEFAULT ARRAY[]::text[],
    assistant_output text DEFAULT NULL
)
RETURNS TABLE (
    success integer
)
LANGUAGE sql
AS $$
-- Complete log_run handler: token updates + message logging in single transaction
-- All parameters are cast exactly once in params CTE for reliable type introspection
WITH params AS (
    SELECT api_log_run_v4.run_id AS run_id,
           api_log_run_v4.department_id AS department_id,
           api_log_run_v4.input_text_tokens AS input_text_tokens,
           api_log_run_v4.input_audio_tokens AS input_audio_tokens,
           api_log_run_v4.input_image_tokens AS input_image_tokens,
           api_log_run_v4.output_text_tokens AS output_text_tokens,
           api_log_run_v4.output_audio_tokens AS output_audio_tokens,
           api_log_run_v4.cached_text_tokens AS cached_text_tokens,
           api_log_run_v4.cached_audio_tokens AS cached_audio_tokens,
           COALESCE(api_log_run_v4.developer_contents, ARRAY[]::text[]) AS developer_contents,
           NULLIF(api_log_run_v4.assistant_output, '') AS assistant_output
),
run_info AS (
    SELECT 
        r.id as run_id,
        r.agent_id,
        (SELECT rp.persona_id FROM run_personas rp WHERE rp.run_id = r.id AND rp.active = true LIMIT 1) as persona_id,
        COALESCE(
            x.department_id,
            -- Try to get department FROM chats
            (SELECT sd.department_id FROM runs r2
             JOIN group_runs gr ON gr.run_id = r2.id
             JOIN groups g ON g.id = gr.group_id
             JOIN chat_groups cg ON cg.group_id = g.id
             JOIN chats c ON c.id = cg.chat_id
             JOIN scenario_departments sd ON sd.scenario_id = c.scenario_id AND sd.active = true
             WHERE r2.id = x.run_id LIMIT 1),
            -- Try to get department FROM profile_artifact
            (SELECT pd.department_id FROM run_profiles rpf
             JOIN profile_departments pd ON pd.profile_id = rpf.profile_id AND pd.active = true
             WHERE rpf.run_id = x.run_id AND rpf.active = true LIMIT 1),
            -- Fallback to any active department
            (SELECT id FROM department_artifact d WHERE EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = TRUE) LIMIT 1)
        ) as department_id
    FROM params x
    JOIN runs r ON r.id = x.run_id
),
-- Token update: handle both text-only and audio/image/text scenarios
has_audio_or_image AS (
    SELECT 
        COALESCE(x.input_audio_tokens, 0) > 0 OR COALESCE(x.input_image_tokens, 0) > 0 OR COALESCE(x.output_audio_tokens, 0) > 0 OR COALESCE(x.cached_audio_tokens, 0) > 0 as has_audio_image
    FROM params x
),
update_run AS (
    UPDATE runs 
    SET 
        input_tokens = CASE 
            WHEN (SELECT has_audio_image FROM has_audio_or_image) THEN
                COALESCE(x.input_text_tokens, 0) + COALESCE(x.input_audio_tokens, 0) + COALESCE(x.input_image_tokens, 0)
            ELSE
                COALESCE(x.input_text_tokens, 0)
        END,
        output_tokens = CASE 
            WHEN (SELECT has_audio_image FROM has_audio_or_image) THEN
                COALESCE(x.output_text_tokens, 0) + COALESCE(x.output_audio_tokens, 0)
            ELSE
                COALESCE(x.output_text_tokens, 0)
        END,
        cached_input_tokens = CASE 
            WHEN (SELECT has_audio_image FROM has_audio_or_image) THEN
                COALESCE(x.cached_text_tokens, 0) + COALESCE(x.cached_audio_tokens, 0)
            ELSE
                COALESCE(x.cached_text_tokens, 0)
        END
    FROM params x
    WHERE runs.id = x.run_id
    RETURNING id, input_tokens, output_tokens, cached_input_tokens
),
-- Get unit IDs for pricing
million_text_unit AS (
    SELECT id FROM units 
    WHERE name = 'million_text' AND unit_category = 'tokens' AND active = true 
    LIMIT 1
),
million_audio_unit AS (
    SELECT id FROM units 
    WHERE name = 'million_audio' AND unit_category = 'tokens' AND active = true 
    LIMIT 1
),
million_image_unit AS (
    SELECT id FROM units 
    WHERE name = 'million_image' AND unit_category = 'tokens' AND active = true 
    LIMIT 1
),
-- Upsert pricing usage (conditional based on token types)
upsert_input_text_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'input'::pricing_type,
        mtu.id,
        x.input_text_tokens,
        now()
    FROM params x
    CROSS JOIN update_run ur
    CROSS JOIN million_text_unit mtu
    WHERE x.input_text_tokens > 0 AND mtu.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_input_audio_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'input'::pricing_type,
        mau.id,
        x.input_audio_tokens,
        now()
    FROM params x
    CROSS JOIN update_run ur
    CROSS JOIN million_audio_unit mau
    WHERE COALESCE(x.input_audio_tokens, 0) > 0 AND mau.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_input_image_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'input'::pricing_type,
        miu.id,
        x.input_image_tokens,
        now()
    FROM params x
    CROSS JOIN update_run ur
    CROSS JOIN million_image_unit miu
    WHERE COALESCE(x.input_image_tokens, 0) > 0 AND miu.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_output_text_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'output'::pricing_type,
        mtu.id,
        x.output_text_tokens,
        now()
    FROM params x
    CROSS JOIN update_run ur
    CROSS JOIN million_text_unit mtu
    WHERE x.output_text_tokens > 0 AND mtu.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_output_audio_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'output'::pricing_type,
        mau.id,
        x.output_audio_tokens,
        now()
    FROM params x
    CROSS JOIN update_run ur
    CROSS JOIN million_audio_unit mau
    WHERE COALESCE(x.output_audio_tokens, 0) > 0 AND mau.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_cached_text_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'cached'::pricing_type,
        mtu.id,
        x.cached_text_tokens,
        now()
    FROM params x
    CROSS JOIN update_run ur
    CROSS JOIN million_text_unit mtu
    WHERE COALESCE(x.cached_text_tokens, 0) > 0 AND mtu.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_cached_audio_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'cached'::pricing_type,
        mau.id,
        x.cached_audio_tokens,
        now()
    FROM params x
    CROSS JOIN update_run ur
    CROSS JOIN million_audio_unit mau
    WHERE COALESCE(x.cached_audio_tokens, 0) > 0 AND mau.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
-- Get system prompt for persona runs
persona_system_prompt AS (
    SELECT 
        CASE 
            WHEN pi_inst.template IS NOT NULL AND pi_inst.template != '' THEN
                COALESCE(pr_dept.system_prompt, pr_default.system_prompt) || E'\n\n' || pi_inst.template
            ELSE
                COALESCE(pr_dept.system_prompt, pr_default.system_prompt)
        END as system_prompt
    FROM run_info ri
    JOIN run_personas rp ON rp.run_id = ri.run_id AND rp.active = true
    JOIN personas_resource p ON p.id = rp.persona_id
    LEFT JOIN persona_instructions pi ON pi.persona_id = p.id
    LEFT JOIN instructions_resource pi_inst ON pi_inst.id = pi.instruction_id
    JOIN agents_resource a ON a.id = ri.agent_id
    LEFT JOIN agent_department_prompts adp ON adp.agent_id = a.id 
        AND adp.department_id = ri.department_id
        AND adp.active = true
    LEFT JOIN prompts_resource pr_dept ON pr_dept.id = adp.prompt_id
    LEFT JOIN agent_prompts ap ON ap.agent_id = a.id AND ap.active = true
    LEFT JOIN prompts_resource pr_default ON pr_default.id = ap.prompt_id
    WHERE ri.persona_id IS NOT NULL
    AND COALESCE(pr_dept.system_prompt, pr_default.system_prompt) IS NOT NULL
    AND COALESCE(pr_dept.system_prompt, pr_default.system_prompt) != ''
),
-- Get system prompt for agent runs
agent_system_prompt AS (
    SELECT 
        COALESCE(pr_dept.system_prompt, pr_default.system_prompt) as system_prompt
    FROM run_info ri
    JOIN agents_resource a ON a.id = ri.agent_id
    LEFT JOIN agent_department_prompts adp ON adp.agent_id = a.id 
        AND adp.department_id = ri.department_id
        AND adp.active = true
    LEFT JOIN prompts_resource pr_dept ON pr_dept.id = adp.prompt_id
    LEFT JOIN agent_prompts ap ON ap.agent_id = a.id AND ap.active = true
    LEFT JOIN prompts_resource pr_default ON pr_default.id = ap.prompt_id
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
    JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
        JOIN contents cnt ON cnt.id = mc.content_id
    JOIN system_message_hash smh ON message_content_hash(cnt.content, 'system') = smh.hash
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
-- Get prompt tool_id for prompt agent
get_prompt_tool_id AS (
    SELECT t.id as tool_id
    FROM tool_artifact t
    INNER JOIN resource_tools rt ON rt.tool_id = t.id AND rt.resource = CAST('prompts' AS resources)
    INNER JOIN runs r_run ON r_run.id = (SELECT run_id FROM params LIMIT 1)
    
    
    WHERE t.name = 'prompt' AND t.active = true
    LIMIT 1
),
system_tool_call AS (
    INSERT INTO calls (external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at)
    SELECT 
        'log_run_system_' || nsm.system_message_id::text, 
        gpt.tool_id, 
        (SELECT template_id FROM tool_templates WHERE tool_id = gpt.tool_id LIMIT 1),
        '',
        true, 
        nsm.created_at, 
        nsm.updated_at
    FROM new_system_message nsm
    CROSS JOIN get_prompt_tool_id gpt
    WHERE NOT EXISTS (SELECT 1 FROM existing_system_message)
    RETURNING id as tool_call_id, created_at, updated_at
),
link_system_tool_call AS (
    INSERT INTO message_calls (message_id, call_id, created_at, updated_at)
    SELECT 
        nsm.system_message_id,
        stc.tool_call_id,
        NOW(),
        NOW()
    FROM new_system_message nsm
    CROSS JOIN system_tool_call stc
    WHERE NOT EXISTS (SELECT 1 FROM existing_system_message)
    ON CONFLICT (message_id, call_id) DO NOTHING
),
existing_system_tool_call AS (
    SELECT DISTINCT tc.id as tool_call_id
    FROM existing_system_message esm
    JOIN message_contents mc ON mc.message_id = esm.system_message_id AND mc.idx = 0
    JOIN message_runs mr ON mr.message_id = esm.system_message_id
    JOIN message_calls mcc ON mcc.message_id = esm.system_message_id
    JOIN calls tc ON tc.id = mcc.call_id
    LIMIT 1
),
system_tool_call_id AS (
    SELECT tool_call_id FROM system_tool_call
    UNION ALL
    SELECT tool_call_id FROM existing_system_tool_call
),
insert_system_content_step1 AS (
    INSERT INTO contents (content, created_at, updated_at)
    SELECT smc.content, nsm.created_at, nsm.updated_at
    FROM new_system_message nsm
    CROSS JOIN system_message_content smc
    CROSS JOIN system_tool_call_id stc
    WHERE NOT EXISTS (SELECT 1 FROM existing_system_message)
    RETURNING id as content_id, content, created_at, updated_at
),
insert_system_content AS (
    INSERT INTO message_contents (message_id, content_id, idx, created_at, updated_at)
    SELECT nsm.system_message_id, ic.content_id, 0, ic.created_at, ic.updated_at
    FROM new_system_message nsm
    CROSS JOIN system_message_content smc
    CROSS JOIN system_tool_call_id stc
    JOIN insert_system_content_step1 ic ON ic.content = smc.content
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
    SELECT sm.system_message_id, x.run_id, NOW(), NOW()
    FROM params x
    CROSS JOIN system_message sm
    ON CONFLICT (message_id, run_id) DO UPDATE SET updated_at = NOW()
    RETURNING message_id as system_message_id
),
-- Process developer messages from array (preserve order for parent selection)
developer_contents_array AS (
    SELECT 
        t.content,
        t.idx
    FROM params x
    CROSS JOIN unnest(x.developer_contents) WITH ORDINALITY AS t(content, idx)
    WHERE x.developer_contents IS NOT NULL AND array_length(x.developer_contents, 1) > 0
),
developer_contents_filtered AS (
    SELECT 
        trim(t.content) as content,
        MIN(t.idx) as first_idx
    FROM developer_contents_array t
    WHERE trim(t.content) != ''
    GROUP BY trim(t.content)
),
-- Get or create developer messages with MD5 deduplication
developer_messages_processed AS (
    SELECT 
        dcf.content,
        dcf.first_idx,
        message_content_hash(dcf.content, 'developer') as hash
    FROM developer_contents_filtered dcf
),
existing_developer_messages_with_rn AS (
    SELECT 
        dmp.content,
        dmp.first_idx,
        m.id as message_id,
        ROW_NUMBER() OVER (PARTITION BY dmp.content ORDER BY m.created_at ASC) as rn
    FROM developer_messages_processed dmp
    JOIN messages m ON m.role = 'developer'
    JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
        JOIN contents cnt ON cnt.id = mc.content_id
        AND message_content_hash(cnt.content, 'developer') = dmp.hash
),
existing_developer_messages AS (
    SELECT 
        content,
        first_idx,
        message_id
    FROM existing_developer_messages_with_rn
    WHERE rn = 1
),
new_developer_messages AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'developer'::message_role, false, false, NOW(), NOW()
    FROM developer_messages_processed dmp
    WHERE NOT EXISTS (
        SELECT 1 FROM existing_developer_messages edm 
        WHERE edm.content = dmp.content
    )
    RETURNING id as message_id, created_at, updated_at
),
-- Get instruct tool_id for prompt agent
get_instruct_tool_id AS (
    SELECT t.id as tool_id
    FROM tool_artifact t
    INNER JOIN resource_tools rt ON rt.tool_id = t.id AND rt.resource = CAST('prompts' AS resources)
    INNER JOIN runs r_run_instruct ON r_run_instruct.id = (SELECT run_id FROM params LIMIT 1)
    
    
    WHERE t.name = 'instruct' AND t.active = true
    LIMIT 1
),
developer_calls_with_rn AS (
    INSERT INTO calls (external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at)
    SELECT 
        'log_run_developer_' || ndm.message_id::text, 
        git.tool_id, 
        (SELECT template_id FROM tool_templates WHERE tool_id = git.tool_id LIMIT 1),
        '',
        true, 
        ndm.created_at, 
        ndm.updated_at
    FROM new_developer_messages ndm
    CROSS JOIN get_instruct_tool_id git
    RETURNING id as tool_call_id, created_at, updated_at
),
link_developer_tool_calls AS (
    INSERT INTO message_calls (message_id, call_id, created_at, updated_at)
    SELECT 
        ndm.message_id,
        dtc.tool_call_id,
        NOW(),
        NOW()
    FROM new_developer_messages ndm
    CROSS JOIN developer_calls_with_rn dtc
    ON CONFLICT (message_id, call_id) DO NOTHING
),
developer_calls_ordered AS (
    SELECT 
        tool_call_id,
        created_at,
        ROW_NUMBER() OVER (ORDER BY created_at) as rn
    FROM developer_calls_with_rn
),
developer_messages_ordered AS (
    SELECT 
        message_id,
        created_at,
        updated_at,
        ROW_NUMBER() OVER (ORDER BY created_at) as rn
    FROM new_developer_messages
),
developer_message_with_tool_call AS (
    SELECT 
        dmo.message_id,
        dmo.created_at,
        dmo.updated_at,
        dtco.tool_call_id
    FROM developer_messages_ordered dmo
    JOIN developer_calls_ordered dtco ON dtco.rn = dmo.rn
),
existing_developer_calls AS (
    SELECT edm.message_id, tc.id as tool_call_id
    FROM existing_developer_messages edm
    JOIN message_contents mc ON mc.message_id = edm.message_id AND mc.idx = 0
    JOIN message_runs mr ON mr.message_id = edm.message_id
    JOIN message_calls mcc2 ON mcc2.message_id = edm.message_id
    JOIN calls tc ON tc.id = mcc2.call_id
),
all_developer_calls AS (
    SELECT message_id, tool_call_id FROM developer_message_with_tool_call
    UNION ALL
    SELECT message_id, tool_call_id FROM existing_developer_calls
),
insert_developer_content_step1 AS (
    INSERT INTO contents (content, created_at, updated_at)
    SELECT 
        dmp.content, 
        dmtc.created_at,
        dmtc.updated_at
    FROM all_developer_calls adtcm
    JOIN developer_message_with_tool_call dmtc ON dmtc.message_id = adtcm.message_id
    JOIN developer_messages_processed dmp ON EXISTS (
        SELECT 1 FROM new_developer_messages ndm 
        WHERE ndm.message_id = adtcm.message_id
    )
    WHERE NOT EXISTS (
        SELECT 1 FROM existing_developer_messages edm 
        JOIN message_contents mc2 ON mc2.message_id = edm.message_id AND mc2.idx = 0
        JOIN contents cnt2 ON cnt2.id = mc2.content_id
        WHERE cnt2.content = dmp.content
    )
    RETURNING id as content_id, created_at, updated_at
),
insert_developer_content AS (
    INSERT INTO message_contents (message_id, content_id, idx, created_at, updated_at)
    SELECT 
        adtcm.message_id,
        ic.content_id,
        0,
        ic.created_at,
        ic.updated_at
    FROM all_developer_calls adtcm
    JOIN developer_message_with_tool_call dmtc ON dmtc.message_id = adtcm.message_id
    JOIN developer_messages_processed dmp ON EXISTS (
        SELECT 1 FROM new_developer_messages ndm 
        WHERE ndm.message_id = adtcm.message_id
    )
    CROSS JOIN insert_developer_content_step1 ic
    WHERE NOT EXISTS (
        SELECT 1 FROM existing_developer_messages edm 
        JOIN message_contents mc2 ON mc2.message_id = edm.message_id AND mc2.idx = 0
        JOIN contents cnt2 ON cnt2.id = mc2.content_id
        WHERE cnt2.content = dmp.content
    )
),
all_developer_messages AS (
    SELECT message_id, content, first_idx FROM existing_developer_messages
    UNION ALL
    SELECT ndm.message_id, dmp.content, dmp.first_idx 
    FROM developer_messages_processed dmp
    JOIN new_developer_messages ndm ON NOT EXISTS (
        SELECT 1 FROM existing_developer_messages edm 
        WHERE edm.content = dmp.content
    )
),
-- Link developer messages to run (preserve order for parent selection)
link_developers AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT adm.message_id, x.run_id, NOW(), NOW()
    FROM params x
    CROSS JOIN all_developer_messages adm
    ORDER BY adm.first_idx
    ON CONFLICT (message_id, run_id) 
    DO UPDATE SET updated_at = NOW()
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
    CROSS JOIN link_developers ld
    WHERE NOT EXISTS (
        SELECT 1 FROM message_tree mt 
        WHERE mt.parent_id = ls.system_message_id 
        AND mt.child_id = ld.developer_message_id 
        AND mt.active = true
    )
),
-- Create assistant message if output provided
assistant_message AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'assistant'::message_role, true, false, NOW(), NOW()
    FROM params x
    WHERE x.assistant_output IS NOT NULL AND trim(x.assistant_output) != ''
    RETURNING id as assistant_message_id, created_at, updated_at
),
assistant_tool_call AS (
    INSERT INTO calls (external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at)
    SELECT 
        'log_run_assistant_' || am.assistant_message_id::text, 
        NULL, 
        NULL,
        '',
        true, 
        am.created_at, 
        am.updated_at
    FROM params x
    CROSS JOIN assistant_message am
    WHERE x.assistant_output IS NOT NULL AND trim(x.assistant_output) != ''
    RETURNING id as tool_call_id, created_at, updated_at
),
link_assistant_tool_call AS (
    INSERT INTO message_calls (message_id, call_id, created_at, updated_at)
    SELECT 
        am.assistant_message_id,
        atc.tool_call_id,
        NOW(),
        NOW()
    FROM assistant_message am
    CROSS JOIN assistant_tool_call atc
    ON CONFLICT (message_id, call_id) DO NOTHING
),
insert_assistant_content_step1 AS (
    INSERT INTO contents (content, created_at, updated_at)
    SELECT trim(x.assistant_output), am.created_at, am.updated_at
    FROM params x
    CROSS JOIN assistant_message am
    CROSS JOIN assistant_tool_call atc
    WHERE x.assistant_output IS NOT NULL AND trim(x.assistant_output) != ''
    RETURNING id as content_id, created_at, updated_at
),
insert_assistant_content AS (
    INSERT INTO message_contents (message_id, content_id, idx, created_at, updated_at)
    SELECT am.assistant_message_id, ic.content_id, 0, ic.created_at, ic.updated_at
    FROM params x
    CROSS JOIN assistant_message am
    CROSS JOIN assistant_tool_call atc
    CROSS JOIN insert_assistant_content_step1 ic
    WHERE x.assistant_output IS NOT NULL AND trim(x.assistant_output) != ''
),
link_assistant AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT am.assistant_message_id, x.run_id, NOW(), NOW()
    FROM params x
    CROSS JOIN assistant_message am
    ON CONFLICT (message_id, run_id) 
    DO UPDATE SET updated_at = NOW()
),
-- Determine parent for assistant message (last developer if exists, otherwise system)
-- Note: link_developers returns rows in insertion order, so last row is the last developer message
assistant_parent AS (
    SELECT 
        COALESCE(
            (SELECT developer_message_id FROM link_developers ORDER BY developer_message_id DESC LIMIT 1),
            (SELECT system_message_id FROM link_system LIMIT 1)
        ) as parent_message_id
),
-- Create message_tree branch for assistant
create_assistant_branch AS (
    INSERT INTO message_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT 
        ap.parent_message_id,
        am.assistant_message_id,
        true,
        NOW(),
        NOW()
    FROM assistant_message am
    CROSS JOIN assistant_parent ap
    WHERE ap.parent_message_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM message_tree mt 
        WHERE mt.parent_id = ap.parent_message_id 
        AND mt.child_id = am.assistant_message_id 
        AND mt.active = true
    )
    ON CONFLICT (parent_id, child_id) 
    DO UPDATE SET 
        active = true,
        updated_at = NOW()
)
SELECT 1 AS success
$$;