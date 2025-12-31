-- Finalize voice simulation messages and runs
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_voice_complete_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_voice_complete_v3(%s)', r.sig);
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
        WHERE typname LIKE 'i_voice_complete_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function (no types needed for this simple function)
CREATE OR REPLACE FUNCTION socket_voice_complete_v3(
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
    JOIN message_runs mr ON mr.message_id = messages.id
    WHERE mr.run_id = p.run_id
      AND messages.role = 'assistant'::message_role
      AND messages.completed = false
    RETURNING messages.id as message_id, messages.id
),
-- Mark run as complete
complete_run AS (
    UPDATE runs
    SET completed = true,
        updated_at = NOW()
    FROM params p
    WHERE runs.id = p.run_id
      AND runs.completed = false
    RETURNING id as run_id
)
SELECT 
    (SELECT EXISTS(SELECT 1 FROM complete_run)) as success,
    (SELECT COUNT(*)::text FROM finalize_messages) as messages_finalized
$$;

COMMIT;
