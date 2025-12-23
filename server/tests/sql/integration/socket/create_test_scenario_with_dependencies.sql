-- Create a test scenario with persona and department links
-- Parameters: $1 = department_id (UUID, optional), $2 = persona_id (UUID, optional), $3 = name (text, optional)
-- Returns: scenario_id (UUID)
WITH dept AS (
    SELECT COALESCE($1::uuid, (SELECT id FROM departments WHERE active = true LIMIT 1)) AS id
),
scenario AS (
    INSERT INTO scenarios(name, active)
    VALUES (COALESCE($3, 'Test Scenario'), true)
    RETURNING id
),
scenario_tree AS (
    INSERT INTO scenario_tree(parent_id, child_id, active)
    SELECT s.id, s.id, true
    FROM scenario s
),
scenario_dept AS (
    INSERT INTO scenario_departments(scenario_id, department_id, active)
    SELECT s.id, d.id, true
    FROM scenario s, dept d
),
scenario_persona AS (
    INSERT INTO scenario_personas(scenario_id, persona_id, active)
    SELECT s.id, $2::uuid, true
    FROM scenario s
    WHERE $2 IS NOT NULL
)
SELECT id::text as scenario_id FROM scenario;

