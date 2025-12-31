-- Get persona prompt link status for test verification
-- Returns whether an active link exists

BEGIN;

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
    SELECT EXISTS(
        SELECT 1
        FROM persona_prompts
        WHERE persona_id = input_persona_id
          AND prompt_id = input_prompt_id
          AND active = true
    ) AS link_exists;
$$;

COMMIT;

