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
        SELECT 1 FROM agent_domains adom
        JOIN domain_artifacts da ON da.domain_id = adom.domain_id
        WHERE adom.agent_id = p_agent_id
        AND da.artifact = 'scenario'::artifacts
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
                            'name', (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
                            'description', (SELECT d.description FROM parameter_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1),
                            'active', EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = p.id AND pf.type = 'active'::type_parameter_flags AND pf.value = TRUE),
                            'document_parameter', EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = p.id AND pf.type = 'document_parameter'::type_parameter_flags AND pf.value = TRUE),
                            'persona_parameter', EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = p.id AND pf.type = 'persona_parameter'::type_parameter_flags AND pf.value = TRUE),
                            'scenario_parameter', EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = p.id AND pf.type = 'scenario_parameter'::type_parameter_flags AND pf.value = TRUE),
                            'video_parameter', EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = p.id AND pf.type = 'video_parameter'::type_parameter_flags AND pf.value = TRUE),
                            'simulation_parameter', EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = p.id AND pf.type = 'simulation_parameter'::type_parameter_flags AND pf.value = TRUE),
                            'created_at', p.created_at::text,
                            'updated_at', p.updated_at::text
                        )
                        ORDER BY (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1)
                    ),
                    '[]'::jsonb
                )
            ELSE '[]'::jsonb
        END as parameters
    FROM scenario_parameters sp
    JOIN parameters_resource p ON p.id = sp.parameter_id
    WHERE (p_scenario_id IS NOT NULL AND sp.scenario_id = p_scenario_id)
      AND sp.active = true
      AND EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = p.id AND pf.type = 'active'::type_parameter_flags AND pf.value = true)
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
                            'name', (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
                            'description', (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
                            'parameter_id', (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)::text,
                            'active', EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = TRUE),
                            'created_at', f.created_at::text,
                            'updated_at', f.updated_at::text
                        )
                        ORDER BY (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1)
                    ),
                    '[]'::jsonb
                )
            ELSE '[]'::jsonb
        END as fields
    FROM scenario_fields sf
    JOIN fields_resource f ON f.id = sf.field_id
    WHERE (p_scenario_id IS NOT NULL AND sf.scenario_id = p_scenario_id)
      AND sf.active = true
      AND EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true)
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
                            'name', (SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
                            'description', COALESCE((SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1), ''),
                            'content', '',  -- document_content table was removed, content now accessed via message_documents → message_contents
                            'active', EXISTS (SELECT 1 FROM document_flags df WHERE df.document_id = d.id AND df.type = 'active'::type_document_flags AND df.value = TRUE),
                            'created_at', d.created_at::text,
                            'updated_at', d.updated_at::text
                        )
                        ORDER BY (SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1)
                    ),
                    '[]'::jsonb
                )
            ELSE '[]'::jsonb
        END as documents
    FROM scenario_documents sd
    JOIN documents_resource d ON d.id = sd.document_id
    WHERE (p_scenario_id IS NOT NULL AND sd.scenario_id = p_scenario_id)
      AND sd.active = true
      AND EXISTS (SELECT 1 FROM document_flags df WHERE df.document_id = d.id AND df.type = 'active'::type_document_flags AND df.value = true)
      AND EXISTS (SELECT 1 FROM agent_has_scenario_artifact WHERE has_scenario = true)
)
SELECT 
    COALESCE((SELECT parameters FROM scenario_parameters_data), '[]'::jsonb) as parameters,
    COALESCE((SELECT fields FROM scenario_fields_data), '[]'::jsonb) as fields,
    COALESCE((SELECT documents FROM scenario_documents_data), '[]'::jsonb) as documents,
    '[]'::jsonb as times
$$;

