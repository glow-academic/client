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
        ts.schema_id,
        -- Build arguments JSONB FROM schema_fields_resource
        COALESCE(
            jsonb_object_agg(
                sf.name,
                jsonb_build_object(
                    'type', CASE sf.field_type
                        WHEN 'string' THEN 'string'
                        WHEN 'number' THEN 'number'
                        WHEN 'boolean' THEN 'boolean'
                        WHEN 'array' THEN 'array'
                        ELSE 'string'
                    END,
                    'required', sf.required
                )
                ORDER BY sf.position
            ) FILTER (WHERE sf.name IS NOT NULL),
            '{}'::jsonb
        ) as arguments,
        -- Build argument_descriptions JSONB FROM schema_fields_resource.description
        COALESCE(
            jsonb_object_agg(
                sf.name,
                sf.description
                ORDER BY sf.position
            ) FILTER (WHERE sf.name IS NOT NULL AND sf.description != ''),
            '{}'::jsonb
        ) as argument_descriptions,
        -- Build argument_defaults JSONB FROM schema_fields_resource.default_value
        COALESCE(
            jsonb_object_agg(
                sf.name,
                CASE 
                    WHEN sf.default_value = '' THEN NULL
                    WHEN sf.field_type = 'number' THEN 
                        CASE 
                            WHEN sf.default_value ~ '^-?[0-9]+\.?[0-9]*$' THEN to_jsonb(sf.default_value::numeric)
                            ELSE NULL
                        END
                    WHEN sf.field_type = 'boolean' THEN 
                        CASE 
                            WHEN LOWER(sf.default_value) IN ('true', '1', 'yes') THEN 'true'::jsonb
                            WHEN LOWER(sf.default_value) IN ('false', '0', 'no') THEN 'false'::jsonb
                            ELSE NULL
                        END
                    WHEN sf.field_type = 'array' THEN 
                        CASE 
                            WHEN sf.default_value ~ '^\[.*\]$' THEN sf.default_value::jsonb
                            ELSE NULL
                        END
                    ELSE sf.default_value::jsonb
                END
                ORDER BY sf.position
            ) FILTER (WHERE sf.name IS NOT NULL AND sf.default_value != ''),
            '{}'::jsonb
        ) as argument_defaults
    FROM agent_tools at
    JOIN tool_artifact t ON t.id = at.tool_id
    LEFT JOIN tool_schemas ts ON ts.tool_id = t.id
    LEFT JOIN schemas_resource s ON s.id = ts.schema_id
    LEFT JOIN schema_fields_resource sf ON sf.schema_id = s.id
    WHERE at.agent_id = socket_get_agent_tools_v4.agent_id
      AND at.active = TRUE
      AND t.active = TRUE
    GROUP BY t.id, ts.schema_id
)
SELECT DISTINCT ON (t.id)
    t.id,
    t.name,
    t.description,
    COALESCE(rt.resource::text, '') as tool_type,  -- Derive from resource enum
    COALESCE(da.artifact::text, '') as agent_role,  -- Derive from agent's tools via artifact_resources
    COALESCE(tsd.arguments, '{}'::jsonb) as arguments,
    COALESCE(tsd.argument_descriptions, '{}'::jsonb) as argument_descriptions,
    COALESCE(tsd.argument_defaults, '{}'::jsonb) as argument_defaults,
    t.active
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
  AND t.active = TRUE
ORDER BY t.id, COALESCE(rt.resource::text, ''), t.name
$$;