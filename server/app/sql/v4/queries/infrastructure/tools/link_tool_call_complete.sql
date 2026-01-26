-- Link tool to call in tool_calls_junction
DROP FUNCTION IF EXISTS infra_link_tool_call_v4(uuid, uuid);

CREATE OR REPLACE FUNCTION infra_link_tool_call_v4(
    tool_id uuid,
    call_id uuid
)
RETURNS TABLE (
    success boolean
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO tool_calls_junction (tool_id, call_id)
    VALUES (tool_id, call_id)
    ON CONFLICT DO NOTHING;

    SELECT true as success;
$$;
