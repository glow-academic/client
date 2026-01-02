-- Create a test simulation linked to a rubric for test setup
-- Returns simulation data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_simulation_with_rubric_v4(uuid, text, text, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_simulation_with_rubric_v4(
    input_rubric_id uuid,
    simulation_name text DEFAULT 'Test Simulation',
    simulation_description text DEFAULT 'Test Description',
    simulation_active boolean DEFAULT true
)
RETURNS TABLE (
    simulation_id uuid,
    name text,
    description text,
    active boolean,
    rubric_id uuid,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    -- NOTE: simulations table doesn't have rubric_id column
    -- Simulations don't directly link to rubrics in current schema
    -- This function creates a simulation without rubric link - tests using this may need updating
    INSERT INTO simulations(title, description, active)
    VALUES (
        COALESCE(simulation_name, 'Test Simulation'),
        COALESCE(simulation_description, 'Test Description'),
        simulation_active
    )
    RETURNING id AS simulation_id, title AS name, description, active, NULL::uuid AS rubric_id, created_at;
$$;

COMMIT;

