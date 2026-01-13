DROP FUNCTION IF EXISTS api_insert_objective_v4(text, integer, uuid);
CREATE OR REPLACE FUNCTION api_insert_objective_v4(
    objective text,
    idx integer,
    scenario_id uuid
)
RETURNS TABLE (
    objective_id text
)
LANGUAGE sql
AS $$
WITH existing_obj AS (
    SELECT id as objective_id FROM objectives_resource WHERE objectives_resource.objective = api_insert_objective_v4.objective LIMIT 1
),
create_obj AS (
    INSERT INTO objectives_resource (objective, created_at, updated_at)
    SELECT api_insert_objective_v4.objective, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM existing_obj)
    RETURNING id as objective_id
),
all_obj AS (
    SELECT objective_id FROM existing_obj
    UNION ALL
    SELECT objective_id FROM create_obj
),
link_scenario AS (
    INSERT INTO scenario_objectives (scenario_id, objective_id, idx, created_at)
    SELECT api_insert_objective_v4.scenario_id, objective_id, api_insert_objective_v4.idx, NOW()
    FROM all_obj
    WHERE api_insert_objective_v4.scenario_id IS NOT NULL
    RETURNING objective_id
)
SELECT objective_id::text as objective_id
FROM all_obj
$$;