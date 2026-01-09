-- Get pricing group detail with all runs, messages, and pricing information
-- Converted to function with composite types
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
        WHERE proname = 'api_get_pricing_group_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_pricing_group_detail_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop types in dependency order: drop dependent types first (run_with_messages -> message -> content)
-- Use prefix pattern to find all types, but drop in correct order
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop run_with_messages first (depends on message and run_metadata)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_pricing_group_detail_v4_run_with_messages'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
    -- Drop message next (depends on content)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_pricing_group_detail_v4_message'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
    -- Drop remaining types
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_pricing_group_detail_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_pricing_group_detail_v4_content AS (
    idx int,
    content text,
    created_at timestamptz,
    updated_at timestamptz
);

CREATE TYPE types.q_get_pricing_group_detail_v4_message AS (
    id uuid,
    role text,
    contents types.q_get_pricing_group_detail_v4_content[],
    created_at timestamptz,
    updated_at timestamptz,
    completed boolean,
    run_idx int,
    depth int
);

CREATE TYPE types.q_get_pricing_group_detail_v4_run_metadata AS (
    id uuid,
    created_at timestamptz,
    input_tokens int,
    output_tokens int,
    cached_input_tokens int,
    cost numeric,
    model_id uuid,
    agent_id uuid,
    profile_id uuid,
    persona_id uuid
);

CREATE TYPE types.q_get_pricing_group_detail_v4_run_with_messages AS (
    run types.q_get_pricing_group_detail_v4_run_metadata,
    messages types.q_get_pricing_group_detail_v4_message[],
    previous_context_start_index int
);

