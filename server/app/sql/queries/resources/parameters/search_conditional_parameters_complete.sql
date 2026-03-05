-- Search conditional parameters recursively via the chain
-- Parameters: parameter_ids (uuid[]) - Starting parameter IDs (persona_parameter=true params)
-- Returns: items (array of conditional parameters, with conditional=true)
--
-- This uses a recursive CTE to find ALL conditional parameters in the chain:
-- - Base case: conditional params linked to fields of starting parameters
-- - Recursive case: conditional params linked to fields of already-found conditional params
-- This supports chains like: Persona Type -> Temperament -> Intensity

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_conditional_parameters_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_conditional_parameters_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_conditional_parameters_v4(
    parameter_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_parameters_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH RECURSIVE conditional_chain AS (
    -- Base case: conditional params linked to fields of starting parameters
    SELECT DISTINCT cpr.parameter_id
    FROM conditional_parameters_resource cpr
    JOIN field_conditional_parameters_junction fcpj ON fcpj.conditional_parameters_id = cpr.id
    JOIN field_fields_junction ffj ON ffj.field_id = fcpj.field_id
    JOIN fields_resource fr ON fr.id = ffj.fields_id
    JOIN parameter_fields_junction pfj ON pfj.fields_id = fr.id
    JOIN parameter_parameters_junction ppj ON ppj.parameter_id = pfj.parameter_id
    WHERE cpr.active = true
      AND fcpj.active = true
      AND pfj.active = true
      AND ppj.parameters_id = ANY(parameter_ids)

    UNION

    -- Recursive case: conditional params linked to fields of already-found conditional params
    SELECT DISTINCT cpr.parameter_id
    FROM conditional_chain cc
    JOIN parameter_parameters_junction ppj ON ppj.parameters_id = cc.parameter_id
    JOIN parameter_fields_junction pfj ON pfj.parameter_id = ppj.parameter_id
    JOIN fields_resource fr ON fr.id = pfj.fields_id
    JOIN field_fields_junction ffj ON ffj.fields_id = fr.id
    JOIN field_conditional_parameters_junction fcpj ON fcpj.field_id = ffj.field_id
    JOIN conditional_parameters_resource cpr ON cpr.id = fcpj.conditional_parameters_id
    WHERE cpr.active = true
      AND fcpj.active = true
      AND pfj.active = true
)
SELECT COALESCE(
    ARRAY_AGG(
        (
            pr.id,
            pr.name,
            COALESCE(pr.description, ''),
            COALESCE(pr.value, ''),
            COALESCE(pr.generated, false),
            COALESCE(pr.persona_parameter, false),
            COALESCE(pr.document_parameter, false),
            COALESCE(pr.scenario_parameter, false),
            COALESCE(pr.video_parameter, false),
            true,  -- conditional = true for all results from this function
            COALESCE(pr.field_ids, ARRAY[]::uuid[])
        )::types.q_get_parameters_v4_item
        ORDER BY pr.name
    ),
    ARRAY[]::types.q_get_parameters_v4_item[]
) as items
FROM conditional_chain cc
JOIN parameters_resource pr ON pr.id = cc.parameter_id
WHERE pr.active = true
  AND pr.name IS NOT NULL
  AND pr.name != '';
$$;
