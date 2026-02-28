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
    external_call_id text,
    run_id uuid,
    arguments_raw text
)
RETURNS TABLE (
    call_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_call AS (
        INSERT INTO calls_entry (
            external_call_id,
            run_id,
            created_at
        )
        VALUES (
            $1,
            $2,
            NOW()
        )
        RETURNING id
    ),
    insert_completion AS (
        INSERT INTO calls_completion_entry (call_id, arguments_raw)
        SELECT new_call.id, $3
        FROM new_call
    )
    SELECT new_call.id as call_id
    FROM new_call;
$$;
