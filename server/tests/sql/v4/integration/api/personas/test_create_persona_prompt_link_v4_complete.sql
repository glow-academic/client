-- NOTE: This test is disabled - persona_prompts table does not exist
-- Personas link to prompts via agents (agent_prompts_junction table)
-- This test file is kept for reference but will be skipped during compilation
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_persona_prompt_link_v4(uuid, uuid);

-- Create function (disabled - table doesn't exist)
CREATE OR REPLACE FUNCTION test_create_persona_prompt_link_v4(
    input_persona_id uuid,
    input_prompt_id uuid
)
RETURNS TABLE (
    persona_id uuid,
    prompt_id uuid,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    -- Table persona_prompts does not exist - personas link to prompts via agents
    -- This function is disabled
    SELECT NULL::uuid, NULL::uuid, false, NOW(), NOW() WHERE false;
$$;