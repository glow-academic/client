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
        f.name,
        COALESCE(f.description, '') as description,
        f.parameter_id,
        p.name as parameter_name,
        p.document_parameter
    FROM fields f
    JOIN parameters p ON p.id = f.parameter_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    CROSS JOIN params p_params
    WHERE p.active = true
      AND p.document_parameter = true
      AND (
          -- Filter by parameter_ids if provided
          (COALESCE(array_length(p_params.parameter_ids, 1), 0) = 0 OR p.id = ANY(p_params.parameter_ids))
      )
      AND (
          -- Include if item is in user's departments OR is cross-department
          fd.department_id IN (SELECT department_id FROM user_departments)
          OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
      )
    GROUP BY f.id, f.name, f.description, f.parameter_id, p.id, p.name, p.document_parameter
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