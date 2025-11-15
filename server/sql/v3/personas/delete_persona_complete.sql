-- Delete persona with usage check and name fetch - returns usage_count, name, and deleted (boolean)
-- Parameters: $1 = persona_id (uuid)
-- Returns: usage_count (int), name (text), deleted (boolean)

WITH usage_check AS (
    SELECT COUNT(*)::integer as usage_count
    FROM scenario_personas
    WHERE persona_id = $1 AND active = true
),
persona_info AS (
    SELECT name FROM personas WHERE id = $1
),
delete_result AS (
    DELETE FROM personas 
    WHERE id = $1 
      AND (SELECT usage_count FROM usage_check) = 0
      AND EXISTS(SELECT 1 FROM persona_info)
    RETURNING id
)
SELECT 
    (SELECT usage_count FROM usage_check) as usage_count,
    (SELECT name FROM persona_info) as name,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted

