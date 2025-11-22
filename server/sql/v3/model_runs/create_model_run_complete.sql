-- Create model run with all junction records in a single transaction
-- Parameters: $1=department_id (uuid, not stored but kept for compatibility), $2=model_id (uuid), $3=entity_id (uuid), $4=entity_type ('agent'|'persona'), $5=profile_id (uuid, nullable), $6=key_id (uuid, nullable)
-- Returns: model_run_id (uuid as text)
WITH params AS (
    -- Explicitly cast parameters for asyncpg type inference
    SELECT $1::uuid as department_id, $2::uuid as model_id, $3::uuid as entity_id, $4::text as entity_type, $5::uuid as profile_id, $6::uuid as key_id
),
create_model_run AS (
    -- 1. Create model_run record with key_id if provided
    INSERT INTO model_runs (input_tokens, output_tokens, key_id)
    SELECT 0, 0, p.key_id
    FROM params p
    RETURNING id
),
link_model AS (
    -- 2. Link model to run
    INSERT INTO model_run_models (model_run_id, model_id, active)
    SELECT cmr.id, p.model_id, true
    FROM create_model_run cmr
    CROSS JOIN params p
    RETURNING model_run_id
),
link_agent AS (
    -- 3a. Link agent to run (only if entity_type is 'agent')
    INSERT INTO model_run_agents (model_run_id, agent_id, active)
    SELECT lm.model_run_id, p.entity_id, true
    FROM link_model lm
    CROSS JOIN params p
    WHERE p.entity_type = 'agent'
    RETURNING model_run_id
),
link_persona AS (
    -- 3b. Link persona to run (only if entity_type is 'persona')
    INSERT INTO model_run_personas (model_run_id, persona_id, active)
    SELECT lm.model_run_id, p.entity_id, true
    FROM link_model lm
    CROSS JOIN params p
    WHERE p.entity_type = 'persona'
    RETURNING model_run_id
),
link_profile AS (
    -- 4. Link profile to run if provided (conditional)
    INSERT INTO model_run_profiles (model_run_id, profile_id, active)
    SELECT lm.model_run_id, p.profile_id, true
    FROM link_model lm
    CROSS JOIN params p
    WHERE p.profile_id IS NOT NULL
    RETURNING model_run_id
)
SELECT id::text as model_run_id
FROM create_model_run
