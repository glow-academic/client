-- Get simulation by ID
-- Parameters: $1=simulation_id (uuid)
-- Returns: id, title, description, active, practice_simulation, rubric_id
SELECT 
    id,
    title,
    description,
    active,
    practice_simulation,
    rubric_id
FROM simulations
WHERE id = $1::uuid

