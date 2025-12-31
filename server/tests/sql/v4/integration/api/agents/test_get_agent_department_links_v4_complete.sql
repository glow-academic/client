-- Get all agent department links for test verification
-- Returns all department links for an agent

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_agent_department_links_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_agent_department_links_v4(
    agent_id uuid
)
RETURNS TABLE (
    agent_id uuid,
    department_id uuid,
    active boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        agent_id,
        department_id,
        active
    FROM agent_departments
    WHERE agent_id = test_get_agent_department_links_v4.agent_id;
$$;

COMMIT;

