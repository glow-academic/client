-- Save attempt message content - updates assistant message with generated content
-- Append-only: inserts into messages_completions_entry and tokens_entry

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_save_attempt_message_content_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_save_attempt_message_content_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_save_attempt_message_content_v4(
    p_message_id uuid,
    p_content text,
    p_run_id uuid DEFAULT NULL,
    p_input_tokens integer DEFAULT NULL,
    p_output_tokens integer DEFAULT NULL
)
RETURNS TABLE (
    success boolean
)
LANGUAGE sql
VOLATILE
AS $$
WITH message_run AS (
    SELECT id, run_id FROM messages_entry WHERE id = p_message_id
),
new_completion AS (
    INSERT INTO messages_completions_entry (message_id)
    SELECT p_message_id
    FROM message_run
    RETURNING id
),
new_content AS (
    INSERT INTO simulation_contents_entry (message_id, content)
    SELECT p_message_id, p_content
    FROM message_run
    RETURNING id AS content_id
),
new_tokens AS (
    INSERT INTO tokens_entry (run_id, input_tokens, output_tokens)
    SELECT run_id, COALESCE(p_input_tokens, 0), COALESCE(p_output_tokens, 0)
    FROM message_run
    WHERE p_run_id IS NOT NULL
    RETURNING id
)
SELECT TRUE as success;
$$;
