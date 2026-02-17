-- Complete assistant message and update run tokens (practice)
-- Append-only: inserts into messages_completions_entry and tokens_entry
DROP FUNCTION IF EXISTS socket_practice_complete_assistant_message_v4(uuid, text, integer, integer);

CREATE OR REPLACE FUNCTION socket_practice_complete_assistant_message_v4(
    message_id uuid,
    assistant_content text,
    input_tokens integer,
    output_tokens integer
)
RETURNS TABLE (
    success boolean
)
LANGUAGE sql
VOLATILE
AS $$
WITH message_run AS (
    SELECT id, run_id FROM messages_entry WHERE id = message_id
),
new_completion AS (
    INSERT INTO messages_completions_entry (message_id)
    SELECT message_id
    FROM message_run
    RETURNING id
),
new_content AS (
    INSERT INTO attempt_content_entry (message_id, content)
    SELECT message_id, assistant_content
    FROM message_run
    RETURNING id AS content_id
),
new_tokens AS (
    INSERT INTO tokens_entry (run_id, input_tokens, output_tokens)
    SELECT run_id, socket_practice_complete_assistant_message_v4.input_tokens, socket_practice_complete_assistant_message_v4.output_tokens
    FROM message_run
    RETURNING id
)
SELECT EXISTS(SELECT 1 FROM new_tokens) as success;
$$;
