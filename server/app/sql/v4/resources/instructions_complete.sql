-- Create instructions resource
-- Always INSERT operation (preserves all information)
-- Parameters: template text
-- Returns: instruction_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_instructions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_instructions_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_instructions_v4(
    template text
)
RETURNS TABLE (
    instruction_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_instruction_id uuid;
BEGIN
    -- INSERT into instructions table (always insert, never update)
    INSERT INTO instructions(template, active)
    VALUES (template, true)
    RETURNING id INTO v_instruction_id;

    RETURN QUERY SELECT v_instruction_id;
END;
$$;