-- Get infinite_mode from eval_attempt
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_eval_attempt_infinite_mode_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_eval_attempt_infinite_mode_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_eval_attempt_infinite_mode_v4(
    attempt_id uuid
)
RETURNS TABLE (
    infinite_mode boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT infinite_mode FROM eval_attempts_entry WHERE eval_attempts_entry.id = $1
$$;
