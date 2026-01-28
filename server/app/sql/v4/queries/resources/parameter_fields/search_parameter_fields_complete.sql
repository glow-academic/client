-- Search available fields per parameter via parameter_fields_junction
-- Gets all AVAILABLE fields for given parameters (what user can select)
-- Note: This queries parameter_fields_junction (available), NOT parameter_fields_resource (already created)
-- Parameters: parameter_ids (uuid[])
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
            -- id: Use field_resource_id as the unique identifier for this available field
            pfj.field_resource_id,
            -- field_id: The underlying field definition
            pfj.field_resource_id,
            -- parameter_id: Which parameter this field belongs to
            pfj.parameter_id,
            -- name: Get field name via field_fields_junction
            (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1),
            -- description: Get field description via field_fields_junction
            COALESCE((SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = ffj.field_id LIMIT 1), ''),
            -- generated: Available fields are not generated (this refers to base field definition)
            false
        )::types.q_get_parameter_fields_v4_item
        ORDER BY pfj.parameter_id, (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1)
    ),
    ARRAY[]::types.q_get_parameter_fields_v4_item[]
) as items
FROM parameter_fields_junction pfj
JOIN fields_resource fr ON fr.id = pfj.field_resource_id
JOIN field_fields_junction ffj ON ffj.fields_id = fr.id
WHERE pfj.active = true
  AND pfj.parameter_id = ANY(parameter_ids)
  AND EXISTS (
      SELECT 1 FROM field_flags_junction ff
      JOIN flags_resource fl ON ff.flag_id = fl.id
      WHERE ff.field_id = ffj.field_id
        AND fl.name = 'field_active'
        AND ff.value = true
  );
$$;
