-- Insert message feedback highlight items
-- Converted to PostgreSQL function pattern with composite types (no JSONB)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_create_message_feedback_highlight_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_message_feedback_highlight_v3(%s)', r.sig);
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
        WHERE typname LIKE 'i_create_message_feedback_highlight_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types for highlight items
CREATE TYPE types.i_create_message_feedback_highlight_v3_highlight AS (
    section text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_create_message_feedback_highlight_v3(
    message_feedback_id uuid,
    highlights types.i_create_message_feedback_highlight_v3_highlight[]
)
RETURNS TABLE (
    success boolean
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO message_feedback_highlight 
    (message_feedback_id, idx, section, created_at)
    SELECT 
        message_feedback_id,
        (row_number() OVER ()) - 1 as idx,
        h.section,
        NOW()
    FROM unnest(highlights) as h
    RETURNING true as success
$$;

COMMIT;

