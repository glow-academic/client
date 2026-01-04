-- Create an agent department prompt link for test setup
-- Returns link data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_agent_department_prompt_link_v4(uuid, uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_agent_department_prompt_link_v4(
    agent_id uuid,
    department_id uuid,
    prompt_id uuid
)
RETURNS TABLE (
    agent_id uuid,
    department_id uuid,
    prompt_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO agent_department_prompts(agent_id, department_id, prompt_id, active)
    VALUES (
        test_create_agent_department_prompt_link_v4.agent_id,
        test_create_agent_department_prompt_link_v4.department_id,
        test_create_agent_department_prompt_link_v4.prompt_id,
        true
    )
    RETURNING agent_id, department_id, prompt_id, active, created_at;
$$;