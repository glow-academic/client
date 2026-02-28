-- Create tokens entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_tokens_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_tokens_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_tokens_entry_v4(
    session_id uuid,
    run_id uuid,
    input_tokens integer DEFAULT 0,
    output_tokens integer DEFAULT 0,
    cached_input_tokens integer DEFAULT 0,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid)
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
    INSERT INTO tokens_entry (session_id, run_id, input_tokens, output_tokens, cached_input_tokens, mcp, generated)
    VALUES (api_create_tokens_entry_v4.session_id, api_create_tokens_entry_v4.run_id, api_create_tokens_entry_v4.input_tokens, api_create_tokens_entry_v4.output_tokens, api_create_tokens_entry_v4.cached_input_tokens, api_create_tokens_entry_v4.mcp, true)
    RETURNING tokens_entry.id INTO v_id;
    RETURN QUERY SELECT v_id;
END; $$;
