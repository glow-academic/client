-- Search profile_drafts entries from profile_drafts_entry

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_profile_drafts_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_profile_drafts_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_profile_drafts_entries_v4(
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
            'cohort_ids', m.cohort_ids,
            'department_ids', m.department_ids,
            'email_ids', m.email_ids,
            'flag_ids', m.flag_ids,
            'name_ids', m.name_ids,
            'profile_ids', m.profile_ids,
            'request_limit_ids', m.request_limit_ids,
            'role_ids', m.role_ids,
            'route_ids', m.route_ids
        ) AS row_data
        FROM profile_drafts_entry m
        WHERE true
          AND m.active = true
          AND (group_id IS NULL OR m.group_id = group_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
