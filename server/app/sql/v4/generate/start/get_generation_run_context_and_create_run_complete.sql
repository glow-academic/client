-- Create group, run, and user message (if needed) - minimal function for generate/start.py
-- Only handles rate limit check, group creation, run creation, and user message creation
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_generation_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_generation_run_context_and_create_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create composite type if it doesn't exist (shared with text functions)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'i_persona_resource_v4' 
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    ) THEN
        CREATE TYPE types.i_persona_resource_v4 AS (
            resource_type text,
            resource_ids uuid[]
        );
    END IF;
END $$;

-- 3) Recreate function
-- Minimal function: only rate limit, group creation, run creation, user message creation
CREATE OR REPLACE FUNCTION socket_get_generation_run_context_and_create_run_v4(
    agent_id uuid,
    profile_id uuid,
    message_ids uuid[] DEFAULT NULL,  -- Context message IDs (e.g., hint agent needs message_id)
    department_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,  -- Optional: for regeneration (uses existing group)
    developer_instructions text[] DEFAULT NULL,  -- Optional: array of developer instruction messages
    user_instructions text[] DEFAULT NULL,  -- Optional: array of user instructions for regeneration
    resources types.i_persona_resource_v4[] DEFAULT NULL  -- Optional: array of (resource_type, resource_ids) for fetching whitelisted resources
)
RETURNS TABLE (
    run_id text,
    group_id uuid,
    trace_id text,
    message_ids uuid[],  -- Includes new user message ID (if created) + context message IDs
    output_modalities text[]  -- NEW: from model_modalities
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        agent_id AS agent_id,
        message_ids AS message_ids,
        profile_id AS profile_id,
        department_id AS department_id,
        group_id AS group_id,
        developer_instructions AS developer_instructions,
        user_instructions AS user_instructions,
        resources AS resources
    ),
