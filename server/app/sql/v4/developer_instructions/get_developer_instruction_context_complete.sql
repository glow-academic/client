-- Get developer instruction context with whitelisted fields from resource schemas
-- Builds JSONB context for Jinja template rendering based on agent's artifacts and scenario resources
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_developer_instruction_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_developer_instruction_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_developer_instruction_context_v4(
    p_agent_id uuid,
    p_scenario_id uuid DEFAULT NULL
)
RETURNS TABLE (
    parameters jsonb,
    fields jsonb,
    documents jsonb,
    times jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH agent_has_scenario_artifact AS (
    -- Check if agent has scenario artifact
    SELECT EXISTS (
        SELECT 1 FROM domains d
        WHERE d.agent_id = p_agent_id
        AND d.artifact = 'scenario'::artifacts
    ) as has_scenario
),
-- Get parameters for scenario (if scenario_id provided and agent has scenario artifact)
scenario_parameters_data AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM agent_has_scenario_artifact WHERE has_scenario = true) 
                 AND p_scenario_id IS NOT NULL THEN
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', p.id::text,
                            'name', p.name,
                            'description', p.description,
                            'active', p.active,
                            'document_parameter', p.document_parameter,
                            'persona_parameter', p.persona_parameter,
                            'scenario_parameter', p.scenario_parameter,
                            'video_parameter', p.video_parameter,
                            'simulation_parameter', p.simulation_parameter,
                            'created_at', p.created_at::text,
                            'updated_at', p.updated_at::text
                        )
                        ORDER BY p.name
                    ),
                    '[]'::jsonb
                )
            ELSE '[]'::jsonb
        END as parameters
    FROM scenario_parameters sp
    JOIN parameters p ON p.id = sp.parameter_id
    WHERE (p_scenario_id IS NOT NULL AND sp.scenario_id = p_scenario_id)
      AND sp.active = true
      AND p.active = true
      AND EXISTS (SELECT 1 FROM agent_has_scenario_artifact WHERE has_scenario = true)
),
-- Get fields for scenario (if scenario_id provided and agent has scenario artifact)
scenario_fields_data AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM agent_has_scenario_artifact WHERE has_scenario = true) 
                 AND p_scenario_id IS NOT NULL THEN
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', f.id::text,
                            'name', f.name,
                            'description', f.description,
                            'parameter_id', f.parameter_id::text,
                            'active', f.active,
                            'created_at', f.created_at::text,
                            'updated_at', f.updated_at::text
                        )
                        ORDER BY f.name
                    ),
                    '[]'::jsonb
                )
            ELSE '[]'::jsonb
        END as fields
    FROM scenario_fields sf
    JOIN fields f ON f.id = sf.field_id
    WHERE (p_scenario_id IS NOT NULL AND sf.scenario_id = p_scenario_id)
      AND sf.active = true
      AND f.active = true
      AND EXISTS (SELECT 1 FROM agent_has_scenario_artifact WHERE has_scenario = true)
),
-- Get documents for scenario (if scenario_id provided and agent has scenario artifact)
scenario_documents_data AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM agent_has_scenario_artifact WHERE has_scenario = true) 
                 AND p_scenario_id IS NOT NULL THEN
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', d.id::text,
                            'name', d.name,
                            'description', COALESCE(d.description, ''),
                            'content', COALESCE(d.content, ''),
                            'active', d.active,
                            'created_at', d.created_at::text,
                            'updated_at', d.updated_at::text
                        )
                        ORDER BY d.name
                    ),
                    '[]'::jsonb
                )
            ELSE '[]'::jsonb
        END as documents
    FROM scenario_documents sd
    JOIN documents d ON d.id = sd.document_id
    WHERE (p_scenario_id IS NOT NULL AND sd.scenario_id = p_scenario_id)
      AND sd.active = true
      AND d.active = true
      AND EXISTS (SELECT 1 FROM agent_has_scenario_artifact WHERE has_scenario = true)
)
SELECT 
    COALESCE((SELECT parameters FROM scenario_parameters_data), '[]'::jsonb) as parameters,
    COALESCE((SELECT fields FROM scenario_fields_data), '[]'::jsonb) as fields,
    COALESCE((SELECT documents FROM scenario_documents_data), '[]'::jsonb) as documents,
    '[]'::jsonb as times
$$;

