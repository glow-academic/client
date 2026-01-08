-- Create problem_statements resource
-- Always INSERT operation (preserves all information)
-- Parameters: name text, problem_statement text
-- Returns: problem_statement_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_problem_statements_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_problem_statements_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_problem_statements_v4(
    name text, problem_statement text
)
RETURNS TABLE (
    problem_statement_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_problem_statement_id uuid;
BEGIN
    -- INSERT into problem_statements table (always insert, never update)
    INSERT INTO problem_statements(name, problem_statement, active)
    VALUES (name, problem_statement, true)
    RETURNING id INTO v_problem_statement_id;

    RETURN QUERY SELECT v_problem_statement_id;
END;
$$;