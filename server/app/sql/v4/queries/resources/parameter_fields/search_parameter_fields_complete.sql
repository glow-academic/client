-- Search available fields per parameter via parameter_fields_junction
-- CLEAN PATTERN: Query via junction with fields_resource for name/description
-- Gets all AVAILABLE fields for given parameters (what user can select)
-- Parameters: parameter_ids (uuid[]) - these are RESOURCE IDs (from parameters_resource)
--             If empty, returns fields for ALL persona_parameter=true parameters (for upfront loading)
-- Returns: items (array of available fields with parameter_id for grouping)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_parameter_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_parameter_fields_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_parameter_fields_v4(
    parameter_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_parameter_fields_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            pfj.field_resource_id,
            pfj.field_resource_id,
            ppj.parameters_id,
            fr.name,
            COALESCE(fr.description, ''),
            false,
            cp_lookup.conditional_parameter_id
        )::types.q_get_parameter_fields_v4_item
        ORDER BY ppj.parameters_id, fr.name
    ),
    ARRAY[]::types.q_get_parameter_fields_v4_item[]
) as items
FROM parameter_fields_junction pfj
-- Map artifact ID → resource ID via parameter_parameters_junction
JOIN parameter_parameters_junction ppj ON ppj.parameter_id = pfj.parameter_id
-- Join parameters_resource to filter by persona_parameter
JOIN parameters_resource pr ON pr.id = ppj.parameters_id
-- Get field name/description directly from fields_resource (denormalized)
JOIN fields_resource fr ON fr.id = pfj.field_resource_id
-- Left join to get conditional_parameter_id if this field triggers a conditional parameter
LEFT JOIN (
    SELECT fcpj.field_id, cpr.parameter_id as conditional_parameter_id
    FROM field_conditional_parameters_junction fcpj
    JOIN conditional_parameters_resource cpr ON cpr.id = fcpj.conditional_parameter_id
    WHERE fcpj.active = true AND cpr.active = true
) cp_lookup ON cp_lookup.field_id = fr.id
WHERE pfj.active = true
  AND fr.active = true
  AND fr.name IS NOT NULL
  AND fr.name != ''
  -- If parameter_ids is empty, return all fields for persona_parameter=true parameters
  -- If parameter_ids is provided, return fields for those specific parameters (includes conditional params)
  AND (
      (COALESCE(array_length(parameter_ids, 1), 0) = 0 AND pr.persona_parameter = true)
      OR ppj.parameters_id = ANY(parameter_ids)
  );
$$;
