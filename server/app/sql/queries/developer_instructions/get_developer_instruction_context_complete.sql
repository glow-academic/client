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
        SELECT 1 
        
        WHERE NULL::uuid = p_agent_id
        AND NULL::artifact_type = 'scenario'::artifact_type
    ) as has_scenario
),
-- Get parameters for scenario (if scenario_id provided and agent has scenario artifact)
-- Derived from scenario_parameter_fields_junction -> parameter_fields_resource -> parameters_resource
scenario_parameters_data AS (
    SELECT
        CASE
            WHEN EXISTS (SELECT 1 FROM agent_has_scenario_artifact WHERE has_scenario = true)
                 AND p_scenario_id IS NOT NULL THEN
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', p.id::text,
                            'name', (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
                            'description', (SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1),
                            'active', EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND f.value = TRUE),
                            'document_parameter', EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'document_parameter' AND f.value = TRUE),
                            'persona_parameter', EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'persona_parameter' AND f.value = TRUE),
                            'scenario_parameter', EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'scenario_parameter' AND f.value = TRUE),
                            'video_parameter', EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'video_parameter' AND f.value = TRUE),
                            'simulation_parameter', EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'simulation_parameter' AND f.value = TRUE),
                            'created_at', p.created_at::text,
                            'updated_at', p.created_at::text
                        )
                        ORDER BY (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1)
                    ),
                    '[]'::jsonb
                )
            ELSE '[]'::jsonb
        END as parameters
    FROM (
        SELECT DISTINCT pfr.parameter_id
        FROM scenario_parameter_fields_junction spf
        JOIN parameter_fields_resource pfr ON pfr.id = spf.parameter_field_id
        WHERE spf.scenario_id = p_scenario_id
          AND spf.active = true
          AND pfr.parameter_id IS NOT NULL
    ) distinct_params
    JOIN parameters_resource p ON p.id = distinct_params.parameter_id
    WHERE p_scenario_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND f.value = true)
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
                            'name', (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
                            'description', (SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
                            'parameter_id', pfr.parameter_id::text,
                            'active', EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'field_active' AND fl.value = TRUE),
                            'created_at', f.created_at::text,
                            'updated_at', f.created_at::text
                        )
                        ORDER BY (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1)
                    ),
                    '[]'::jsonb
                )
            ELSE '[]'::jsonb
        END as fields
    FROM scenario_parameter_fields_junction spf
    JOIN parameter_fields_resource pfr ON pfr.id = spf.parameter_field_id
    JOIN fields_resource f ON f.id = pfr.field_id
    WHERE (p_scenario_id IS NOT NULL AND spf.scenario_id = p_scenario_id)
      AND spf.active = true
      AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'field_active' AND fl.value = true)
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
                            'name', (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
                            'description', COALESCE((SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1), ''),
                            'content', '',  -- document_content table was removed, content now accessed via message_documents → message_contents
                            'active', EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'document_active' AND f.value = TRUE),
                            'created_at', d.created_at::text,
                            'updated_at', d.created_at::text
                        )
                        ORDER BY (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1)
                    ),
                    '[]'::jsonb
                )
            ELSE '[]'::jsonb
        END as documents
    FROM scenario_documents_junction sd
    JOIN documents_resource d ON d.id = sd.document_id
    WHERE (p_scenario_id IS NOT NULL AND sd.scenario_id = p_scenario_id)
      AND sd.active = true
      AND EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'document_active' AND f.value = true)
      AND EXISTS (SELECT 1 FROM agent_has_scenario_artifact WHERE has_scenario = true)
)
SELECT 
    COALESCE((SELECT parameters FROM scenario_parameters_data), '[]'::jsonb) as parameters,
    COALESCE((SELECT fields FROM scenario_fields_data), '[]'::jsonb) as fields,
    COALESCE((SELECT documents FROM scenario_documents_data), '[]'::jsonb) as documents,
    '[]'::jsonb as times
$$;

