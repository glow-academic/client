-- Save attempt message content - updates assistant message with generated content
-- After migration 381: completed lives on messages_entry, content goes to simulation_contents_entry

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
WITH updated_message AS (
    UPDATE messages_entry
    SET completed = true,
        updated_at = NOW()
    WHERE id = p_message_id
    RETURNING id, run_id
),
new_content AS (
    INSERT INTO simulation_contents_entry (message_id, content)
    SELECT p_message_id, p_content
    FROM updated_message
    RETURNING id AS content_id
),
updated_run AS (
    UPDATE runs_entry
    SET input_tokens = COALESCE(p_input_tokens, input_tokens),
        output_tokens = COALESCE(p_output_tokens, output_tokens),
        updated_at = NOW()
    WHERE id = (SELECT run_id FROM updated_message)
      AND p_run_id IS NOT NULL
    RETURNING id
)
SELECT TRUE as success;
$$;
