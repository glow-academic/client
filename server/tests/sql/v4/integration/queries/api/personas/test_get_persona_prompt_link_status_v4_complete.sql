-- Get persona prompt link status for test verification
-- Returns whether an active link exists
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_persona_prompt_link_status_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_persona_prompt_link_status_v4(
    input_persona_id uuid,
    input_prompt_id uuid
)
RETURNS TABLE (
    link_exists boolean
)
LANGUAGE sql
STABLE
AS $$
    -- NOTE: persona_prompts table does not exist in current schema
    -- Personas don't have direct prompt links in the current schema
    -- This function returns false - view_tests_entry using this may need updating
    SELECT false AS link_exists;
$$;