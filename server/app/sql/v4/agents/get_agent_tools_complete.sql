-- Get all active tools for an agent
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern
-- 1) Drop function first
DROP FUNCTION IF EXISTS socket_get_agent_tools_v4(uuid);

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_agent_tools_v4(
    agent_id uuid
)
RETURNS TABLE (
    id uuid,
    name text,
    description text,
    tool_type text,
    agent_role text,
    arguments jsonb,
    argument_descriptions jsonb,
    argument_defaults jsonb,
    active boolean
)
LANGUAGE sql
STABLE
AS $$
WITH tool_schema_data AS (
    SELECT 
        t.id as tool_id,
        -- Build arguments JSONB FROM tool_args → args_resource
        COALESCE(
            jsonb_object_agg(
                ar.name,
                jsonb_build_object(
                    'type', CASE ar.field_type
                        WHEN 'string' THEN 'string'
                        WHEN 'number' THEN 'number'
                        WHEN 'boolean' THEN 'boolean'
                        WHEN 'array' THEN 'array'
                        ELSE 'string'
                    END,
                    'required', COALESCE(ar.required, false)
                )
                ORDER BY ar.position NULLS LAST, ar.created_at
            ) FILTER (WHERE ar.name IS NOT NULL),
            '{}'::jsonb
        ) as arguments,
        -- Build argument_descriptions JSONB FROM args_resource.description
        COALESCE(
            jsonb_object_agg(
                ar.name,
                ar.description
                ORDER BY ar.position NULLS LAST, ar.created_at
            ) FILTER (WHERE ar.name IS NOT NULL AND ar.description != ''),
            '{}'::jsonb
        ) as argument_descriptions,
        -- Build argument_defaults JSONB FROM args_resource.default_value
        COALESCE(
            jsonb_object_agg(
                ar.name,
                CASE 
                    WHEN ar.default_value = '' THEN NULL
                    WHEN ar.field_type = 'number' THEN 
                        CASE 
                            WHEN ar.default_value ~ '^-?[0-9]+\.?[0-9]*$' THEN to_jsonb(ar.default_value::numeric)
                            ELSE NULL
                        END
                    WHEN ar.field_type = 'boolean' THEN 
                        CASE 
                            WHEN LOWER(ar.default_value) IN ('true', '1', 'yes') THEN 'true'::jsonb
                            WHEN LOWER(ar.default_value) IN ('false', '0', 'no') THEN 'false'::jsonb
                            ELSE NULL
                        END
                    WHEN ar.field_type = 'array' THEN 
                        CASE 
                            WHEN ar.default_value ~ '^\[.*\]$' THEN ar.default_value::jsonb
                            ELSE NULL
                        END
                    ELSE ar.default_value::jsonb
                END
                ORDER BY ar.position NULLS LAST, ar.created_at
            ) FILTER (WHERE ar.name IS NOT NULL AND ar.default_value != ''),
            '{}'::jsonb
        ) as argument_defaults
    FROM agent_tools at
    JOIN tool_artifact t ON t.id = at.tool_id
    LEFT JOIN tool_args ta ON ta.tool_id = t.id
    LEFT JOIN args_resource ar ON ar.id = ta.args_id AND ar.active = true
    WHERE at.agent_id = socket_get_agent_tools_v4.agent_id
      AND at.active = TRUE
      AND EXISTS (
          SELECT 1 FROM tool_flags tf 
          JOIN flags_resource f ON tf.flag_id = f.id 
          WHERE tf.tool_id = t.id 
            AND f.name = 'active' 
            AND f.name = 'active' 
            AND tf.value = true
      )
    GROUP BY t.id
)
SELECT DISTINCT ON (t.id)
    t.id,
    (SELECT n.name FROM tool_names tn 
     JOIN names_resource n ON tn.name_id = n.id 
     WHERE tn.tool_id = t.id 
     LIMIT 1) as name,
    (SELECT d.description FROM tool_descriptions td 
     JOIN descriptions_resource d ON td.description_id = d.id 
     WHERE td.tool_id = t.id 
     LIMIT 1) as description,
    COALESCE(rt.resource::text, '') as tool_type,  -- Derive from resource enum
    COALESCE(NULL::artifacts::text, '') as agent_role,  -- Derive from agent's tools via artifact_resources
    COALESCE(tsd.arguments, '{}'::jsonb) as arguments,
    COALESCE(tsd.argument_descriptions, '{}'::jsonb) as argument_descriptions,
    COALESCE(tsd.argument_defaults, '{}'::jsonb) as argument_defaults,
    EXISTS (
        SELECT 1 FROM tool_flags tf 
        JOIN flags_resource f ON tf.flag_id = f.id 
        WHERE tf.tool_id = t.id 
          AND f.name = 'active' 
          AND f.name = 'active' 
          AND tf.value = true
    ) as active
FROM agent_tools at
JOIN tool_artifact t ON t.id = at.tool_id
LEFT JOIN resource_tools rt ON rt.tool_id = t.id
LEFT JOIN LATERAL (
    SELECT DISTINCT ar.artifact::text
    FROM agent_tools at2
    JOIN resource_tools rt2 ON rt2.tool_id = at2.tool_id
    JOIN artifact_resources ar ON ar.resource = rt2.resource
    WHERE at2.agent_id = at.agent_id AND at2.active = TRUE
    LIMIT 1
) da ON TRUE
LEFT JOIN tool_schema_data tsd ON tsd.tool_id = t.id
WHERE at.agent_id = socket_get_agent_tools_v4.agent_id
  AND at.active = TRUE
  AND EXISTS (
      SELECT 1 FROM tool_flags tf 
      JOIN flags_resource f ON tf.flag_id = f.id 
      WHERE tf.tool_id = t.id 
        AND f.name = 'active' 
        AND f.name = 'active' 
        AND tf.value = true
  )
ORDER BY t.id, COALESCE(rt.resource::text, ''), (SELECT n.name FROM tool_names tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1)
$$;