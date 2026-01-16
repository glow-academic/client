-- Get simulation metadata FROM chats (optimized single JOIN query)
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_simulation_metadata_for_chat_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_metadata_for_chat_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_simulation_metadata_for_chat_v4(
    chat_id uuid
)
RETURNS TABLE (
    simulation_id text,
    attempt_id text,
    practice_simulation boolean
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    sa.simulation_id::text,
    sa.id::text as attempt_id,
    EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'practice' AND sf.value = TRUE)
FROM chats sc
JOIN attempt_chats ac ON ac.chat_id = sc.id
INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
INNER JOIN simulation_artifact s ON s.id = sa.simulation_id
WHERE sc.id = chat_id
$$;