-- Complete assistant message and update run tokens (general)
-- After migration 364: messages_entry has run_id/completed, contents_entry has content
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
    UPDATE messages_entry
    SET completed = true,
        updated_at = NOW()
    WHERE id = message_id
    RETURNING id, run_id
),
new_content AS (
    INSERT INTO contents_entry (message_id, content)
    SELECT message_id, assistant_content
    FROM updated_message
    RETURNING id AS content_id
),
new_sim_content AS (
    INSERT INTO simulation_contents_entry (content_id, simulation_message_id)
    SELECT nc.content_id, message_id
    FROM new_content nc
    RETURNING content_id
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
