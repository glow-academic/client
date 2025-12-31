-- Get agent by ID for test verification
-- Returns agent data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_agent_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_agent_by_id_v4(
    input_agent_id uuid
)
RETURNS TABLE (
    agent_id uuid,
    name text,
    description text,
    model_id uuid,
    active boolean,
    role text,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id as agent_id,
        name,
        description,
        model_id,
        active,
        role::text,
        created_at,
        updated_at
    FROM agents
    WHERE id = test_get_agent_by_id_v4.input_agent_id;
$$;

COMMIT;