-- Validate agent exists
selected_agent AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    CROSS JOIN params p
    WHERE a.id = p.agent_id
      AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
    LIMIT 1
),
-- Get agent model output modalities
agent_model_modalities AS (
    SELECT 
        array_agg(mr.modality::text ORDER BY mr.modality) as output_modalities
    FROM agent_artifact a
    JOIN agent_models am ON am.agent_id = a.id
    JOIN model_modalities mm ON mm.model_id = am.model_id
    JOIN modalities_resource mr ON mr.id = mm.modality_id
    CROSS JOIN params p
    WHERE a.id = p.agent_id
      AND mm.type = 'output'::type_model_modalities
      AND mm.active = true
      AND mr.active = true
),
-- Get rate limit for profile
profile_rate_limit AS (
    SELECT 
        rl.requests_per_day as req_per_day
    FROM profile_artifact prof
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    WHERE prof.id = (SELECT profile_id FROM params)
),
-- Count runs today for rate limiting
runs_today AS (
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = (SELECT profile_id FROM params)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get or create group (for trace_id and group_id)
existing_group_from_param AS (
    SELECT g.id as group_id, g.trace_id
    FROM params p
    JOIN groups g ON g.id = p.group_id
    WHERE p.group_id IS NOT NULL
    LIMIT 1
),
create_group_if_needed AS (
    -- Create new group if needed (only if group_id not provided)
    INSERT INTO groups (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM params p
    WHERE p.group_id IS NULL
    RETURNING id as group_id, trace_id
),
group_data AS (
    -- Use existing group from param, newly created group, or fallback
    SELECT 
        COALESCE(
            (SELECT group_id FROM existing_group_from_param LIMIT 1),
            (SELECT group_id FROM create_group_if_needed LIMIT 1),
            gen_random_uuid()::uuid  -- Fallback if no group created
        ) as group_id,
        COALESCE(
            (SELECT trace_id FROM existing_group_from_param LIMIT 1),
            (SELECT trace_id FROM create_group_if_needed LIMIT 1),
            gen_random_uuid()::text  -- Fallback trace_id
        ) as trace_id
),
-- Validate rate limit (raises exception if exceeded)
rate_limit_check AS (
    SELECT 
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count
    FROM profile_rate_limit prl
    CROSS JOIN runs_today rt
    CROSS JOIN params p
    WHERE validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
),
-- Create run
create_run AS (
    INSERT INTO runs (input_tokens, output_tokens, agent_id)
    SELECT 0, 0, sa.agent_id
    FROM selected_agent sa
    CROSS JOIN rate_limit_check rlc
    RETURNING id as run_id
),
-- Link agent to run (via agent_id in runs table - already done)
-- Link profile to run
link_profile AS (
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT cr.run_id, p.profile_id, true
    FROM create_run cr
    CROSS JOIN params p
    RETURNING run_id
),
-- Link group to run
link_group AS (
    INSERT INTO group_runs (group_id, run_id, idx, created_at, updated_at)
    SELECT 
        gd.group_id,
        lp.run_id,
        COALESCE(
            (SELECT MAX(idx) FROM group_runs WHERE group_id = gd.group_id),
            -1
        ) + 1 as idx,
        NOW(),
        NOW()
    FROM link_profile lp
    CROSS JOIN group_data gd
    RETURNING run_id
),
-- Create developer messages from developer_instructions array
developer_message_content_array AS (
    SELECT 
        t.content,
        lg.run_id,
        t.idx
    FROM params p
    CROSS JOIN link_group lg
    CROSS JOIN LATERAL unnest(p.developer_instructions) WITH ORDINALITY AS t(content, idx)
    WHERE p.developer_instructions IS NOT NULL
      AND array_length(p.developer_instructions, 1) > 0
),
developer_message_hash_array AS (
    SELECT 
        dmc.content,
        dmc.run_id,
        dmc.idx,
        message_content_hash(dmc.content, 'developer') as hash
    FROM developer_message_content_array dmc
),
existing_developer_messages AS (
    SELECT DISTINCT ON (dmh.hash)
        m.id as message_id,
        dmh.run_id,
        dmh.hash
    FROM messages m
    JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN contents cnt ON cnt.id = mc.content_id
    JOIN developer_message_hash_array dmh ON message_content_hash(cnt.content, 'developer') = dmh.hash
    WHERE m.role = 'developer'
    ORDER BY dmh.hash, m.created_at DESC
),
new_developer_messages_data AS (
    SELECT 
        dmh.content,
        dmh.run_id,
        dmh.idx,
        dmh.hash
    FROM developer_message_hash_array dmh
    WHERE NOT EXISTS (SELECT 1 FROM existing_developer_messages e WHERE e.hash = dmh.hash)
),
new_developer_messages AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'developer'::message_role, false, false, NOW(), NOW()
    FROM new_developer_messages_data
    RETURNING id, created_at, updated_at
),
new_developer_messages_numbered AS (
    SELECT 
        id as message_id,
        created_at,
        updated_at,
        ROW_NUMBER() OVER (ORDER BY created_at) as rn
    FROM new_developer_messages
),
new_developer_messages_data_numbered AS (
    SELECT 
        content,
        run_id,
        hash,
        idx,
        ROW_NUMBER() OVER (ORDER BY idx) as rn
    FROM new_developer_messages_data
),
new_developer_messages_matched AS (
    SELECT 
        n.message_id,
        nd.content,
        nd.run_id,
        nd.hash,
        n.created_at,
        n.updated_at
    FROM new_developer_messages_numbered n
    JOIN new_developer_messages_data_numbered nd ON n.rn = nd.rn
),
insert_developer_contents AS (
    INSERT INTO contents (content, created_at, updated_at)
    SELECT 
        nd.content,
        nd.created_at,
        nd.updated_at
    FROM new_developer_messages_matched nd
    RETURNING id as content_id, content, created_at, updated_at
),
insert_developer_message_contents AS (
    INSERT INTO message_contents (message_id, content_id, idx, created_at, updated_at)
    SELECT 
        nd.message_id,
        ic.content_id,
        0,
        ic.created_at,
        ic.updated_at
    FROM new_developer_messages_matched nd
    JOIN insert_developer_contents ic ON ic.content = nd.content
),
developer_message_final AS (
    SELECT message_id, run_id FROM existing_developer_messages
    UNION ALL
    SELECT message_id, run_id FROM new_developer_messages_matched
),
link_developer_messages_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT dmf.message_id, dmf.run_id, NOW(), NOW()
    FROM developer_message_final dmf
    ON CONFLICT (message_id, run_id) 
    DO UPDATE SET updated_at = NOW()
    RETURNING message_id, run_id
),
-- Create user messages from user_instructions array
user_message_content_array AS (
    SELECT 
        t.content,
        lg.run_id,
        t.idx
    FROM params p
    CROSS JOIN link_group lg
    CROSS JOIN LATERAL unnest(p.user_instructions) WITH ORDINALITY AS t(content, idx)
    WHERE p.user_instructions IS NOT NULL
      AND array_length(p.user_instructions, 1) > 0
),
user_message_hash_array AS (
    SELECT 
        umc.content,
        umc.run_id,
        umc.idx,
        message_content_hash(umc.content, 'user') as hash
    FROM user_message_content_array umc
),
existing_user_messages AS (
    SELECT DISTINCT ON (umh.hash)
        m.id as message_id,
        umh.run_id,
        umh.hash
    FROM messages m
    JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN contents cnt ON cnt.id = mc.content_id
    JOIN user_message_hash_array umh ON message_content_hash(cnt.content, 'user') = umh.hash
    WHERE m.role = 'user'
    ORDER BY umh.hash, m.created_at DESC
),
new_user_messages_data AS (
    SELECT 
        umh.content,
        umh.run_id,
        umh.idx,
        umh.hash
    FROM user_message_hash_array umh
    WHERE NOT EXISTS (SELECT 1 FROM existing_user_messages e WHERE e.hash = umh.hash)
),
new_user_messages AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'user'::message_role, false, false, NOW(), NOW()
    FROM new_user_messages_data
    RETURNING id, created_at, updated_at
),
new_user_messages_numbered AS (
    SELECT 
        id as message_id,
        created_at,
        updated_at,
        ROW_NUMBER() OVER (ORDER BY created_at) as rn
    FROM new_user_messages
),
new_user_messages_data_numbered AS (
    SELECT 
        content,
        run_id,
        hash,
        idx,
        ROW_NUMBER() OVER (ORDER BY idx) as rn
    FROM new_user_messages_data
),
new_user_messages_matched AS (
    SELECT 
        n.message_id,
        nd.content,
        nd.run_id,
        nd.hash,
        n.created_at,
        n.updated_at
    FROM new_user_messages_numbered n
    JOIN new_user_messages_data_numbered nd ON n.rn = nd.rn
),
insert_user_contents AS (
    INSERT INTO contents (content, created_at, updated_at)
    SELECT 
        nd.content,
        nd.created_at,
        nd.updated_at
    FROM new_user_messages_matched nd
    RETURNING id as content_id, content, created_at, updated_at
),
insert_user_message_contents AS (
    INSERT INTO message_contents (message_id, content_id, idx, created_at, updated_at)
    SELECT 
        nd.message_id,
        ic.content_id,
        0,
        ic.created_at,
        ic.updated_at
    FROM new_user_messages_matched nd
    JOIN insert_user_contents ic ON ic.content = nd.content
),
user_message_final AS (
    SELECT message_id, run_id FROM existing_user_messages
    UNION ALL
    SELECT message_id, run_id FROM new_user_messages_matched
),
link_user_messages_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT umf.message_id, umf.run_id, NOW(), NOW()
    FROM user_message_final umf
    ON CONFLICT (message_id, run_id) 
    DO UPDATE SET updated_at = NOW()
    RETURNING message_id, run_id
),
-- Link existing system/developer messages from previous runs (if group_id provided for regeneration)
previous_runs_in_group AS (
    SELECT DISTINCT gr.run_id
    FROM group_runs gr
    CROSS JOIN params p
    WHERE gr.group_id = p.group_id
      AND p.group_id IS NOT NULL
),
link_existing_messages AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT DISTINCT mr.message_id, cr.run_id, NOW(), NOW()
    FROM previous_runs_in_group prig
    CROSS JOIN create_run cr
    JOIN message_runs mr ON mr.run_id = prig.run_id
    JOIN messages m ON m.id = mr.message_id
    WHERE m.role IN ('system'::message_role, 'developer'::message_role)
    ON CONFLICT (message_id, run_id)
    DO UPDATE SET updated_at = NOW()
),
-- Build message_ids array: includes all developer messages + all user messages + context message_ids
final_message_ids AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(DISTINCT msg_id) FILTER (WHERE msg_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) as message_ids
    FROM (
        -- Developer messages (if created)
        SELECT ldmm.message_id as msg_id
        FROM link_developer_messages_to_run ldmm
        WHERE ldmm.message_id IS NOT NULL
        UNION ALL
        -- User messages (if created)
        SELECT lumm.message_id as msg_id
        FROM link_user_messages_to_run lumm
        WHERE lumm.message_id IS NOT NULL
        UNION ALL
        -- Context message IDs from params
        SELECT unnest(p.message_ids) as msg_id
        FROM params p
        WHERE p.message_ids IS NOT NULL
    ) combined
)
SELECT 
    cr.run_id::text as run_id,
    gd.group_id,
    gd.trace_id::text as trace_id,
    COALESCE(fmi.message_ids, ARRAY[]::uuid[]) as message_ids,
    COALESCE(
        (SELECT output_modalities FROM agent_model_modalities),
        ARRAY[]::text[]
    ) as output_modalities
FROM create_run cr
CROSS JOIN group_data gd
CROSS JOIN link_group lg
LEFT JOIN final_message_ids fmi ON true
$$;

