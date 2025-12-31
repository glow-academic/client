-- Insert objective and link to scenario
-- Parameters: $1=scenario_id, $2=idx, $3=objective (text)
WITH existing_obj AS (
    SELECT id as objective_id FROM objectives WHERE objective = $3 LIMIT 1
),
create_obj AS (
    INSERT INTO objectives (objective, created_at, updated_at)
    SELECT $3, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM existing_obj)
    RETURNING id as objective_id
),
all_obj AS (
    SELECT objective_id FROM existing_obj
    UNION ALL
    SELECT objective_id FROM create_obj
)
INSERT INTO scenario_objectives (scenario_id, objective_id, idx, created_at)
SELECT $1::uuid, objective_id, $2, NOW()
FROM all_obj

