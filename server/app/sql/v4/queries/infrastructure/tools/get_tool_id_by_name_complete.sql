-- Get tool_id by tool name
DROP FUNCTION IF EXISTS infra_get_tool_id_by_name_v4(text);

CREATE OR REPLACE FUNCTION infra_get_tool_id_by_name_v4(
    tool_name text
)
RETURNS TABLE (
    tool_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT t.id as tool_id
    FROM tool_artifact t
    JOIN tool_names_junction tn ON tn.tool_id = t.id
    JOIN names_resource n ON n.id = tn.name_id
    WHERE n.name = tool_name
      AND EXISTS (
          SELECT 1
          FROM tool_flags_junction tf
          JOIN flags_resource f ON f.id = tf.flag_id
          WHERE tf.tool_id = t.id
            AND f.name = 'tool_active'
            AND tf.value = true
      )
    LIMIT 1;
$$;
