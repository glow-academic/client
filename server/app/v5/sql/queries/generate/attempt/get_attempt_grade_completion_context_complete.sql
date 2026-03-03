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
    ac.attempt_id,
    COALESCE(home_sim.simulations_id, prac_sim.simulations_id) AS simulation_id
FROM attempt_grade_entry g
JOIN attempt_chat_entry c ON c.id = g.chat_id
JOIN attempt_chat_bridge_entry ac ON ac.attempt_chat_id = c.id
JOIN attempt_entry a ON a.id = ac.attempt_id
LEFT JOIN attempt_home_entry ahe ON ahe.attempt_id = a.id AND ahe.active = true
LEFT JOIN attempt_practice_entry ape ON ape.attempt_id = a.id AND ape.active = true
LEFT JOIN home_simulations_connection home_sim ON home_sim.home_id = ahe.home_id AND home_sim.active = true
LEFT JOIN practice_simulations_connection prac_sim ON prac_sim.practice_id = ape.practice_id AND prac_sim.active = true
WHERE g.run_id = p_run_id
ORDER BY g.created_at DESC
LIMIT 1
$$;
