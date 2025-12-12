-- Complete log_run handler: token updates + message logging in single transaction
-- Parameters: 
--   $1=run_id (uuid)
--   $2=department_id (uuid, nullable)
--   $3=input_text_tokens (integer)
--   $4=input_audio_tokens (integer, nullable, use 0 if not provided)
--   $5=input_image_tokens (integer, nullable, use 0 if not provided)
--   $6=output_text_tokens (integer)
--   $7=output_audio_tokens (integer, nullable, use 0 if not provided)
--   $8=cached_text_tokens (integer, nullable, use 0 if not provided)
--   $9=cached_audio_tokens (integer, nullable, use 0 if not provided)
--   $10=developer_contents (text[], array of developer message contents)
--   $11=assistant_output (text, nullable)
-- 
-- Handles both text-only and audio/image/text token scenarios in one query
-- Links system messages, developer messages, creates assistant message, and links message_tree

WITH run_info AS (
    SELECT 
        r.id as run_id,
        r.agent_id,
        (SELECT rp.persona_id FROM run_personas rp WHERE rp.run_id = r.id AND rp.active = true LIMIT 1) as persona_id,
        COALESCE(
            $2::uuid,
            -- Try to get department from chat
            (SELECT sd.department_id FROM chat_runs cr 
             JOIN chats c ON c.id = cr.chat_id
             JOIN scenario_departments sd ON sd.scenario_id = c.scenario_id AND sd.active = true
             WHERE cr.run_id = r.id LIMIT 1),
            -- Try to get department from profile
            (SELECT pd.department_id FROM run_profiles rpf
             JOIN profile_departments pd ON pd.profile_id = rpf.profile_id AND pd.active = true
             WHERE rpf.run_id = r.id AND rpf.active = true LIMIT 1),
            -- Fallback to any active department
            (SELECT id FROM departments WHERE active = true LIMIT 1)
        ) as department_id
    FROM runs r
    WHERE r.id = $1::uuid
),
-- Token update: handle both text-only and audio/image/text scenarios
has_audio_or_image AS (
    SELECT 
        COALESCE($4, 0) > 0 OR COALESCE($5, 0) > 0 OR COALESCE($7, 0) > 0 OR COALESCE($9, 0) > 0 as has_audio_image
),
update_run AS (
    UPDATE runs 
    SET 
        input_tokens = CASE 
            WHEN (SELECT has_audio_image FROM has_audio_or_image) THEN
                COALESCE($3, 0) + COALESCE($4, 0) + COALESCE($5, 0)
            ELSE
                COALESCE($3, 0)
        END,
        output_tokens = CASE 
            WHEN (SELECT has_audio_image FROM has_audio_or_image) THEN
                COALESCE($6, 0) + COALESCE($7, 0)
            ELSE
                COALESCE($6, 0)
        END,
        cached_input_tokens = CASE 
            WHEN (SELECT has_audio_image FROM has_audio_or_image) THEN
                COALESCE($8, 0) + COALESCE($9, 0)
            ELSE
                COALESCE($8, 0)
        END
    WHERE id = $1::uuid
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
        $3,
        now()
    FROM update_run ur
    CROSS JOIN million_text_unit mtu
    WHERE $3 > 0 AND mtu.id IS NOT NULL
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
        $4,
        now()
    FROM update_run ur
    CROSS JOIN million_audio_unit mau
    WHERE COALESCE($4, 0) > 0 AND mau.id IS NOT NULL
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
        $5,
        now()
    FROM update_run ur
    CROSS JOIN million_image_unit miu
    WHERE COALESCE($5, 0) > 0 AND miu.id IS NOT NULL
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
        $6,
        now()
    FROM update_run ur
    CROSS JOIN million_text_unit mtu
    WHERE $6 > 0 AND mtu.id IS NOT NULL
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
        $7,
        now()
    FROM update_run ur
    CROSS JOIN million_audio_unit mau
    WHERE COALESCE($7, 0) > 0 AND mau.id IS NOT NULL
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
        $8,
        now()
    FROM update_run ur
    CROSS JOIN million_text_unit mtu
    WHERE COALESCE($8, 0) > 0 AND mtu.id IS NOT NULL
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
        $9,
        now()
    FROM update_run ur
    CROSS JOIN million_audio_unit mau
    WHERE COALESCE($9, 0) > 0 AND mau.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
-- Get system prompt for persona runs
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
    JOIN system_message_hash smh ON message_content_hash(m.content, 'system') = smh.hash
    WHERE m.role = 'system'
    LIMIT 1
),
new_system_message AS (
    INSERT INTO messages (role, content, completed, audio, created_at, updated_at)
    SELECT 'system'::message_role, smc.content, false, false, NOW(), NOW()
    FROM system_message_content smc
    WHERE NOT EXISTS (SELECT 1 FROM existing_system_message)
    RETURNING id as system_message_id
),
system_message AS (
    SELECT system_message_id FROM existing_system_message
    UNION ALL
    SELECT system_message_id FROM new_system_message
),
-- Link system message to run
link_system AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT sm.system_message_id, $1::uuid, NOW(), NOW()
    FROM system_message sm
    ON CONFLICT (message_id, run_id) DO UPDATE SET updated_at = NOW()
    RETURNING message_id as system_message_id
),
-- Process developer messages from array (preserve order for parent selection)
developer_contents_array AS (
    SELECT 
        t.content,
        t.idx
    FROM unnest($10::text[]) WITH ORDINALITY AS t(content, idx)
    WHERE $10 IS NOT NULL AND array_length($10::text[], 1) > 0
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
        AND message_content_hash(m.content, 'developer') = dmp.hash
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
    INSERT INTO messages (role, content, completed, audio, created_at, updated_at)
    SELECT 'developer'::message_role, dmp.content, false, false, NOW(), NOW()
    FROM developer_messages_processed dmp
    WHERE NOT EXISTS (
        SELECT 1 FROM existing_developer_messages edm 
        WHERE edm.content = dmp.content
    )
    RETURNING id as message_id, content
),
all_developer_messages AS (
    SELECT message_id, content, first_idx FROM existing_developer_messages
    UNION ALL
    SELECT ndm.message_id, ndm.content, dmp.first_idx 
    FROM developer_messages_processed dmp
    JOIN new_developer_messages ndm ON ndm.content = dmp.content
),
-- Link developer messages to run (preserve order for parent selection)
link_developers AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT adm.message_id, $1::uuid, NOW(), NOW()
    FROM all_developer_messages adm
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
    INSERT INTO messages (role, content, completed, audio, created_at, updated_at)
    SELECT 'assistant'::message_role, trim($11), true, false, NOW(), NOW()
    WHERE $11 IS NOT NULL AND trim($11) != ''
    RETURNING id as assistant_message_id
),
link_assistant AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT am.assistant_message_id, $1::uuid, NOW(), NOW()
    FROM assistant_message am
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
SELECT 1

