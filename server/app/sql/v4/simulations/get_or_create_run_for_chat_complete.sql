-- Get or create a run for a chat (now uses groups)
-- Converted to PostgreSQL function
-- This will get the latest run for the chat's group, or create a new one if none exists
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_or_create_run_for_chat_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_or_create_run_for_chat_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_or_create_run_for_chat_v4(
    chat_id uuid,
    department_id uuid,
    model_id uuid,
    entity_id uuid,
    entity_type text,
    profile_id uuid DEFAULT NULL,
    key_id uuid DEFAULT NULL,
    agent_id uuid DEFAULT NULL
)
RETURNS TABLE (
    run_id text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        chat_id as chat_id, 
        department_id as department_id, 
        model_id as model_id, 
        entity_id as entity_id, 
        entity_type as entity_type, 
        profile_id as profile_id, 
        key_id as key_id, 
        agent_id as agent_id
),
-- Get or create group for this chat
chat_group AS (
    -- Try to find existing group via chat_groups junction table
    SELECT cg.group_id
    FROM chat_groups cg
    CROSS JOIN params p
    WHERE cg.chat_id = p.chat_id
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
create_chat_group_if_needed AS (
    -- Insert into chat_groups if we created a new group
    INSERT INTO chat_groups (chat_id, group_id, created_at, updated_at)
    SELECT p.chat_id, cg.group_id, NOW(), NOW()
    FROM create_group_if_needed cg
    CROSS JOIN params p
    WHERE NOT EXISTS (SELECT 1 FROM chat_group)
    ON CONFLICT (chat_id, group_id) DO NOTHING
    RETURNING group_id
),
selected_group AS (
    SELECT group_id FROM chat_group
    UNION ALL
    SELECT group_id FROM create_group_if_needed
    UNION ALL
    SELECT group_id FROM create_chat_group_if_needed
),
latest_run AS (
    -- Get the latest run for this chat's group
    SELECT r.id
    FROM selected_group sg
    JOIN group_runs gr ON gr.group_id = sg.group_id
    JOIN run r ON r.id = gr.run_id
    ORDER BY r.created_at DESC
    LIMIT 1
),
create_run_if_needed AS (
    -- Create a new run if none exists
    INSERT INTO run (input_tokens, output_tokens, key_id, agent_id)
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
    INSERT INTO group_runs (group_id, run_id, idx, created_at, updated_at)
    SELECT 
        sg.group_id, 
        sr.id, 
        COALESCE((SELECT MAX(idx) FROM group_runs WHERE group_id = sg.group_id), -1) + 1,
        NOW(), 
        NOW()
    FROM selected_run sr
    CROSS JOIN selected_group sg
    WHERE NOT EXISTS (SELECT 1 FROM latest_run)
    AND NOT EXISTS (SELECT 1 FROM group_runs gr WHERE gr.run_id = sr.id AND gr.group_id = sg.group_id)
    RETURNING run_id
)
SELECT sr.id::text as run_id
FROM selected_run sr
LIMIT 1
$$;