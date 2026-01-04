-- Finalize voice simulation messages and runs
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_voice_complete_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_voice_complete_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_voice_complete_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function (no types needed for this simple function)
CREATE OR REPLACE FUNCTION socket_voice_complete_v4(
    chat_id uuid,
    run_id uuid
)
RETURNS TABLE (
    success boolean,
    messages_finalized text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT chat_id AS chat_id, run_id AS run_id
),
-- Finalize all incomplete assistant messages for this run
finalize_messages AS (
    UPDATE messages
    SET completed = true,
        updated_at = NOW()
    FROM params p
    WHERE id IN (
        SELECT mr.message_id 
        FROM message_runs mr 
        WHERE mr.run_id = p.run_id
    )
      AND role = 'assistant'::message_role
      AND completed = false
    RETURNING id as message_id, id
),
-- Mark run as complete (runs table doesn't have completed column - this is a no-op for now)
complete_run AS (
    SELECT p.run_id
    FROM params p
    WHERE EXISTS (SELECT 1 FROM runs WHERE runs.id = p.run_id)
)
SELECT 
    (SELECT EXISTS(SELECT 1 FROM complete_run)) as success,
    (SELECT COUNT(*)::text FROM finalize_messages) as messages_finalized
$$;