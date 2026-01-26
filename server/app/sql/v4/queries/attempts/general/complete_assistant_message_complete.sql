-- Complete assistant message and update run tokens (general)
DROP FUNCTION IF EXISTS socket_general_complete_assistant_message_v4(uuid, text, integer, integer);

CREATE OR REPLACE FUNCTION socket_general_complete_assistant_message_v4(
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
WITH updated_message AS (
    UPDATE general_messages_entry
    SET content = assistant_content,
        completed = true,
        updated_at = NOW()
    WHERE id = message_id
    RETURNING run_id
),
updated_run AS (
    UPDATE runs_entry
    SET input_tokens = input_tokens,
        output_tokens = output_tokens,
        updated_at = NOW()
    WHERE id = (SELECT run_id FROM updated_message)
    RETURNING id
)
SELECT EXISTS(SELECT 1 FROM updated_run) as success;
$$;
