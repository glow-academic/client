-- Get parameter items for classification based on parameterIds filter
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern
-- 1) Drop function first
DROP FUNCTION IF EXISTS socket_get_classification_context_v4(uuid[], uuid);

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_classification_context_v4(
    profile_id uuid,
    parameter_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    id text,
    name text,
    description text,
    parameter_id text,
    parameter_name text,
    document_parameter boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id, parameter_ids
),
user_departments AS (
    SELECT department_id
    FROM profile_departments pd
    CROSS JOIN params p
    WHERE pd.profile_id = p.profile_id AND pd.active = true
),
parameter_items_data AS (
    SELECT 
        f.id,
        (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        COALESCE((SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), '') as description,
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1) as parameter_name,
        EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = p.id AND pf.type = 'document_parameter'::type_parameter_flags AND pf.value = TRUE) as document_parameter
    FROM field_artifact f
    JOIN parameters_resource p ON p.id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    CROSS JOIN params p_params
    WHERE EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = p.id AND pf.type = 'active'::type_parameter_flags AND pf.value = true)
      AND EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = p.id AND pf.type = 'document_parameter'::type_parameter_flags AND pf.value = true)
      AND (
          -- Filter by parameter_ids if provided
          (COALESCE(array_length(p_params.parameter_ids, 1), 0) = 0 OR p.id = ANY(p_params.parameter_ids))
      )
      AND (
          -- Include if item is in user's departments OR is cross-department
          fd.department_id IN (SELECT department_id FROM user_departments)
          OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
      )
    GROUP BY f.id, (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1), p.id, (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = p.id AND pf.type = 'document_parameter'::type_parameter_flags AND pf.value = TRUE)
)
SELECT 
    id::text,
    name,
    description,
    parameter_id::text,
    parameter_name,
    document_parameter
FROM parameter_items_data
ORDER BY parameter_name, name
$$;