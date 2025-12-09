-- Insert objective (strong entity) and optionally link to scenario with idx
-- Parameters: $1=objective (text), $2=idx (int), $3=scenario_id (uuid, nullable)
WITH existing_obj AS (
    SELECT id as objective_id FROM objectives WHERE objective = $1 LIMIT 1
),
create_obj AS (
    INSERT INTO objectives (objective, created_at, updated_at)
    SELECT $1, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM existing_obj)
    RETURNING id as objective_id
),
all_obj AS (
    SELECT objective_id FROM existing_obj
    UNION ALL
    SELECT objective_id FROM create_obj
)
INSERT INTO scenario_objectives (scenario_id, objective_id, idx, created_at)
SELECT $3::uuid, objective_id, $2, NOW()
FROM all_obj
WHERE $3 IS NOT NULL
RETURNING objective_id::text as objective_id
UNION ALL
SELECT objective_id::text as objective_id
FROM all_obj
WHERE $3 IS NULL

