-- Get resource_type by tool_id
DROP FUNCTION IF EXISTS infra_get_resource_type_by_tool_id_v4(uuid);

CREATE OR REPLACE FUNCTION infra_get_resource_type_by_tool_id_v4(
    tool_id uuid
)
RETURNS TABLE (
    resource_type text
)
LANGUAGE sql
STABLE
AS $$
    SELECT rtr.resource::text as resource_type
    FROM resource_tools_relation rtr
    WHERE rtr.tool_id = tool_id
      AND rtr.active = true
    LIMIT 1;
$$;
