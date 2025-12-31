-- Get agent prompt link for test verification
-- Returns prompt link data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_agent_prompt_link_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_agent_prompt_link_v4(
    agent_id uuid
)
RETURNS TABLE (
    agent_id uuid,
    prompt_id uuid,
    active boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        agent_id,
        prompt_id,
        active
    FROM agent_prompts
    WHERE agent_id = test_get_agent_prompt_link_v4.agent_id
      AND active = true;
$$;

COMMIT;

