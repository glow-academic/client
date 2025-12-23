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
    JOIN chat_groups cg ON cg.group_id = rg.group_id
    JOIN chats c ON c.id = cg.chat_id
),
-- Find first run (idx = 0) for each group
first_runs_map AS (
    SELECT DISTINCT
        gr.group_id,
        gr.run_id as first_run_id
    FROM group_runs gr
    WHERE gr.idx = 0
),
-- Map each run to its previous run (idx - 1) in the same group
previous_runs_map AS (
    SELECT 
        gr_current.group_id,
        gr_current.run_id as current_run_id,
        gr_previous.run_id as previous_run_id
    FROM group_runs gr_current
    JOIN group_runs gr_previous ON gr_previous.group_id = gr_current.group_id
        AND gr_previous.idx = gr_current.idx - 1
    WHERE gr_current.idx > 0  -- Only non-first runs have a previous run
),
-- Tree traversal for messages: get all messages following conversation flow per run
messages_with_tree AS (
    WITH RECURSIVE message_path AS (
        -- Base case: Include ALL messages from current run
        -- We include all messages from the current run, regardless of whether they have children
        -- The recursive traversal will handle following parent links
        SELECT 
            m.id, 
            rcm.run_id,
            rcm.chat_id,
            m.role, 
            m.created_at, 
            m.completed, 
            m.updated_at,
            0 as depth,
            m.id as path_root_id,
            gr.idx as run_idx  -- Track run idx for ordering
        FROM run_chats_map rcm
        JOIN run_groups_map rgm ON rgm.run_id = rcm.run_id
        JOIN groups g ON g.id = rgm.group_id
        JOIN group_runs gr ON gr.group_id = g.id AND gr.run_id = rcm.run_id
        JOIN runs r ON r.id = gr.run_id
        JOIN message_runs mr ON mr.run_id = r.id AND mr.run_id = rcm.run_id
        JOIN messages m ON m.id = mr.message_id
        JOIN chat_groups cg ON cg.group_id = g.id
        JOIN chats c ON c.id = cg.chat_id AND c.id = rcm.chat_id
        
        UNION ALL
        
        -- Recursive case: Traverse up the tree following parent links
        -- Only traverse to parents that are ancestors of messages in the current group
        -- This prevents including system/developer messages from other groups
        SELECT 
            m.id, 
            mp.run_id,  -- Keep the child's run_id (the run we're querying for)
            mp.chat_id,
            m.role, 
            m.created_at, 
            m.completed, 
            m.updated_at,
            mp.depth + 1 as depth,
            mp.path_root_id,
            mp.run_idx  -- Keep the run_idx from child (will be adjusted later if needed)
        FROM messages m
        JOIN message_tree mt ON mt.parent_id = m.id AND mt.active = true
        JOIN message_path mp ON mp.id = mt.child_id
        -- Only include parents that are linked to the same group as the child's run
        -- AND where the parent-child relationship exists within that same group context
        -- This ensures we don't traverse to system/developer messages from other groups
        WHERE mp.depth < 50  -- Safety limit to prevent excessive recursion
        AND EXISTS (
            -- Verify parent is linked to the same group as the child's run
            -- AND that the child (which we're traversing from) is also in that same group
            SELECT 1 
            FROM message_runs mr_parent
            JOIN group_runs gr_parent ON gr_parent.run_id = mr_parent.run_id
            JOIN message_runs mr_child ON mr_child.message_id = mt.child_id
            JOIN group_runs gr_child ON gr_child.run_id = mr_child.run_id
            WHERE mr_parent.message_id = m.id
            AND gr_parent.group_id = gr_child.group_id
            AND gr_child.run_id = mp.run_id  -- Ensure child is from the run we're querying
            -- For system/developer messages, they must be in first run (idx=0)
            AND (m.role IN ('user', 'assistant') OR gr_parent.idx = 0)
        )
    ),
    -- Include messages without parents (backward compatibility for existing messages)
    -- Use depth=0 for root messages (they will be ordered by created_at within message_tree structure)
    -- For non-first runs: also include all messages from previous run in same group
    messages_without_parents AS (
        -- Messages linked to current run that don't have parents and weren't captured in message_path
        -- These are root messages in the tree, so depth=0
        SELECT 
            m.id, 
            rcm.run_id,
            rcm.chat_id,
            m.role, 
            m.created_at, 
            m.completed, 
            m.updated_at,
            0 as depth,  -- Root messages have depth 0 (will be ordered by created_at)
            m.id as path_root_id,
            gr.idx as run_idx  -- Track run idx for ordering
        FROM run_chats_map rcm
        JOIN run_groups_map rgm ON rgm.run_id = rcm.run_id
        JOIN groups g ON g.id = rgm.group_id
        JOIN group_runs gr ON gr.group_id = g.id AND gr.run_id = rcm.run_id
        JOIN runs r ON r.id = gr.run_id
        JOIN message_runs mr ON mr.run_id = r.id AND mr.run_id = rcm.run_id
        JOIN messages m ON m.id = mr.message_id
        JOIN chat_groups cg ON cg.group_id = g.id
        JOIN chats c ON c.id = cg.chat_id AND c.id = rcm.chat_id
        WHERE NOT EXISTS (
            SELECT 1 FROM message_tree mt 
            WHERE mt.child_id = m.id AND mt.active = true
        )
        AND NOT EXISTS (
            SELECT 1 FROM message_path mp 
            WHERE mp.id = m.id AND mp.run_id = rcm.run_id
        )
        
        UNION
        
        -- System/developer messages from first run (for non-first runs)
        -- These are only linked to first run but should appear in all runs
        -- Include them regardless of whether they have children (they link to user messages)
        -- Use depth=0 as they are root messages in their run context
        SELECT 
            m.id, 
            rcm.run_id,
            rcm.chat_id,
            m.role, 
            m.created_at, 
            m.completed, 
            m.updated_at,
            0 as depth,  -- Root messages have depth 0 (will be ordered by created_at)
            m.id as path_root_id,
            0 as run_idx  -- System/dev messages are from first run (idx=0)
        FROM run_chats_map rcm
        JOIN run_groups_map rgm ON rgm.run_id = rcm.run_id
        JOIN groups g ON g.id = rgm.group_id
        JOIN group_runs gr ON gr.group_id = g.id AND gr.run_id = rcm.run_id
        JOIN first_runs_map frm ON frm.group_id = g.id AND frm.first_run_id != rcm.run_id
        JOIN message_runs mr ON mr.run_id = frm.first_run_id
        JOIN messages m ON m.id = mr.message_id AND m.role IN ('system', 'developer')
        JOIN chat_groups cg ON cg.group_id = g.id
        JOIN chats c ON c.id = cg.chat_id AND c.id = rcm.chat_id
        WHERE NOT EXISTS (
            SELECT 1 FROM message_path mp 
            WHERE mp.id = m.id AND mp.run_id = rcm.run_id
        )
        AND NOT EXISTS (
            -- Don't include if already linked to current run
            SELECT 1 FROM message_runs mr2
            WHERE mr2.message_id = m.id AND mr2.run_id = rcm.run_id
        )
    ),
    -- Combine tree-traversed messages and messages without parents
    all_messages AS (
        SELECT * FROM message_path
        UNION ALL
        SELECT * FROM messages_without_parents
    ),
    -- Select distinct messages ordered by conversation flow
    -- Adjust run_idx to reflect actual run the message belongs to
    -- Deduplicate: if same message appears multiple times, keep only the one with minimum depth
    message_run_idx AS (
        SELECT DISTINCT ON (am.id, am.run_id)
            am.id,
            am.run_id,
            am.chat_id,
            am.role,
            am.created_at,
            am.completed,
            am.updated_at,
            am.depth,
            -- Get actual run idx: prefer message's own run, fallback to child's run_idx
            COALESCE(
                (SELECT gr.idx FROM message_runs mr2 
                 JOIN group_runs gr ON gr.run_id = mr2.run_id 
                 WHERE mr2.message_id = am.id 
                 ORDER BY gr.idx LIMIT 1),
                am.run_idx
            ) as run_idx
        FROM all_messages am
        ORDER BY am.id, am.run_id, am.run_idx, am.depth ASC
    )
    SELECT 
        mri.id,
        mri.run_id,
        mri.chat_id,
        mri.role,
        mri.created_at,
        mri.completed,
        mri.updated_at,
        mri.depth,
        mri.run_idx
    FROM message_run_idx mri
),
-- Get all content entries for each message
messages_with_content AS (
    SELECT 
        mwt.id,
        mwt.run_id,
        mwt.role,
        mwt.created_at,
        mwt.completed,
        mwt.updated_at,
        mwt.run_idx,
        mwt.depth,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'idx', mc.idx,
                    'content', mc.content,
                    'createdAt', mc.created_at,
                    'updatedAt', mc.updated_at
                ) ORDER BY mc.idx
            ) FILTER (WHERE mc.idx IS NOT NULL),
            jsonb_build_array(
                jsonb_build_object(
                    'idx', 0,
                    'content', '',
                    'createdAt', mwt.created_at,
                    'updatedAt', mwt.updated_at
                )
            )
        ) as contents
    FROM messages_with_tree mwt
    LEFT JOIN message_content mc ON mc.message_id = mwt.id
    GROUP BY mwt.id, mwt.run_id, mwt.role, mwt.created_at, mwt.completed, mwt.updated_at, mwt.run_idx, mwt.depth
),
-- Get run idx for each run
runs_with_idx AS (
    SELECT 
        rm.run_id,
        gr.idx as run_idx,
        gr.group_id
    FROM runs_metadata rm
    JOIN group_runs gr ON gr.run_id = rm.run_id
),
-- For each run, find the latest message and traverse up message_tree to get all ancestors
-- This preserves message_tree ordering (source of truth) and includes all previous context
runs_with_messages AS (
    SELECT 
        current_run.run_id,
        current_run.run_idx as current_run_idx,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', ancestor_msg.id::text,
                    'role', ancestor_msg.role,
                    'contents', ancestor_msg.contents,
                    'createdAt', ancestor_msg.created_at,
                    'updatedAt', ancestor_msg.updated_at,
                    'completed', ancestor_msg.completed,
                    'runIdx', ancestor_msg.run_idx,
                    'depth', COALESCE(ancestor_msg.depth, 0)  -- Depth from root (0 = root, increases toward latest message)
                ) ORDER BY 
                    ancestor_msg.depth ASC  -- Order by depth: root messages (depth 0) first, latest message (highest depth) last
            ) FILTER (WHERE ancestor_msg.id IS NOT NULL),
            '[]'::jsonb
        ) as messages
    FROM runs_with_idx current_run
    -- Find the latest message in the current run (most recent assistant message, or user if no assistant)
    LEFT JOIN LATERAL (
        SELECT m.id, m.created_at
        FROM message_runs mr
        JOIN messages m ON m.id = mr.message_id
        WHERE mr.run_id = current_run.run_id
        AND m.role IN ('user', 'assistant')
        ORDER BY 
            CASE WHEN m.role = 'assistant' THEN 0 ELSE 1 END,  -- Prefer assistant over user
            m.created_at DESC
        LIMIT 1
    ) latest_msg ON true
    -- Traverse up message_tree from latest message to get all ancestors
    -- Only traverse within the current group's context
    LEFT JOIN LATERAL (
        WITH RECURSIVE ancestor_path AS (
            -- Start from the latest message
            SELECT 
                m.id,
                m.role,
                mc.contents,
                m.created_at,
                m.updated_at,
                m.completed,
                current_run.run_idx as run_idx,
                0 as depth_from_latest  -- Track depth from latest message (for ordering)
            FROM messages m
            LEFT JOIN LATERAL (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'idx', mc2.idx,
                        'content', mc2.content,
                        'createdAt', mc2.created_at,
                        'updatedAt', mc2.updated_at
                    ) ORDER BY mc2.idx
                ) FILTER (WHERE mc2.idx IS NOT NULL) as contents
                FROM message_content mc2
                WHERE mc2.message_id = m.id
            ) mc ON true
            WHERE m.id = latest_msg.id
            
            UNION ALL
            
            -- Traverse up to parent, but only if parent is in the same group
            SELECT 
                m.id,
                m.role,
                mc.contents,
                m.created_at,
                m.updated_at,
                m.completed,
                -- Get run_idx: prefer message's own run (from message_runs), fallback to child's run_idx
                COALESCE(
                    (SELECT gr.idx FROM message_runs mr2 
                     JOIN group_runs gr ON gr.run_id = mr2.run_id 
                     WHERE mr2.message_id = m.id 
                     AND gr.group_id = current_run.group_id  -- Ensure same group
                     ORDER BY gr.idx LIMIT 1),
                    ap.run_idx
                ) as run_idx,
                ap.depth_from_latest + 1 as depth_from_latest  -- Increase depth as we go up
            FROM messages m
            JOIN message_tree mt ON mt.parent_id = m.id AND mt.active = true
            JOIN ancestor_path ap ON ap.id = mt.child_id
            LEFT JOIN LATERAL (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'idx', mc2.idx,
                        'content', mc2.content,
                        'createdAt', mc2.created_at,
                        'updatedAt', mc2.updated_at
                    ) ORDER BY mc2.idx
                ) FILTER (WHERE mc2.idx IS NOT NULL) as contents
                FROM message_content mc2
                WHERE mc2.message_id = m.id
            ) mc ON true
            -- Ensure parent is in the same group (via message_runs -> group_runs)
            WHERE ap.depth_from_latest < 50  -- Safety limit
            AND EXISTS (
                SELECT 1 
                FROM message_runs mr_parent
                JOIN group_runs gr_parent ON gr_parent.run_id = mr_parent.run_id
                WHERE mr_parent.message_id = m.id
                AND gr_parent.group_id = current_run.group_id
            )
        )
        -- Calculate actual depth from root (reverse depth_from_latest)
        -- Root messages have depth 0, latest message has highest depth
        -- Window function should work here - calculate max depth and subtract
        SELECT 
            ap.id,
            ap.role,
            ap.contents,
            ap.created_at,
            ap.updated_at,
            ap.completed,
            ap.run_idx,
            -- Calculate depth: max_depth - depth_from_latest
            -- Root messages (highest depth_from_latest) have depth 0
            -- Latest message (depth_from_latest = 0) has highest depth
            -- Window function calculates max across all rows in ancestor_path
            (MAX(ap.depth_from_latest) OVER () - ap.depth_from_latest)::integer as depth
        FROM ancestor_path ap
    ) ancestor_msg ON true
    GROUP BY current_run.run_id, current_run.run_idx
),
-- Calculate previousContextStartIndex for each run
-- Need to preserve the exact ordering from message_tree (depth-based) which is the source of truth
runs_with_context_index AS (
    SELECT 
        rwm.run_id,
        rwm.current_run_idx,
        rwm.messages,
        -- Calculate previousContextStartIndex: find first message index where runIdx equals current run idx
        -- This indicates where the current run's messages start (after previous context)
        -- For first run (idx=0), this will be NULL (no previous context)
        -- Ordering must EXACTLY match the ordering used in runs_with_messages aggregation
        -- which uses depth from message_tree as the source of truth
        CASE 
            WHEN rwm.current_run_idx = 0 THEN NULL::integer
            ELSE (
                -- Re-query messages_with_content to get depth information for proper ordering
                -- This ensures we match the exact ordering from message_tree
                SELECT msg_idx
                FROM (
                    SELECT 
                        row_number() OVER (ORDER BY 
                            -- EXACT match to runs_with_messages ordering (preserves message_tree order):
                            -- 1. Depth from message_tree (source of truth) - now available in JSON
                            CASE WHEN (msg->>'depth') IS NULL THEN 999999 ELSE (msg->>'depth')::integer END ASC,
                            -- 2. Role-based ordering (tiebreaker)
                            CASE 
                                WHEN (msg->>'role') = 'system' THEN 1
                                WHEN (msg->>'role') = 'developer' THEN 2
                                WHEN (msg->>'role') = 'user' THEN 3
                                WHEN (msg->>'role') = 'assistant' THEN 4
                                ELSE 5
                            END,
                            -- 3. Then by runIdx (messages from earlier runs come first)
                            CASE WHEN (msg->>'runIdx') IS NULL THEN 999999 ELSE (msg->>'runIdx')::integer END,
                            -- 4. Then by createdAt for consistent ordering
                            (msg->>'createdAt')
                        ) - 1 as msg_idx,
                        CASE 
                            WHEN (msg->>'runIdx') IS NULL THEN 999999
                            ELSE (msg->>'runIdx')::integer
                        END as msg_run_idx
                    FROM jsonb_array_elements(rwm.messages) as msg
                ) indexed_msgs
                WHERE indexed_msgs.msg_run_idx = rwm.current_run_idx
                ORDER BY indexed_msgs.msg_idx
                LIMIT 1
            )
        END as previous_context_start_index
    FROM runs_with_messages rwm
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
        COALESCE(rwci.messages, '[]'::jsonb) as messages,
        rwci.previous_context_start_index
    FROM runs_metadata rm
    LEFT JOIN run_costs rc ON rc.run_id = rm.run_id
    LEFT JOIN runs_with_context_index rwci ON rwci.run_id = rm.run_id
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
                            'messages', rd.messages,
                            'previousContextStartIndex', rd.previous_context_start_index
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

