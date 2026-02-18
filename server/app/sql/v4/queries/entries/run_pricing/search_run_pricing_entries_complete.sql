-- Search run_pricing entries from run_pricing_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_run_pricing_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_run_pricing_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_run_pricing_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    run_id uuid DEFAULT NULL,
    unit_id uuid DEFAULT NULL
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(row_data) AS items
    FROM (
        SELECT jsonb_build_object(
            'pricing_type', m.pricing_type,
            'count', m.count,
            'created_at', m.created_at,
            'updated_at', m.updated_at,
            'run_id', m.run_id,
            'unit_id', m.unit_id,
            'generated', m.generated,
            'mcp', m.mcp,
            'active', m.active,
            'id', m.id
        ) AS row_data
        FROM run_pricing_mv m
        WHERE true
          AND (run_id IS NULL OR m.run_id = run_id)
          AND (unit_id IS NULL OR m.unit_id = unit_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
