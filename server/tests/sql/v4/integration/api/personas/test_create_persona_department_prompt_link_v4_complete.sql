-- Create a persona department prompt link for test setup
-- Returns link data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_persona_department_prompt_link_v4(uuid, uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_persona_department_prompt_link_v4(
    persona_id uuid,
    department_id uuid,
    prompt_id uuid
)
RETURNS TABLE (
    persona_id uuid,
    department_id uuid,
    prompt_id uuid,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    -- NOTE: persona_department_prompts table does not exist in current schema
    -- Personas don't have direct prompt links in the current schema
    -- This function returns empty result - tests using this may need updating
    SELECT NULL::uuid AS persona_id, NULL::uuid AS department_id, NULL::uuid AS prompt_id, NULL::boolean AS active, NULL::timestamptz AS created_at, NULL::timestamptz AS updated_at WHERE false;
$$;

COMMIT;

