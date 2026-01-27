-- Create a test prompt for test setup
-- Returns prompt_id for use in view_tests_entry
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_prompt_v4(text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_prompt_v4(
    system_prompt text DEFAULT 'Test prompt'
)
RETURNS TABLE (
    prompt_id uuid,
    system_prompt text,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO prompts_resource(system_prompt)
    VALUES (test_create_test_prompt_v4.system_prompt)
    RETURNING id, system_prompt, created_at;
$$;