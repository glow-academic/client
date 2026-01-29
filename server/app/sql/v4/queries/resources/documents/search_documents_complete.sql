-- Search documents resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), user_department_ids (uuid[]), group_id (uuid), exclude_ids (uuid[])
-- Returns: items (array of document resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_documents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_documents_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_documents_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    group_id uuid DEFAULT NULL,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_documents_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.document_id, q.name, q.description, q.file_path, q.mime_type, q.generated)::types.q_get_documents_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_documents_v4_item[]
) as items
FROM (
    SELECT
        d.id AS document_id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = da.id LIMIT 1) AS name,
        COALESCE((SELECT descr.description FROM document_descriptions_junction dd JOIN descriptions_resource descr ON dd.description_id = descr.id WHERE dd.document_id = da.id LIMIT 1), '') AS description,
        COALESCE(u.file_path, '') AS file_path,
        COALESCE(u.mime_type, '') AS mime_type,
        COALESCE(d.generated, false) AS generated
    FROM documents_resource d
    -- Join to document artifact to check active flag
    JOIN document_documents_junction ddj ON ddj.documents_id = d.id
    JOIN document_artifact da ON da.id = ddj.document_id
    LEFT JOIN document_flags_junction df ON df.document_id = da.id
    LEFT JOIN flags_resource f ON f.id = df.flag_id AND f.name = 'document_active'
    -- Join to upload for file info
    LEFT JOIN document_uploads_resource dur ON dur.document_id = d.id AND dur.active = true
    LEFT JOIN uploads_resource ur ON ur.id = dur.uploads_id
    LEFT JOIN uploads_uploads_connection uuc ON uuc.uploads_id = ur.id
    LEFT JOIN view_uploads_entry u ON u.id = uuc.upload_id
    -- Join to departments for filtering
    LEFT JOIN document_departments_junction ddep ON ddep.document_id = da.id AND ddep.active = true
    WHERE
        -- Must be active
        COALESCE(df.value, false) = true
        -- Department access: user can see if document has matching department OR has no departments
        AND (
            COALESCE(array_length(user_department_ids, 1), 0) = 0
            OR ddep.department_id = ANY(user_department_ids)
            OR NOT EXISTS (SELECT 1 FROM document_departments_junction dd2 WHERE dd2.document_id = da.id AND dd2.active = true)
        )
        -- Exclude already selected
        AND (exclude_ids IS NULL OR NOT (d.id = ANY(exclude_ids)))
        -- Optional search filter
        AND (search IS NULL OR search = '' OR LOWER((SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = da.id LIMIT 1)) LIKE '%' || LOWER(search) || '%')
    GROUP BY d.id, d.generated, u.file_path, u.mime_type, da.id
    ORDER BY (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = da.id LIMIT 1)
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
