-- Get simulation by ID with time_limit for test verification
-- Returns simulation data including time_limit for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_simulation_by_id_with_time_limit_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_simulation_by_id_with_time_limit_v4(
    input_simulation_id uuid
)
RETURNS TABLE (
    simulation_id uuid,
    title text,
    description text,
    active boolean,
    practice_simulation boolean,
    time_limit integer,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id as simulation_id,
        title,
        description,
        active,
        practice_simulation,
        time_limit,
        created_at,
        updated_at
    FROM simulations
    WHERE id = test_get_simulation_by_id_with_time_limit_v4.input_simulation_id;
$$;

COMMIT;

