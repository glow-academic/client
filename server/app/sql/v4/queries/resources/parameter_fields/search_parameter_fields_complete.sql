-- Search parameter fields resources by parameter IDs
-- Gets all available parameter_fields for given parameters
-- Parameters: parameter_ids (uuid[])
-- Returns: items (array of parameter field resources with parameter_id)

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
            pfr.id,
            pfr.field_id,
            pfr.parameter_id,
            (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1),
            COALESCE((SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = ffj.field_id LIMIT 1), ''),
            COALESCE(pfr.generated, false)
        )::types.q_get_parameter_fields_v4_item
        ORDER BY pfr.parameter_id, (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1)
    ),
    ARRAY[]::types.q_get_parameter_fields_v4_item[]
) as items
FROM parameter_fields_resource pfr
JOIN field_fields_junction ffj ON ffj.fields_id = pfr.field_id
WHERE pfr.active = true
  AND pfr.parameter_id = ANY(parameter_ids)
  AND EXISTS (
      SELECT 1 FROM field_flags_junction ff
      JOIN flags_resource fl ON ff.flag_id = fl.id
      WHERE ff.field_id = ffj.field_id
        AND fl.name = 'field_active'
        AND ff.value = true
  );
$$;
