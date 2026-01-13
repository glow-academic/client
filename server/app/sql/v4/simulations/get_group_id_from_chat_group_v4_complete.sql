-- Get group_id from chat_id
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_group_id_from_chat_group_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_group_id_from_chat_group_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_group_id_from_chat_group_v4(
    chat_id uuid
)
RETURNS TABLE (
    group_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT g.id
    FROM groups g
    JOIN chat_groups cg ON cg.group_id = g.id
    WHERE cg.chat_id = $1
    LIMIT 1
$$;
