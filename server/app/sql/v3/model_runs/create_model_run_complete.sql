-- Create run with all junction records in a single transaction
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_create_model_run_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_model_run_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_create_model_run_v3(
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
        department_id AS department_id,
        model_id AS model_id,
        entity_id AS entity_id,
        entity_type AS entity_type,
        profile_id AS profile_id,
        key_id AS key_id,
        agent_id AS agent_id
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
$$;

COMMIT;
