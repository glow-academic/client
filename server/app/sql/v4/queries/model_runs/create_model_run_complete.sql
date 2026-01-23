-- Create run with all junction records in a single transaction
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_create_model_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_model_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_create_model_run_v4(
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
    -- 1. Create run record with key_id, agent_id, and profile_id directly
    INSERT INTO runs_entry (input_tokens, output_tokens, key_id, agent_id, profile_id)
    SELECT 0, 0, p.key_id, p.agent_id, p.profile_id
    FROM params p
    RETURNING id
),
-- Persona linking removed (run_personas table dropped)
dummy_for_persona AS (
    SELECT 1 WHERE false
)
SELECT id::text as run_id
FROM create_run
$$;