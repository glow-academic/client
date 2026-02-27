-- Get tools for an agent, filtered by resource types
-- Extracted from prepare_persona_generation for reuse
-- Parameters: p_agent_id (uuid), p_resource_types (text[])
-- Returns: tools array

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_agent_tools_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_agent_tools_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Ensure tool composite type exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type
        WHERE typname = 'i_get_text_run_context_and_create_run_v4_tool'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    ) THEN
        CREATE TYPE types.i_get_text_run_context_and_create_run_v4_tool AS (
            id uuid,
            name text,
            description text,
            resource text,
            artifact text,
            arguments jsonb,
            argument_descriptions jsonb,
            argument_defaults jsonb,
            active boolean
        );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION socket_get_agent_tools_v4(
    p_agent_id uuid,
    p_resource_types text[] DEFAULT NULL
)
RETURNS TABLE (
    tools types.i_get_text_run_context_and_create_run_v4_tool[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (t.id, (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1), COALESCE((SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1), ''), COALESCE(dr.resource::text, ''), COALESCE(NULL::artifact_type::text, ''), COALESCE(tsd.arguments, '{}'::jsonb), COALESCE(tsd.argument_descriptions, '{}'::jsonb), COALESCE(tsd.argument_defaults, '{}'::jsonb), EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true))::types.i_get_text_run_context_and_create_run_v4_tool
        ORDER BY COALESCE(dr.resource::text, ''), (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1)
    ) FILTER (WHERE t.id IS NOT NULL AND (
        p_resource_types IS NULL
        OR dr.resource IS NULL
        OR dr.resource::text = ANY(p_resource_types)
    )),
    '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]
) as tools
FROM agent_tools_junction atj
LEFT JOIN tools_resource tr ON tr.id = atj.tool_id
LEFT JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
LEFT JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
LEFT JOIN (
    SELECT
        tsd_inner.id as tool_id,
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
                    'required', ar.required
                )
                ORDER BY ar.name
            ) FILTER (WHERE ar.name IS NOT NULL),
            '{}'::jsonb
        ) as arguments,
        COALESCE(
            jsonb_object_agg(
                ar.name,
                ar.description
                ORDER BY ar.name
            ) FILTER (WHERE ar.name IS NOT NULL AND ar.description != ''),
            '{}'::jsonb
        ) as argument_descriptions,
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
                ORDER BY ar.name
            ) FILTER (WHERE ar.name IS NOT NULL AND ar.default_value != ''),
            '{}'::jsonb
        ) as argument_defaults
    FROM tool_artifact tsd_inner
    LEFT JOIN tool_args_junction ta ON ta.tool_id = tsd_inner.id
    LEFT JOIN args_resource ar ON ar.id = ta.args_id AND ar.active = true
    GROUP BY tsd_inner.id
) tsd ON tsd.tool_id = t.id
LEFT JOIN tool_resources_junction tdj ON tdj.tool_id = t.id AND tdj.active = true
LEFT JOIN resources_resource dr ON dr.id = tdj.resource_id AND dr.active = true
WHERE atj.agent_id = p_agent_id AND atj.active = true;
$$;
