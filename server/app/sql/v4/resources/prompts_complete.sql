-- Create prompts resource
-- Always INSERT operation (preserves all information)
-- Parameters: system_prompt text, name text, description text
-- Returns: prompt_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_prompts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_prompts_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_prompts_v4(
    system_prompt text, name text, description text
)
RETURNS TABLE (
    prompt_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_prompt_id uuid;
BEGIN
    -- INSERT into prompts table (always insert, never update)
    INSERT INTO prompts(system_prompt, name, description, active)
    VALUES (system_prompt, name, description, true)
    RETURNING id INTO v_prompt_id;

    RETURN QUERY SELECT v_prompt_id;
END;
$$;