-- Get or create a run for a chat
-- Parameters: $1=chat_id (uuid), $2=department_id (uuid), $3=model_id (uuid), $4=entity_id (uuid), $5=entity_type ('agent'|'persona'), $6=profile_id (uuid, nullable), $7=key_id (uuid, nullable), $8=agent_id (uuid, nullable)
-- Returns: run_id (uuid as text)
-- This will get the latest run for the chat, or create a new one if none exists

WITH latest_run AS (
    -- Get the latest run for this chat
    SELECT rc.run_id
    FROM chat_runs rc
    JOIN runs r ON r.id = rc.run_id
    WHERE rc.chat_id = $1::uuid
    ORDER BY r.created_at DESC
    LIMIT 1
),
create_run_if_needed AS (
    -- Create a new run if none exists
    INSERT INTO runs (input_tokens, output_tokens, key_id, agent_id)
    SELECT 0, 0, $7::uuid, $8::uuid
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
    SELECT sr.id, $3::uuid, true
    FROM selected_run sr
    WHERE NOT EXISTS (SELECT 1 FROM latest_run)
    AND NOT EXISTS (SELECT 1 FROM run_models rm WHERE rm.run_id = sr.id AND rm.active = true)
    RETURNING run_id
),
link_persona AS (
    -- Link persona to run if it's a new run and entity_type is 'persona'
    INSERT INTO run_personas (run_id, persona_id, active)
    SELECT COALESCE(lm.run_id, sr.id), $4::uuid, true
    FROM selected_run sr
    LEFT JOIN link_model lm ON true
    WHERE NOT EXISTS (SELECT 1 FROM latest_run)
    AND $5::text = 'persona'
    AND NOT EXISTS (SELECT 1 FROM run_personas rp WHERE rp.run_id = sr.id AND rp.active = true)
    RETURNING run_id
),
link_profile AS (
    -- Link profile to run if it's a new run and profile_id is provided
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT COALESCE(lm.run_id, sr.id), $6::uuid, true
    FROM selected_run sr
    LEFT JOIN link_model lm ON true
    WHERE NOT EXISTS (SELECT 1 FROM latest_run)
    AND $6::uuid IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM run_profiles rp WHERE rp.run_id = sr.id AND rp.active = true)
    RETURNING run_id
),
link_chat AS (
    -- Link run to chat if it's a new run
    INSERT INTO chat_runs (run_id, chat_id, created_at, updated_at)
    SELECT sr.id, $1::uuid, NOW(), NOW()
    FROM selected_run sr
    WHERE NOT EXISTS (SELECT 1 FROM latest_run)
    AND NOT EXISTS (SELECT 1 FROM chat_runs rc WHERE rc.run_id = sr.id AND rc.chat_id = $1::uuid)
    RETURNING run_id
)
SELECT sr.id::text as run_id
FROM selected_run sr
LIMIT 1

