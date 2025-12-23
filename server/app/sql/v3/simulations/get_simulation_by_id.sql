-- Get simulation by ID
-- Parameters: $1=simulation_id (uuid)
-- Returns: id, title, description, active, practice_simulation, rubric_id
SELECT 
    s.id,
    s.title,
    s.description,
    s.active,
    s.practice_simulation,
    (SELECT ss.rubric_id FROM simulation_scenarios ss WHERE ss.simulation_id = s.id AND ss.active = true ORDER BY ss.position LIMIT 1) as rubric_id
FROM simulations s
WHERE s.id = $1::uuid

