-- Get run_pricing entries by IDs from run_pricing_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_run_pricing_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_run_pricing_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_run_pricing_entries_v4(
    ids uuid[]
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(
        jsonb_build_object(
            'pricing_type', m.pricing_type,
            'count', m.count,
            'created_at', m.created_at,
            'updated_at', m.updated_at,
            'run_id', m.run_id,
            'generated', m.generated,
            'mcp', m.mcp,
            'active', m.active,
            'id', m.id
        )
    ) AS items
    FROM run_pricing_mv m
    WHERE m.id = ANY(ids);
END;
$$;
