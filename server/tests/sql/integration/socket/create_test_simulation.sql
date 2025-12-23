-- Create a test simulation with required dependencies
-- Parameters: $1 = department_id (UUID), $2 = rubric_id (UUID), $3 = title (text, optional)
-- Returns: simulation_id (UUID)
WITH dept AS (
    SELECT $1::uuid AS id
),
rubric AS (
    SELECT $2::uuid AS id
),
sim AS (
    INSERT INTO simulations(
        title,
        description,
        active,
        practice_simulation
    )
    VALUES (
        COALESCE($3, 'Test Simulation'),
        'Test Description',
        true,
        false
    )
    RETURNING id
)
INSERT INTO simulation_departments(simulation_id, department_id, active)
SELECT s.id, d.id, true
FROM sim s, dept d
RETURNING simulation_id;

