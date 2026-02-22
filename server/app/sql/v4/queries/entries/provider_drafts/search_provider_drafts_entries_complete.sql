-- Search provider_drafts entries from provider_drafts_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_provider_drafts_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_provider_drafts_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_provider_drafts_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    group_id uuid DEFAULT NULL
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
#variable_conflict use_variable
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(row_data) AS items
    FROM (
        SELECT jsonb_build_object(
            'draft_id', m.draft_id,
            'created_at', m.created_at,
            'updated_at', m.updated_at,
            'version', m.version,
            'generated', m.generated,
            'mcp', m.mcp,
            'active', m.active,
            'group_id', m.group_id,
            'department_ids', m.department_ids,
            'description_ids', m.description_ids,
            'endpoint_ids', m.endpoint_ids,
            'flag_ids', m.flag_ids,
            'key_ids', m.key_ids,
            'name_ids', m.name_ids,
            'provider_ids', m.provider_ids,
            'value_ids', m.value_ids
        ) AS row_data
        FROM provider_drafts_mv m
        WHERE true
          AND (group_id IS NULL OR m.group_id = group_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
