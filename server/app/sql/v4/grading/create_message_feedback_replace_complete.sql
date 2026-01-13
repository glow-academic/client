-- Insert message feedback replace items
-- Converted to PostgreSQL function pattern with composite types (no JSONB)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- Note: message_feedback_id now REFERENCES improvements_resource(id)
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_create_message_feedback_replace_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_message_feedback_replace_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_create_message_feedback_replace_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types for replace items
CREATE TYPE types.i_create_message_feedback_replace_v4_replace AS (
    section text,
    replace text
);

-- 4) Recreate function
-- Parameters: message_feedback_id (uuid) - references message_feedback_improvements(id)
--             replaces (array) - array of replace items (section, replace pairs)
CREATE OR REPLACE FUNCTION socket_create_message_feedback_replace_v4(
    message_feedback_id uuid,
    replaces types.i_create_message_feedback_replace_v4_replace[]
)
RETURNS TABLE (
    success boolean
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO message_feedback_replace 
    (message_feedback_id, idx, section, replace, created_at)
    SELECT 
        message_feedback_id,
        (row_number() OVER ()) - 1 as idx,
        r.section,
        r.replace,
        NOW()
    FROM unnest(replaces) as r
    RETURNING true as success
$$;