-- Create run_pricing entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_run_pricing_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_run_pricing_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_run_pricing_entry_v4(
    session_id uuid,
    pricing_type pricing_type,
    run_id uuid,
    count integer DEFAULT 0,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid)
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
    INSERT INTO run_pricing_entry (session_id, pricing_type, count, run_id, mcp, generated)
    VALUES (api_create_run_pricing_entry_v4.session_id, api_create_run_pricing_entry_v4.pricing_type, api_create_run_pricing_entry_v4.count, api_create_run_pricing_entry_v4.run_id, api_create_run_pricing_entry_v4.mcp, true)
    RETURNING run_pricing_entry.id INTO v_id;
    RETURN QUERY SELECT v_id;
END; $$;
