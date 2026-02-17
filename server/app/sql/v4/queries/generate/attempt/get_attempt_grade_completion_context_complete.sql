-- Resolve attempt grading context by run_id

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_attempt_grade_completion_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_attempt_grade_completion_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_get_attempt_grade_completion_context_v4(
    p_run_id uuid
)
RETURNS TABLE (
    grade_id uuid,
    chat_id uuid,
    attempt_id uuid,
    simulation_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT
    g.id AS grade_id,
    g.chat_id,
    c.attempt_id,
    sas.simulations_id AS simulation_id
FROM attempt_grade_entry g
JOIN attempt_chat_entry c ON c.id = g.chat_id
LEFT JOIN attempt_simulations_connection sas
    ON sas.attempt_id = c.attempt_id
   AND sas.active = true
WHERE g.run_id = p_run_id
ORDER BY g.created_at DESC
LIMIT 1
$$;
