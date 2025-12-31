-- Create an agent prompt link for test setup
-- Returns link data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_agent_prompt_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_agent_prompt_link_v4(
    agent_id uuid,
    prompt_id uuid
)
RETURNS TABLE (
    agent_id uuid,
    prompt_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO agent_prompts(agent_id, prompt_id, active)
    VALUES (
        test_create_agent_prompt_link_v4.agent_id,
        test_create_agent_prompt_link_v4.prompt_id,
        true
    )
    RETURNING agent_id, prompt_id, active, created_at;
$$;

COMMIT;

