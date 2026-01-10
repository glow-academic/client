-- Get hint message_id from run_id and chat_id
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
        WHERE proname = 'socket_get_hint_message_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_hint_message_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_get_hint_message_id_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_get_hint_message_id_v4(
    run_id uuid,
    chat_id uuid
)
RETURNS TABLE (
    message_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT m.id as message_id
    FROM message_runs mr
    JOIN message m ON m.id = mr.message_id
    JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN chat_groups cg ON cg.group_id IN (
        SELECT gr.group_id 
        FROM group_runs gr 
        WHERE gr.run_id = $1
    )
    JOIN chat c ON c.id = cg.chat_id
    WHERE mr.run_id = $1
      AND c.id = $2
      AND m.role = 'user'::message_role
    ORDER BY m.created_at DESC
    LIMIT 1
$$;

