-- Get document_drafts entries by IDs from document_drafts_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_document_drafts_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_document_drafts_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_document_drafts_entries_v4(
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
            'document_ids', m.document_ids,
            'flag_ids', m.flag_ids,
            'image_ids', m.image_ids,
            'name_ids', m.name_ids,
            'parameter_field_ids', m.parameter_field_ids,
            'parameter_ids', m.parameter_ids,
            'text_ids', m.text_ids,
            'upload_ids', m.upload_ids
        )
    ) AS items
    FROM document_drafts_mv m
    WHERE m.draft_id = ANY(ids);
END;
$$;
