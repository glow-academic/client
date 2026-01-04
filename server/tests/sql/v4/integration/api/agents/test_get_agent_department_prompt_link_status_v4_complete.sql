-- Get agent department prompt link status for test verification
-- Returns active status
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_agent_department_prompt_link_status_v4(uuid, uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_agent_department_prompt_link_status_v4(
    input_agent_id uuid,
    input_department_id uuid,
    input_prompt_id uuid
)
RETURNS TABLE (
    active boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT active
    FROM agent_department_prompts
    WHERE agent_id = input_agent_id
      AND department_id = input_department_id
      AND prompt_id = input_prompt_id;
$$;