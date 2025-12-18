-- Get or create a run for a chat (now uses groups)
-- Parameters: $1=chat_id (uuid), $2=department_id (uuid), $3=model_id (uuid), $4=entity_id (uuid), $5=entity_type ('agent'|'persona'), $6=profile_id (uuid, nullable), $7=key_id (uuid, nullable), $8=agent_id (uuid, nullable)
-- Returns: run_id (uuid as text)
-- This will get the latest run for the chat's group, or create a new one if none exists

WITH params AS (
    -- Explicitly cast parameters for asyncpg type inference
    SELECT $1::uuid as chat_id, $2::uuid as department_id, $3::uuid as model_id, $4::uuid as entity_id, $5::text as entity_type, $6::uuid as profile_id, $7::uuid as key_id, $8::uuid as agent_id
),
-- Get or create group for this chat
chat_group AS (
    -- Try to find existing group via chat_messages → any run → group_runs
    SELECT DISTINCT gr.group_id
    FROM chat_messages cm
    JOIN message_runs mr ON mr.message_id = cm.message_id
    JOIN group_runs gr ON gr.run_id = mr.run_id
    CROSS JOIN params p
    WHERE cm.chat_id = p.chat_id
    LIMIT 1
),
create_group_if_needed AS (
    -- Create a new group if none exists for this chat
    INSERT INTO groups (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM params p
    WHERE NOT EXISTS (SELECT 1 FROM chat_group)
    RETURNING id as group_id
),
selected_group AS (
    SELECT group_id FROM chat_group
    UNION ALL
    SELECT group_id FROM create_group_if_needed
),
latest_run AS (
    -- Get the latest run for this chat's group
    SELECT r.id
    FROM selected_group sg
    JOIN group_runs gr ON gr.group_id = sg.group_id
    JOIN runs r ON r.id = gr.run_id
    ORDER BY r.created_at DESC
    LIMIT 1
),
create_run_if_needed AS (
    -- Create a new run if none exists
    INSERT INTO runs (input_tokens, output_tokens, key_id, agent_id)
    SELECT 0, 0, p.key_id, p.agent_id
    FROM params p
    WHERE NOT EXISTS (SELECT 1 FROM latest_run)
    RETURNING id
),
selected_run AS (
    SELECT id FROM latest_run
    UNION ALL
    SELECT id FROM create_run_if_needed
),
link_model AS (
    -- Link model to run if it's a new run
    INSERT INTO run_models (run_id, model_id, active)
    SELECT sr.id, p.model_id, true
    FROM selected_run sr
    CROSS JOIN params p
    WHERE NOT EXISTS (SELECT 1 FROM latest_run)
    AND NOT EXISTS (SELECT 1 FROM run_models rm WHERE rm.run_id = sr.id AND rm.active = true)
    RETURNING run_id
),
link_persona AS (
    INSERT INTO run_personas (run_id, persona_id, active)
    SELECT COALESCE(lm.run_id, sr.id), p.entity_id, true
    FROM selected_run sr
    LEFT JOIN link_model lm ON true
    CROSS JOIN params p
    WHERE NOT EXISTS (SELECT 1 FROM latest_run)
    AND p.entity_type = 'persona'
    AND NOT EXISTS (SELECT 1 FROM run_personas rp WHERE rp.run_id = sr.id AND rp.active = true)
    RETURNING run_id
),
link_profile AS (
    -- Link profile to run if it's a new run and profile_id is provided
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT COALESCE(lm.run_id, sr.id), p.profile_id, true
    FROM selected_run sr
    LEFT JOIN link_model lm ON true
    CROSS JOIN params p
    WHERE NOT EXISTS (SELECT 1 FROM latest_run)
    AND p.profile_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM run_profiles rp WHERE rp.run_id = sr.id AND rp.active = true)
    RETURNING run_id
),
link_group AS (
    -- Link run to group if it's a new run
    INSERT INTO group_runs (group_id, run_id, created_at, updated_at)
    SELECT sg.group_id, sr.id, NOW(), NOW()
    FROM selected_run sr
    CROSS JOIN selected_group sg
    WHERE NOT EXISTS (SELECT 1 FROM latest_run)
    AND NOT EXISTS (SELECT 1 FROM group_runs gr WHERE gr.run_id = sr.id AND gr.group_id = sg.group_id)
    RETURNING run_id
)
SELECT sr.id::text as run_id
FROM selected_run sr
LIMIT 1
