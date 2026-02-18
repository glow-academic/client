-- Get args_outputs_values entries by IDs from args_outputs_values_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_args_outputs_values_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_args_outputs_values_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_args_outputs_values_entries_v4(
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
            'id', m.id,
            'call_id', m.call_id,
            'string_value', m.string_value,
            'number_value', m.number_value,
            'boolean_value', m.boolean_value,
            'created_at', m.created_at,
            'updated_at', m.updated_at
        )
    ) AS items
    FROM args_outputs_values_mv m
    WHERE m.id = ANY(ids);
END;
$$;
