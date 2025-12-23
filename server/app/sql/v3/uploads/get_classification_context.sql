-- Get parameter items for classification based on parameterIds filter
-- Parameters: $1=parameter_ids[] (uuid array, optional - if empty/null, get all document parameters), $2=profile_id (uuid)
-- Returns: parameter items with their details

WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $2 AND active = true
),
parameter_items_data AS (
    SELECT 
        f.id,
        f.name,
        COALESCE(f.description, '') as description,
        fp.parameter_id,
        p.name as parameter_name,
        p.document_parameter
    FROM fields f
    JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
    JOIN parameters p ON p.id = fp.parameter_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE p.active = true
      AND p.document_parameter = true
      AND (
          -- Filter by parameter_ids if provided
          (COALESCE(array_length($1::uuid[], 1), 0) = 0 OR p.id = ANY($1::uuid[]))
      )
      AND (
          -- Include if item is in user's departments OR is cross-department
          fd.department_id IN (SELECT department_id FROM user_departments)
          OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
      )
    GROUP BY f.id, f.name, f.description, fp.parameter_id, p.id, p.name, p.document_parameter
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

