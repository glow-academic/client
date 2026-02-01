-- Get pricing group detail with all view_runs_entry, view_messages_entry, and pricing information
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
    SELECT EXISTS(SELECT 1 FROM view_groups_entry WHERE id = (SELECT group_id FROM params)) as group_exists
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params) IS NULL THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)
        END as resolved_profile_id
),
user_profile AS (
    SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
group_runs_list AS (
    SELECT
        r.id as run_id
    FROM view_runs_entry r
    WHERE r.group_id = (SELECT group_id FROM params)
),
runs_metadata AS (
    SELECT
        r.id as run_id,
        r.created_at,
        r.input_tokens,
        r.output_tokens,
        r.cached_input_tokens,
        rkc.key_id,
        arj.agent_id,
        (SELECT am.model_id FROM agent_models_junction am WHERE am.agent_id = arj.agent_id AND am.active = true LIMIT 1) as model_id,
        prj_rm.profile_id,
        NULL::uuid as persona_id
    FROM group_runs_list grl
    JOIN view_runs_entry r ON r.id = grl.run_id
    LEFT JOIN runs_keys_connection rkc ON rkc.runs_id = r.id
    LEFT JOIN agent_runs_junction arj ON arj.run_id = r.id
    LEFT JOIN profile_runs_junction prj_rm ON prj_rm.run_id = r.id
),
-- Get department IDs FROM view_runs_entry (via agent or profile)
runs_departments AS (
    SELECT DISTINCT
        d.id as department_id
    FROM runs_metadata rm
    LEFT JOIN agent_artifact a ON a.id = rm.agent_id
    LEFT JOIN agent_departments_junction ad ON ad.agent_id = a.id AND ad.active = true
    LEFT JOIN departments_resource d ON d.id = ad.department_id AND EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
    WHERE d.id IS NOT NULL
),
-- Check department access
group_access_check AS (
    SELECT 
        CASE 
            WHEN up.role = 'superadmin'::profile_type THEN true
            WHEN EXISTS (
                SELECT 1 FROM runs_departments rd
                JOIN profile_departments_junction pd ON pd.department_id = rd.department_id
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
            (rpu.count::numeric / u.value::numeric) * pr.price
        ), 0) as run_cost
    FROM view_run_pricing_entry rpu
    JOIN view_runs_entry r ON r.id = rpu.run_id
    LEFT JOIN agent_runs_junction arj ON arj.run_id = r.id
    JOIN agent_models_junction am ON am.agent_id = arj.agent_id AND am.active = true
    JOIN model_pricing_junction mp ON mp.model_id = am.model_id AND mp.active = true
    JOIN pricing_resource pr ON pr.id = mp.pricing_id
        AND pr.pricing_type = rpu.pricing_type
        AND pr.unit_id = rpu.unit_id
        AND pr.active = true
    JOIN artifact_units_relation u ON u.id = rpu.unit_id
    JOIN group_runs_list grl ON grl.run_id = rpu.run_id
    GROUP BY rpu.run_id
),
-- Get all view_messages_entry for each run using view_message_tree_entry ordering (source of truth)
-- For each run, traverse view_message_tree_entry to get view_messages_entry in conversation flow order
run_groups_map AS (
    -- Map each run to its group
    SELECT DISTINCT
        rm.run_id,
        r.group_id
    FROM runs_metadata rm
    JOIN view_runs_entry r ON r.id = rm.run_id
),
run_idx_map AS (
    -- Compute idx for each run using ROW_NUMBER (replaces dropped group_runs.idx)
    SELECT
        id as run_id,
        group_id,
        ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY created_at) - 1 as idx
    FROM view_runs_entry
    WHERE group_id = (SELECT group_id FROM params)
),
run_chats_map AS (
    -- Map each run to all view_chats_entry in its group (via messages linking runs to chats)
    SELECT DISTINCT
        rg.run_id,
        m_chat.chat_id as chat_id
    FROM run_groups_map rg
    JOIN view_runs_entry r_chat ON r_chat.group_id = rg.group_id
    JOIN view_simulation_messages_entry m_chat ON m_chat.run_id = r_chat.id
),
-- Find first run (idx = 0) for each group
first_runs_map AS (
    SELECT DISTINCT
        rim.group_id,
        r.id as first_run_id
    FROM view_runs_entry r
    JOIN run_idx_map rim ON rim.run_id = r.id
    WHERE rim.idx = 0 AND r.group_id = (SELECT group_id FROM params)
),
-- Map each run to its previous run (idx - 1) in the same group
previous_runs_map AS (
    SELECT
        r_current.group_id,
        r_current.id as current_run_id,
        r_previous.id as previous_run_id
    FROM view_runs_entry r_current
    JOIN run_idx_map rim_current ON rim_current.run_id = r_current.id
    JOIN run_idx_map rim_previous ON rim_previous.group_id = r_current.group_id
        AND rim_previous.idx = rim_current.idx - 1
    JOIN view_runs_entry r_previous ON r_previous.id = rim_previous.run_id
    WHERE rim_current.idx > 0 AND r_current.group_id = (SELECT group_id FROM params)
),
-- Tree traversal for view_messages_entry: get all view_messages_entry following conversation flow per run
messages_with_tree AS (
    WITH RECURSIVE message_path AS (
        -- Base case: Include ALL view_messages_entry from current run
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
            rim.idx as run_idx
        FROM run_chats_map rcm
        JOIN run_groups_map rgm ON rgm.run_id = rcm.run_id
        JOIN view_groups_entry g ON g.id = rgm.group_id
        JOIN view_runs_entry r ON r.group_id = g.id AND r.id = rcm.run_id
        JOIN run_idx_map rim ON rim.run_id = r.id
        JOIN view_messages_entry m ON m.run_id = r.id
        JOIN (SELECT id, attempt_id, created_at, updated_at, title, completed, generated, mcp, active FROM view_simulation_chats_entry) c ON c.id = rcm.chat_id

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
        FROM view_messages_entry m
        JOIN view_message_tree_entry mt ON mt.parent_id = m.id AND mt.active = true
        JOIN message_path mp ON mp.id = mt.child_id
        WHERE mp.depth < 50
        AND EXISTS (
            SELECT 1
            FROM view_messages_entry m_parent
            JOIN view_runs_entry r_parent ON r_parent.id = m_parent.run_id
            JOIN run_idx_map rim_parent ON rim_parent.run_id = r_parent.id
            JOIN view_messages_entry m_child ON m_child.id = mt.child_id
            JOIN view_runs_entry r_child ON r_child.id = m_child.run_id
            WHERE m_parent.id = m.id
            AND r_parent.group_id = r_child.group_id
            AND r_child.id = mp.run_id
            AND (m.role IN ('user'::message_type, 'assistant'::message_type) OR rim_parent.idx = 0)
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
            rim.idx as run_idx
        FROM run_chats_map rcm
        JOIN run_groups_map rgm ON rgm.run_id = rcm.run_id
        JOIN view_groups_entry g ON g.id = rgm.group_id
        JOIN view_runs_entry r ON r.group_id = g.id AND r.id = rcm.run_id
        JOIN run_idx_map rim ON rim.run_id = r.id
        JOIN view_messages_entry m ON m.run_id = r.id
        JOIN (SELECT id, attempt_id, created_at, updated_at, title, completed, generated, mcp, active FROM view_simulation_chats_entry) c ON c.id = rcm.chat_id
        WHERE NOT EXISTS (
            SELECT 1 FROM view_message_tree_entry mt
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
        JOIN view_groups_entry g ON g.id = rgm.group_id
        JOIN view_runs_entry r ON r.group_id = g.id AND r.id = rcm.run_id
        JOIN first_runs_map frm ON frm.group_id = g.id AND frm.first_run_id != rcm.run_id
        JOIN view_messages_entry m ON m.run_id = frm.first_run_id AND m.role IN ('system'::message_type, 'developer'::message_type)
        JOIN (SELECT id, attempt_id, created_at, updated_at, title, completed, generated, mcp, active FROM view_simulation_chats_entry) c ON c.id = rcm.chat_id
        WHERE NOT EXISTS (
            SELECT 1 FROM message_path mp
            WHERE mp.id = m.id AND mp.run_id = rcm.run_id
        )
        AND NOT EXISTS (
            SELECT 1 FROM view_messages_entry m2
            WHERE m2.id = m.id AND m2.run_id = rcm.run_id
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
                (SELECT rim2.idx FROM view_messages_entry m2
                 JOIN run_idx_map rim2 ON rim2.run_id = m2.run_id
                 WHERE m2.id = am.id
                 ORDER BY rim2.idx LIMIT 1),
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
                (ce.idx, ce.content, ce.created_at, ce.updated_at)::types.q_get_pricing_group_detail_v4_content
                ORDER BY ce.idx
            ) FILTER (WHERE ce.idx IS NOT NULL),
            ARRAY[(0, '', mwt.created_at, mwt.updated_at)::types.q_get_pricing_group_detail_v4_content]
        ) as contents
    FROM messages_with_tree mwt
    LEFT JOIN view_contents_entry ce ON ce.message_id = mwt.id
    GROUP BY mwt.id, mwt.run_id, mwt.role, mwt.created_at, mwt.completed, mwt.updated_at, mwt.run_idx, mwt.depth
),
-- Get run idx for each run
runs_with_idx AS (
    SELECT
        rm.run_id,
        rim.idx as run_idx,
        r.group_id
    FROM runs_metadata rm
    JOIN view_runs_entry r ON r.id = rm.run_id
    JOIN run_idx_map rim ON rim.run_id = r.id
),
-- For each run, find the latest message and traverse up view_message_tree_entry to get all ancestors
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
        FROM view_messages_entry m
        WHERE m.run_id = current_run.run_id
        AND m.role IN ('user'::message_type, 'assistant'::message_type)
        ORDER BY
            CASE WHEN m.role = 'assistant'::message_type THEN 0 ELSE 1 END,
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
            FROM view_messages_entry m
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
                    (SELECT rim2.idx FROM view_messages_entry m2
                     JOIN view_runs_entry r ON r.id = m2.run_id
                     JOIN run_idx_map rim2 ON rim2.run_id = r.id
                     WHERE m2.id = m.id
                     AND r.group_id = current_run.group_id
                     ORDER BY rim2.idx LIMIT 1),
                    ap.run_idx
                ) as run_idx,
                ap.depth_from_latest + 1 as depth_from_latest
            FROM view_messages_entry m
            JOIN view_message_tree_entry mt ON mt.parent_id = m.id AND mt.active = true
            JOIN ancestor_path ap ON ap.id = mt.child_id
            LEFT JOIN messages_with_content mwc ON mwc.id = m.id AND mwc.run_id = current_run.run_id
            WHERE ap.depth_from_latest < 50
            AND EXISTS (
                SELECT 1
                FROM view_messages_entry m_parent
                JOIN view_runs_entry r_parent ON r_parent.id = m_parent.run_id
                WHERE m_parent.id = m.id
                AND r_parent.group_id = current_run.group_id
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
                                WHEN m.role::message_type = 'system'::message_type THEN 1
                                WHEN m.role::message_type = 'developer'::message_type THEN 2
                                WHEN m.role::message_type = 'user'::message_type THEN 3
                                WHEN m.role::message_type = 'assistant'::message_type THEN 4
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
-- Build run details with view_messages_entry
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
            DISTINCT (m.id, (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1), COALESCE((SELECT d.description FROM model_descriptions_junction md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1), ''))::types.q_get_pricing_group_detail_v4_model
        ) FILTER (WHERE m.id IS NOT NULL),
        '{}'::types.q_get_pricing_group_detail_v4_model[]
    ) as models,
    COALESCE(
        ARRAY_AGG(
            DISTINCT (a.id, (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1))::types.q_get_pricing_group_detail_v4_agent
        ) FILTER (WHERE a.id IS NOT NULL),
        '{}'::types.q_get_pricing_group_detail_v4_agent[]
    ) as agents,
    COALESCE(
        ARRAY_AGG(
            DISTINCT (p.id, COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''))::types.q_get_pricing_group_detail_v4_profile
        ) FILTER (WHERE p.id IS NOT NULL),
        '{}'::types.q_get_pricing_group_detail_v4_profile[]
    ) as profiles
FROM runs_detail rd
LEFT JOIN model_artifact m ON m.id = rd.model_id
LEFT JOIN agent_artifact a ON a.id = rd.agent_id
LEFT JOIN profile_artifact p ON p.id = rd.profile_id
CROSS JOIN group_exists_check gec
CROSS JOIN group_access_check gac
WHERE (SELECT group_exists FROM group_exists_check) = true
GROUP BY (SELECT group_exists FROM group_exists_check), (SELECT group_id FROM params), (SELECT actor_name FROM user_profile LIMIT 1), (SELECT has_access FROM group_access_check)
$$;