CREATE TYPE types.q_get_pricing_group_detail_v4_model AS (
    model_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_pricing_group_detail_v4_agent AS (
    agent_id uuid,
    name text
);

CREATE TYPE types.q_get_pricing_group_detail_v4_profile AS (
    profile_id uuid,
    name text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_pricing_group_detail_v4(
    group_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    group_exists boolean,
    group_id uuid,
    actor_name text,
    runs types.q_get_pricing_group_detail_v4_run_with_messages[],
    models types.q_get_pricing_group_detail_v4_model[],
    agents types.q_get_pricing_group_detail_v4_agent[],
    profiles types.q_get_pricing_group_detail_v4_profile[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        group_id AS group_id,
        profile_id AS profile_id
),
group_exists_check AS (
    SELECT EXISTS(SELECT 1 FROM groups WHERE id = (SELECT group_id FROM params)) as group_exists
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params) IS NULL THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)
        END as resolved_profile_id
),
user_profile AS (
    SELECT 
        p.role,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    LEFT JOIN profiles p ON p.id = x.profile_id
    WHERE x.profile_id IS NOT NULL
),
group_runs_list AS (
    SELECT 
        gr.run_id
    FROM group_runs gr
    WHERE gr.group_id = (SELECT group_id FROM params)
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
    LEFT JOIN departments d ON d.id = ad.department_id AND EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = true)
    WHERE d.id IS NOT NULL
),
-- Check department access
group_access_check AS (
    SELECT 
        CASE 
            WHEN up.role = 'superadmin'::profile_role THEN true
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
    WHERE gr.idx = 0 AND gr.group_id = (SELECT group_id FROM params)
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
    WHERE gr_current.idx > 0 AND gr_current.group_id = (SELECT group_id FROM params)
),
-- Tree traversal for messages: get all messages following conversation flow per run
messages_with_tree AS (
    WITH RECURSIVE message_path AS (
        -- Base case: Include ALL messages from current run
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
            gr.idx as run_idx
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
        SELECT 
            m.id, 
            mp.run_id,
            mp.chat_id,
            m.role, 
            m.created_at, 
            m.completed, 
            m.updated_at,
            mp.depth + 1 as depth,
            mp.path_root_id,
            mp.run_idx
        FROM messages m
        JOIN message_tree mt ON mt.parent_id = m.id AND mt.active = true
        JOIN message_path mp ON mp.id = mt.child_id
        WHERE mp.depth < 50
        AND EXISTS (
            SELECT 1 
            FROM message_runs mr_parent
            JOIN group_runs gr_parent ON gr_parent.run_id = mr_parent.run_id
            JOIN message_runs mr_child ON mr_child.message_id = mt.child_id
            JOIN group_runs gr_child ON gr_child.run_id = mr_child.run_id
            WHERE mr_parent.message_id = m.id
            AND gr_parent.group_id = gr_child.group_id
            AND gr_child.run_id = mp.run_id
            AND (m.role IN ('user'::message_role, 'assistant'::message_role) OR gr_parent.idx = 0)
        )
    ),
    messages_without_parents AS (
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
            gr.idx as run_idx
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
            0 as run_idx
        FROM run_chats_map rcm
        JOIN run_groups_map rgm ON rgm.run_id = rcm.run_id
        JOIN groups g ON g.id = rgm.group_id
        JOIN group_runs gr ON gr.group_id = g.id AND gr.run_id = rcm.run_id
        JOIN first_runs_map frm ON frm.group_id = g.id AND frm.first_run_id != rcm.run_id
        JOIN message_runs mr ON mr.run_id = frm.first_run_id
        JOIN messages m ON m.id = mr.message_id AND m.role IN ('system'::message_role, 'developer'::message_role)
        JOIN chat_groups cg ON cg.group_id = g.id
        JOIN chats c ON c.id = cg.chat_id AND c.id = rcm.chat_id
        WHERE NOT EXISTS (
            SELECT 1 FROM message_path mp 
            WHERE mp.id = m.id AND mp.run_id = rcm.run_id
        )
        AND NOT EXISTS (
            SELECT 1 FROM message_runs mr2
            WHERE mr2.message_id = m.id AND mr2.run_id = rcm.run_id
        )
    ),
    all_messages AS (
        SELECT * FROM message_path
        UNION ALL
        SELECT * FROM messages_without_parents
    ),
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
            ARRAY_AGG(
                (mc.idx, cnt.content, mc.created_at, mc.updated_at)::types.q_get_pricing_group_detail_v4_content
                ORDER BY mc.idx
            ) FILTER (WHERE mc.idx IS NOT NULL),
            ARRAY[(0, '', mwt.created_at, mwt.updated_at)::types.q_get_pricing_group_detail_v4_content]
        ) as contents
    FROM messages_with_tree mwt
    LEFT JOIN message_contents mc ON mc.message_id = mwt.id
    LEFT JOIN contents cnt ON cnt.id = mc.content_id
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
runs_with_messages AS (
    SELECT 
        current_run.run_id,
        current_run.run_idx as current_run_idx,
        COALESCE(
            ARRAY_AGG(
                (ancestor_msg.id, ancestor_msg.role, ancestor_msg.contents, ancestor_msg.created_at, ancestor_msg.updated_at, ancestor_msg.completed, ancestor_msg.run_idx, COALESCE(ancestor_msg.depth, 0))::types.q_get_pricing_group_detail_v4_message
                ORDER BY ancestor_msg.depth ASC
            ) FILTER (WHERE ancestor_msg.id IS NOT NULL),
            '{}'::types.q_get_pricing_group_detail_v4_message[]
        ) as messages
    FROM runs_with_idx current_run
    LEFT JOIN LATERAL (
        SELECT m.id, m.created_at
        FROM message_runs mr
        JOIN messages m ON m.id = mr.message_id
        WHERE mr.run_id = current_run.run_id
        AND m.role IN ('user'::message_role, 'assistant'::message_role)
        ORDER BY 
            CASE WHEN m.role = 'assistant'::message_role THEN 0 ELSE 1 END,
            m.created_at DESC
        LIMIT 1
    ) latest_msg ON true
    LEFT JOIN LATERAL (
        WITH RECURSIVE ancestor_path AS (
            SELECT 
                m.id,
                m.role,
                mwc.contents,
                m.created_at,
                m.updated_at,
                m.completed,
                current_run.run_idx as run_idx,
                0 as depth_from_latest
            FROM messages m
            LEFT JOIN messages_with_content mwc ON mwc.id = m.id AND mwc.run_id = current_run.run_id
            WHERE m.id = latest_msg.id
            
            UNION ALL
            
            SELECT 
                m.id,
                m.role,
                mwc.contents,
                m.created_at,
                m.updated_at,
                m.completed,
                COALESCE(
                    (SELECT gr.idx FROM message_runs mr2 
                     JOIN group_runs gr ON gr.run_id = mr2.run_id 
                     WHERE mr2.message_id = m.id 
                     AND gr.group_id = current_run.group_id
                     ORDER BY gr.idx LIMIT 1),
                    ap.run_idx
                ) as run_idx,
                ap.depth_from_latest + 1 as depth_from_latest
            FROM messages m
            JOIN message_tree mt ON mt.parent_id = m.id AND mt.active = true
            JOIN ancestor_path ap ON ap.id = mt.child_id
            LEFT JOIN messages_with_content mwc ON mwc.id = m.id AND mwc.run_id = current_run.run_id
            WHERE ap.depth_from_latest < 50
            AND EXISTS (
                SELECT 1 
                FROM message_runs mr_parent
                JOIN group_runs gr_parent ON gr_parent.run_id = mr_parent.run_id
                WHERE mr_parent.message_id = m.id
                AND gr_parent.group_id = current_run.group_id
            )
        )
        SELECT 
            ap.id,
            ap.role,
            ap.contents,
            ap.created_at,
            ap.updated_at,
            ap.completed,
            ap.run_idx,
            (MAX(ap.depth_from_latest) OVER () - ap.depth_from_latest)::integer as depth
        FROM ancestor_path ap
    ) ancestor_msg ON true
    GROUP BY current_run.run_id, current_run.run_idx
),
-- Calculate previousContextStartIndex for each run
-- Need to find first message index where run_idx equals current run idx
runs_with_context_index AS (
    SELECT 
        rwm.run_id,
        rwm.current_run_idx,
        rwm.messages,
        CASE 
            WHEN rwm.current_run_idx = 0 THEN NULL::integer
            ELSE (
                SELECT MIN(msg_idx) - 1
                FROM (
                    SELECT 
                        row_number() OVER (ORDER BY 
                            m.depth ASC,
                            CASE 
                                WHEN m.role::message_role = 'system'::message_role THEN 1
                                WHEN m.role::message_role = 'developer'::message_role THEN 2
                                WHEN m.role::message_role = 'user'::message_role THEN 3
                                WHEN m.role::message_role = 'assistant'::message_role THEN 4
                                ELSE 5
                            END,
                            m.run_idx,
                            m.created_at
                        ) as msg_idx,
                        m.run_idx
                    FROM unnest(rwm.messages) m
                ) indexed_msgs
                WHERE indexed_msgs.run_idx = rwm.current_run_idx
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
        COALESCE(rwci.messages, '{}'::types.q_get_pricing_group_detail_v4_message[]) as messages,
        rwci.previous_context_start_index
    FROM runs_metadata rm
    LEFT JOIN run_costs rc ON rc.run_id = rm.run_id
    LEFT JOIN runs_with_context_index rwci ON rwci.run_id = rm.run_id
)
SELECT 
    (SELECT group_exists FROM group_exists_check)::boolean as group_exists,
    (SELECT group_id FROM params)::uuid as group_id,
    COALESCE((SELECT actor_name FROM user_profile LIMIT 1), 'System')::text as actor_name,
    CASE 
        WHEN (SELECT has_access FROM group_access_check) = false THEN
            '{}'::types.q_get_pricing_group_detail_v4_run_with_messages[]
        ELSE
            COALESCE(
                ARRAY_AGG(
                    (
                        (rd.run_id, rd.created_at, rd.input_tokens, rd.output_tokens, rd.cached_input_tokens, rd.cost, rd.model_id, rd.agent_id, rd.profile_id, rd.persona_id)::types.q_get_pricing_group_detail_v4_run_metadata,
                        rd.messages,
                        rd.previous_context_start_index
                    )::types.q_get_pricing_group_detail_v4_run_with_messages
                    ORDER BY rd.created_at
                ),
                '{}'::types.q_get_pricing_group_detail_v4_run_with_messages[]
            )
    END as runs,
    COALESCE(
        ARRAY_AGG(
            DISTINCT (m.id, (SELECT n.name FROM model_names mn JOIN names n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1), COALESCE((SELECT d.description FROM model_descriptions md JOIN descriptions d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1), ''))::types.q_get_pricing_group_detail_v4_model
        ) FILTER (WHERE m.id IS NOT NULL),
        '{}'::types.q_get_pricing_group_detail_v4_model[]
    ) as models,
    COALESCE(
        ARRAY_AGG(
            DISTINCT (a.id, (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1))::types.q_get_pricing_group_detail_v4_agent
        ) FILTER (WHERE a.id IS NOT NULL),
        '{}'::types.q_get_pricing_group_detail_v4_agent[]
    ) as agents,
    COALESCE(
        ARRAY_AGG(
            DISTINCT (p.id, COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''))::types.q_get_pricing_group_detail_v4_profile
        ) FILTER (WHERE p.id IS NOT NULL),
        '{}'::types.q_get_pricing_group_detail_v4_profile[]
    ) as profiles
FROM runs_detail rd
LEFT JOIN models m ON m.id = rd.model_id
LEFT JOIN agents a ON a.id = rd.agent_id
LEFT JOIN profiles p ON p.id = rd.profile_id
CROSS JOIN group_exists_check gec
CROSS JOIN group_access_check gac
WHERE (SELECT group_exists FROM group_exists_check) = true
GROUP BY (SELECT group_exists FROM group_exists_check), (SELECT group_id FROM params), (SELECT actor_name FROM user_profile LIMIT 1), (SELECT has_access FROM group_access_check)
$$;