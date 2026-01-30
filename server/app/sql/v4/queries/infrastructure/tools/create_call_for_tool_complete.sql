-- Create calls_entry row for tool execution
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'infra_create_call_for_tool_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infra_create_call_for_tool_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create function
CREATE OR REPLACE FUNCTION infra_create_call_for_tool_v4(
    p_external_call_id text,
    p_run_id uuid,
    p_template_id uuid,
    p_arguments_raw text
)
RETURNS TABLE (
    call_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO calls_entry (
        external_call_id,
        run_id,
        template_id,
        arguments_raw,
        completed,
        created_at,
        updated_at
    )
    VALUES (
        p_external_call_id,
        p_run_id,
        p_template_id,
        p_arguments_raw,
        true,
        NOW(),
        NOW()
    )
    RETURNING id as call_id;
$$;
