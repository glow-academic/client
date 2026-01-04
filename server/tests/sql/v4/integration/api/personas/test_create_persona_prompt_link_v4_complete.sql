-- Create persona-prompt link for test setup
-- Returns link data for verification

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_persona_prompt_link_v4(uuid, uuid);

-- Create function
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
    INSERT INTO persona_prompts(persona_id, prompt_id, active, created_at, updated_at)
    VALUES (
        test_create_persona_prompt_link_v4.input_persona_id,
        test_create_persona_prompt_link_v4.input_prompt_id,
        true,
        NOW(),
        NOW()
    )
    RETURNING persona_id, prompt_id, active, created_at, updated_at;
$$;

COMMIT;
