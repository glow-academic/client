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
        pi.id,
        pi.name,
        COALESCE(pi.description, '') as description,
        pi.value,
        pi.parameter_id,
        p.name as parameter_name,
        p.document_parameter
    FROM parameter_items pi
    JOIN parameters p ON p.id = pi.parameter_id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE p.active = true
      AND p.document_parameter = true
      AND (
          -- Filter by parameter_ids if provided
          (COALESCE(array_length($1::uuid[], 1), 0) = 0 OR p.id = ANY($1::uuid[]))
      )
      AND (
          -- Include if item is in user's departments OR is cross-department
          pid.department_id IN (SELECT department_id FROM user_departments)
          OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
      )
    GROUP BY pi.id, pi.name, pi.description, pi.value, pi.parameter_id, p.id, p.name, p.document_parameter
)
SELECT 
    id::text,
    name,
    description,
    value,
    parameter_id::text,
    parameter_name,
    document_parameter
FROM parameter_items_data
ORDER BY parameter_name, name

