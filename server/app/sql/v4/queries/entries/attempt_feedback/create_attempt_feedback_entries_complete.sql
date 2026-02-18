-- Create attempt_feedback entry via generic api_create_entry_record_v4

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_attempt_feedback_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_attempt_feedback_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_attempt_feedback_entry_v4(
    call_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false,
    entry_data jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(
    id uuid,
    already_exists boolean
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM api_create_entry_record_v4(
        entry_type := 'attempt_feedback',
        call_id := call_id,
        mcp := mcp,
        entry_data := entry_data
    );
END;
$$;
