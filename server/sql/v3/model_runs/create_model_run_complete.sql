-- Create run with all junction records in a single transaction
-- Parameters: $1=department_id (uuid, not stored but kept for compatibility), $2=model_id (uuid), $3=entity_id (uuid), $4=entity_type ('agent'|'persona'), $5=profile_id (uuid, nullable), $6=key_id (uuid, nullable), $7=agent_id (uuid, nullable - set directly on runs)
-- Returns: run_id (uuid as text)
WITH params AS (
    -- Explicitly cast parameters for asyncpg type inference
    SELECT $1::uuid as department_id, $2::uuid as model_id, $3::uuid as entity_id, $4::text as entity_type, $5::uuid as profile_id, $6::uuid as key_id, $7::uuid as agent_id
),
create_run AS (
    -- 1. Create run record with key_id and agent_id if provided
    INSERT INTO runs (input_tokens, output_tokens, key_id, agent_id)
    SELECT 0, 0, p.key_id, p.agent_id
    FROM params p
    RETURNING id
),
link_model AS (
    -- 2. Link model to run
    INSERT INTO run_models (run_id, model_id, active)
    SELECT cr.id, p.model_id, true
    FROM create_run cr
    CROSS JOIN params p
    RETURNING run_id
),
link_persona AS (
    -- 3. Link persona to run (only if entity_type is 'persona')
    INSERT INTO run_personas (run_id, persona_id, active)
    SELECT lm.run_id, p.entity_id, true
    FROM link_model lm
    CROSS JOIN params p
    WHERE p.entity_type = 'persona'
    RETURNING run_id
),
link_profile AS (
    -- 4. Link profile to run if provided (conditional)
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, p.profile_id, true
    FROM link_model lm
    CROSS JOIN params p
    WHERE p.profile_id IS NOT NULL
    RETURNING run_id
)
SELECT id::text as run_id
FROM create_run
