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
    developer_instructions text[] DEFAULT NULL,  -- Optional: array of developer instruction messages_entry
    user_instructions text[] DEFAULT NULL,  -- Optional: array of user instructions for regeneration
    resources types.i_persona_resource_v4[] DEFAULT NULL  -- Optional: array of (resource_type, resource_ids) for fetching whitelisted resources
)
RETURNS TABLE (
    run_id text,
    group_id uuid,
    trace_id text,
    message_ids uuid[],  -- Includes new user message ID (if created) + context message IDs
    output_modalities text[]  -- NEW: from model_modalities_junction
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
      AND EXISTS (
          SELECT 1
          FROM agent_flags_junction af
          JOIN flags_resource f ON af.flag_id = f.id
          WHERE af.agent_id = a.id
            AND f.name = 'agent_active'
            AND af.value = true
      )
    LIMIT 1
),
-- Get agent model output modalities (via agents_resource)
agent_model_modalities AS (
    SELECT
        array_agg(mr.modality::text ORDER BY mr.modality) as output_modalities
    FROM agent_artifact a
    JOIN agent_agents_junction aaj ON aaj.agent_id = a.id AND aaj.active = true
    JOIN agents_resource ar ON ar.id = aaj.agents_id AND ar.active = true
    JOIN model_modalities_junction mm ON mm.model_id = ar.model_id
    JOIN modalities_resource mr ON mr.id = mm.modality_id
    CROSS JOIN params p
    WHERE a.id = p.agent_id
      AND mr.is_input = false
      AND mm.active = true
      AND mr.active = true
),
-- Get or create group (for trace_id and group_id)
existing_group_from_param AS (
    SELECT g.id as group_id, g.trace_id
    FROM params p
    JOIN groups_entry g ON g.id = p.group_id
    WHERE p.group_id IS NOT NULL
    LIMIT 1
),
create_group_if_needed AS (
    -- Create new group if needed (only if group_id not provided)
    INSERT INTO groups_entry (created_at, updated_at, session_id)
    SELECT NOW(), NOW(), (SELECT s.id FROM sessions_entry s JOIN profiles_sessions_connection psc ON psc.session_id = s.id WHERE psc.profiles_id = socket_get_generation_run_context_and_create_run_v4.profile_id AND s.active = true ORDER BY s.created_at DESC LIMIT 1)
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
-- Create run with group_id directly
create_run AS (
    INSERT INTO runs_entry (group_id)
    SELECT gd.group_id
    FROM selected_agent sa
    CROSS JOIN params p
    CROSS JOIN group_data gd
    RETURNING id as run_id
),
link_run_to_profile AS (
    -- Link run to profile via junction table
    INSERT INTO profiles_runs_connection (profiles_id, run_id)
    SELECT ppj.profiles_id, cr.run_id
    FROM params p
    JOIN profile_profiles_junction ppj ON ppj.profile_id = p.profile_id
    CROSS JOIN create_run cr
    WHERE p.profile_id IS NOT NULL
),
link_run_to_agent AS (
    INSERT INTO runs_agents_connection (run_id, agents_id, created_at, active, generated, mcp)
    SELECT DISTINCT
        cr.run_id,
        aaj.agents_id,
        NOW(),
        true,
        false,
        false
    FROM create_run cr
    CROSS JOIN selected_agent sa
    JOIN agent_agents_junction aaj ON aaj.agent_id = sa.agent_id AND aaj.active = true
    ON CONFLICT (run_id, agents_id) DO NOTHING
),
-- Dummy CTE to maintain compatibility (runs_entry now have group_id directly)
link_group AS (
    SELECT cr.run_id
    FROM create_run cr
),
-- Create developer messages_entry from developer_instructions array
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
    FROM messages_entry m
    JOIN LATERAL (
        SELECT content
        FROM attempt_content_entry ce
        WHERE ce.message_id = m.id
          AND ce.active = true
        ORDER BY ce.created_at
        LIMIT 1
    ) ce ON TRUE
    JOIN developer_message_hash_array dmh ON message_content_hash(ce.content, 'developer') = dmh.hash
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
    INSERT INTO messages_entry (role, run_id, created_at, updated_at)
    SELECT 'developer'::message_type, nd.run_id, NOW(), NOW()
    FROM new_developer_messages_data nd
    RETURNING id, run_id, created_at, updated_at
),
new_developer_messages_numbered AS (
    SELECT
        id as message_id,
        run_id,
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
        n.run_id,
        nd.hash,
        n.created_at,
        n.updated_at
    FROM new_developer_messages_numbered n
    JOIN new_developer_messages_data_numbered nd ON n.rn = nd.rn
),
insert_developer_contents AS (
    INSERT INTO attempt_content_entry (message_id, content, created_at, updated_at)
    SELECT
        nd.message_id,
        nd.content,
        nd.created_at,
        nd.updated_at
    FROM new_developer_messages_matched nd
),
update_existing_developer_messages_run AS (
    UPDATE messages_entry m
    SET run_id = edm.run_id, updated_at = NOW()
    FROM existing_developer_messages edm
    WHERE m.id = edm.message_id AND edm.run_id IS NOT NULL
    RETURNING m.id as message_id, m.run_id
),
link_developer_messages_to_run AS (
    -- Combine existing (updated) and new developer messages_entry
    SELECT message_id, run_id FROM update_existing_developer_messages_run
    UNION ALL
    SELECT message_id, run_id FROM new_developer_messages_matched
),
-- Create user messages_entry from user_instructions array
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
    FROM messages_entry m
    JOIN LATERAL (
        SELECT content
        FROM attempt_content_entry ce
        WHERE ce.message_id = m.id
          AND ce.active = true
        ORDER BY ce.created_at
        LIMIT 1
    ) ce ON TRUE
    JOIN user_message_hash_array umh ON message_content_hash(ce.content, 'user') = umh.hash
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
    INSERT INTO messages_entry (role, run_id, created_at, updated_at)
    SELECT 'user'::message_type, nd.run_id, NOW(), NOW()
    FROM new_user_messages_data nd
    RETURNING id, run_id, created_at, updated_at
),
new_user_messages_numbered AS (
    SELECT
        id as message_id,
        run_id,
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
        n.run_id,
        nd.hash,
        n.created_at,
        n.updated_at
    FROM new_user_messages_numbered n
    JOIN new_user_messages_data_numbered nd ON n.rn = nd.rn
),
insert_user_contents AS (
    INSERT INTO attempt_content_entry (message_id, content, created_at, updated_at)
    SELECT
        nd.message_id,
        nd.content,
        nd.created_at,
        nd.updated_at
    FROM new_user_messages_matched nd
),
update_existing_user_messages_run AS (
    UPDATE messages_entry m
    SET run_id = eum.run_id, updated_at = NOW()
    FROM existing_user_messages eum
    WHERE m.id = eum.message_id AND eum.run_id IS NOT NULL
    RETURNING m.id as message_id, m.run_id
),
link_user_messages_to_run AS (
    -- Combine existing (updated) and new user messages_entry
    SELECT message_id, run_id FROM update_existing_user_messages_run
    UNION ALL
    SELECT message_id, run_id FROM new_user_messages_matched
),
-- Link existing system/developer messages_entry from previous runs_entry (if group_id provided for regeneration)
-- Note: Messages now have direct run_id. For regeneration we copy messages_entry from previous runs_entry in group
previous_runs_in_group AS (
    SELECT DISTINCT r.id as run_id
    FROM runs_entry r
    CROSS JOIN params p
    WHERE r.group_id = p.group_id
      AND p.group_id IS NOT NULL
),
-- Messages are linked via run_id; we don't need to copy them for regeneration
-- The messages_entry from previous runs_entry remain linked to their original runs_entry
link_existing_messages AS (
    SELECT NULL::uuid as message_id WHERE false -- no-op placeholder to maintain CTE chain
),
-- Build message_ids array: includes all developer messages_entry + all user messages_entry + context message_ids
final_message_ids AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(DISTINCT msg_id) FILTER (WHERE msg_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) as message_ids
    FROM (
        -- Developer messages_entry (if created)
        SELECT ldmm.message_id as msg_id
        FROM link_developer_messages_to_run ldmm
        WHERE ldmm.message_id IS NOT NULL
        UNION ALL
        -- User messages_entry (if created)
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
