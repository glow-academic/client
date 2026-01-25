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
    -- 1. Create run record with key_id
    INSERT INTO runs_entry (input_tokens, output_tokens)
    SELECT 0, 0
    FROM params p
    RETURNING id
),
link_run_agent AS (
    -- Link run to agent via junction table
    INSERT INTO agent_runs_junction (agent_id, run_id)
    SELECT p.agent_id, cr.id
    FROM params p
    CROSS JOIN create_run cr
    WHERE p.agent_id IS NOT NULL
),
link_run_profile AS (
    -- Link run to profile via junction table
    INSERT INTO profile_runs_junction (profile_id, run_id)
    SELECT p.profile_id, cr.id
    FROM params p
    CROSS JOIN create_run cr
    WHERE p.profile_id IS NOT NULL
)
SELECT id::text as run_id
FROM create_run
$$;