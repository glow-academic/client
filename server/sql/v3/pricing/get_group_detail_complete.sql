-- Get group detail with all runs, messages, and pricing information
-- Parameters: $1=group_id (uuid), $2=profile_id (uuid)
-- Returns: group metadata, array of runs with messages, pricing info, and mappings

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = (SELECT resolved_profile_id FROM resolve_profile_id)
),
group_runs_list AS (
    SELECT 
        gr.run_id
    FROM group_runs gr
    WHERE gr.group_id = $1::uuid
),
runs_metadata AS (
    SELECT 
        r.id as run_id,
        r.created_at,
        r.input_tokens,
        r.output_tokens,
        r.cached_input_tokens,
        r.key_id,
        r.agent_id,
        rm.model_id,
        rp.profile_id,
        rper.persona_id
    FROM group_runs_list grl
    JOIN runs r ON r.id = grl.run_id
    LEFT JOIN run_models rm ON rm.run_id = r.id AND rm.active = true
    LEFT JOIN run_profiles rp ON rp.run_id = r.id AND rp.active = true
    LEFT JOIN run_personas rper ON rper.run_id = r.id AND rper.active = true
),
-- Get department IDs from runs (via agent or profile)
runs_departments AS (
    SELECT DISTINCT
        d.id as department_id
    FROM runs_metadata rm
    LEFT JOIN agents a ON a.id = rm.agent_id
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    LEFT JOIN departments d ON d.id = ad.department_id AND d.active = true
    WHERE d.id IS NOT NULL
),
-- Check department access
group_access_check AS (
    SELECT 
        CASE 
            WHEN up.role = 'superadmin' THEN true
            WHEN EXISTS (
                SELECT 1 FROM runs_departments rd
                JOIN profile_departments pd ON pd.department_id = rd.department_id
                WHERE pd.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
                AND pd.active = true
            ) THEN true
            WHEN NOT EXISTS (SELECT 1 FROM runs_departments) THEN true  -- Cross-department resource
            ELSE false
        END as has_access
    FROM user_profile up
),
-- Calculate run costs
run_costs AS (
    SELECT 
        rpu.run_id,
        COALESCE(SUM(
            (rpu.count::numeric / u.value::numeric) * mp.price
        ), 0) as run_cost
    FROM run_pricing_usage rpu
    JOIN run_models rm ON rm.run_id = rpu.run_id AND rm.active = true
    JOIN model_pricing mp ON mp.model_id = rm.model_id 
        AND mp.pricing_type = rpu.pricing_type 
        AND mp.unit_id = rpu.unit_id
        AND mp.active = true
    JOIN units u ON u.id = rpu.unit_id
    JOIN group_runs_list grl ON grl.run_id = rpu.run_id
    GROUP BY rpu.run_id
),
-- Get all messages for each run using message_tree ordering (source of truth)
-- For each run, traverse message_tree to get messages in conversation flow order
run_groups_map AS (
    -- Map each run to its group
    SELECT DISTINCT
        rm.run_id,
        gr.group_id
    FROM runs_metadata rm
    JOIN group_runs gr ON gr.run_id = rm.run_id
),
run_chats_map AS (
    -- Map each run to all chats in its group
    SELECT DISTINCT
        rg.run_id,
        c.id as chat_id
    FROM run_groups_map rg
    JOIN chats c ON c.group_id = rg.group_id
),
-- Tree traversal for messages: get all messages following conversation flow per run
messages_with_tree AS (
    WITH RECURSIVE message_path AS (
        -- Base case: Start from latest messages (no active children in message_tree)
        SELECT 
            m.id, 
            rcm.run_id,
            rcm.chat_id,
            m.role, 
            m.content, 
            m.created_at, 
            m.completed, 
            m.updated_at,
            0 as depth,
            m.id as path_root_id
        FROM run_chats_map rcm
        JOIN run_groups_map rgm ON rgm.run_id = rcm.run_id
        JOIN groups g ON g.id = rgm.group_id
        JOIN group_runs gr ON gr.group_id = g.id AND gr.run_id = rcm.run_id
        JOIN runs r ON r.id = gr.run_id
        JOIN message_runs mr ON mr.run_id = r.id AND mr.run_id = rcm.run_id
        JOIN messages m ON m.id = mr.message_id
        JOIN chats c ON c.id = rcm.chat_id AND c.group_id = g.id
        WHERE NOT EXISTS (
            SELECT 1 FROM message_tree mt 
            WHERE mt.parent_id = m.id AND mt.active = true
        )
        
        UNION ALL
        
        -- Recursive case: Traverse up the tree following parent links
        -- Find parents (m) of children (mp) already in the path
        SELECT 
            m.id, 
            mp.run_id,
            mp.chat_id,
            m.role, 
            m.content, 
            m.created_at, 
            m.completed, 
            m.updated_at,
            mp.depth + 1 as depth,
            mp.path_root_id
        FROM messages m
        JOIN message_tree mt ON mt.parent_id = m.id AND mt.active = true
        JOIN message_path mp ON mp.id = mt.child_id
        JOIN message_runs mr ON mr.message_id = m.id AND mr.run_id = mp.run_id
        JOIN runs r ON r.id = mr.run_id
        JOIN group_runs gr ON gr.run_id = r.id
        JOIN groups g ON g.id = gr.group_id
        JOIN chats c ON c.group_id = g.id AND c.id = mp.chat_id
        WHERE mp.depth < 1000  -- Safety limit
    ),
    -- Include messages without parents (backward compatibility for existing messages)
    messages_without_parents AS (
        SELECT 
            m.id, 
            rcm.run_id,
            rcm.chat_id,
            m.role, 
            m.content, 
            m.created_at, 
            m.completed, 
            m.updated_at,
            -1 as depth,
            m.id as path_root_id
        FROM run_chats_map rcm
        JOIN run_groups_map rgm ON rgm.run_id = rcm.run_id
        JOIN groups g ON g.id = rgm.group_id
        JOIN group_runs gr ON gr.group_id = g.id AND gr.run_id = rcm.run_id
        JOIN runs r ON r.id = gr.run_id
        JOIN message_runs mr ON mr.run_id = r.id AND mr.run_id = rcm.run_id
        JOIN messages m ON m.id = mr.message_id
        JOIN chats c ON c.id = rcm.chat_id AND c.group_id = g.id
        WHERE NOT EXISTS (
            SELECT 1 FROM message_tree mt 
            WHERE mt.child_id = m.id AND mt.active = true
        )
        AND NOT EXISTS (
            SELECT 1 FROM message_path mp 
            WHERE mp.id = m.id AND mp.run_id = rcm.run_id
        )
    ),
    -- Combine tree-traversed messages and messages without parents
    all_messages AS (
        SELECT * FROM message_path
        UNION ALL
        SELECT * FROM messages_without_parents
    )
    -- Select distinct messages ordered by conversation flow
    SELECT DISTINCT ON (am.id, am.run_id)
        am.id,
        am.run_id,
        am.chat_id,
        am.role,
        am.content,
        am.created_at,
        am.completed,
        am.updated_at,
        am.depth
    FROM all_messages am
    ORDER BY am.id, am.run_id, am.created_at
),
runs_with_messages AS (
    -- Aggregate messages per run, ordered by chat then by tree traversal order
    SELECT 
        mwt.run_id,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', mwt.id::text,
                    'role', mwt.role,
                    'content', mwt.content,
                    'createdAt', mwt.created_at,
                    'updatedAt', mwt.updated_at,
                    'completed', mwt.completed
                ) ORDER BY mwt.chat_id, mwt.depth DESC, mwt.created_at
            ),
            '[]'::jsonb
        ) as messages
    FROM messages_with_tree mwt
    GROUP BY mwt.run_id
),
-- Build run details with messages
runs_detail AS (
    SELECT 
        rm.run_id,
        rm.created_at,
        rm.input_tokens,
        rm.output_tokens,
        rm.cached_input_tokens,
        rm.model_id,
        rm.agent_id,
        rm.profile_id,
        rm.persona_id,
        COALESCE(rc.run_cost, 0) as cost,
        COALESCE(rwm.messages, '[]'::jsonb) as messages
    FROM runs_metadata rm
    LEFT JOIN run_costs rc ON rc.run_id = rm.run_id
    LEFT JOIN runs_with_messages rwm ON rwm.run_id = rm.run_id
),
-- Build model mapping
model_mapping_data AS (
    SELECT 
        jsonb_object_agg(
            m.id::text,
            jsonb_build_object(
                'name', m.name,
                'description', COALESCE(m.description, '')
            )
        ) as model_mapping
    FROM runs_metadata rm
    LEFT JOIN models m ON m.id = rm.model_id
    WHERE m.id IS NOT NULL
),
-- Build agent mapping
agent_mapping_data AS (
    SELECT 
        jsonb_object_agg(
            a.id::text,
            a.name
        ) as agent_mapping
    FROM runs_metadata rm
    LEFT JOIN agents a ON a.id = rm.agent_id
    WHERE a.id IS NOT NULL
),
-- Build profile mapping
profile_mapping_data AS (
    SELECT 
        jsonb_object_agg(
            p.id::text,
            p.first_name || ' ' || p.last_name
        ) as profile_mapping
    FROM runs_metadata rm
    LEFT JOIN profiles p ON p.id = rm.profile_id
    WHERE p.id IS NOT NULL
)
SELECT 
    CASE 
        WHEN (SELECT has_access FROM group_access_check) = false THEN
            NULL::jsonb
        ELSE
            jsonb_build_object(
                'group_id', $1::text,
                'runs', COALESCE(
                    (SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', rd.run_id::text,
                            'createdAt', rd.created_at,
                            'inputTokens', rd.input_tokens,
                            'outputTokens', rd.output_tokens,
                            'cachedInputTokens', rd.cached_input_tokens,
                            'cost', rd.cost,
                            'modelId', CASE WHEN rd.model_id IS NOT NULL THEN rd.model_id::text ELSE NULL END,
                            'agentId', CASE WHEN rd.agent_id IS NOT NULL THEN rd.agent_id::text ELSE NULL END,
                            'profileId', CASE WHEN rd.profile_id IS NOT NULL THEN rd.profile_id::text ELSE NULL END,
                            'personaId', CASE WHEN rd.persona_id IS NOT NULL THEN rd.persona_id::text ELSE NULL END,
                            'messages', rd.messages
                        ) ORDER BY rd.created_at
                    )
                    FROM runs_detail rd),
                    '[]'::jsonb
                ),
                'modelMapping', COALESCE((SELECT model_mapping FROM model_mapping_data LIMIT 1), '{}'::jsonb),
                'agentMapping', COALESCE((SELECT agent_mapping FROM agent_mapping_data LIMIT 1), '{}'::jsonb),
                'profileMapping', COALESCE((SELECT profile_mapping FROM profile_mapping_data LIMIT 1), '{}'::jsonb)
            )
    END as result
FROM (SELECT $1::uuid as group_id) g
WHERE EXISTS (SELECT 1 FROM groups WHERE id = g.group_id);

