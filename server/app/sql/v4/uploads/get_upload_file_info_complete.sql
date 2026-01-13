-- Get upload file info for download
-- Converted to function following agents pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_upload_file_info_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_upload_file_info_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function that returns upload file info with existence check
CREATE OR REPLACE FUNCTION api_get_upload_file_info_v4(
    upload_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    upload_exists boolean,
    upload_id uuid,
    file_path text,
    mime_type text,
    size bigint,
    actor_name text,
    is_template boolean,
    schema_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT upload_id AS upload_id, profile_id AS profile_id
),
upload_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM uploads WHERE id = (SELECT upload_id FROM params)
    )::boolean as upload_exists
),
upload_info AS (
    SELECT 
        u.id,
        u.file_path,
        u.mime_type,
        u.size
    FROM uploads u
    WHERE u.id = (SELECT upload_id FROM params)
),
actor_profile AS (
    SELECT COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = profile.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = profile.id AND pn2.type = 'last' LIMIT 1), 'System') as actor_name
    FROM profile
    WHERE id = (SELECT profile_id FROM params)
),
regular_document_upload AS (
    -- Case 1: Upload is linked to a document via document_uploads
    -- Also get schema_id if document has template=true
    SELECT 
        du.document_id,
        EXISTS (SELECT 1 FROM document_flags df WHERE df.document_id = d.id AND df.type = 'template'::type_document_flags AND df.value = TRUE) as template,
        (SELECT ds.schema_id 
         FROM document_schemas ds 
         WHERE ds.document_id = d.id AND ds.active = true 
         ORDER BY ds.created_at DESC 
         LIMIT 1) as schema_id
    FROM document_uploads du
    JOIN documents d ON d.id = du.document_id
    WHERE du.upload_id = (SELECT upload_id FROM params)
      AND du.active = true
    LIMIT 1
),
template_upload AS (
    -- Case 2: Upload is a template upload (via document_html → html → html_uploads)
    SELECT 
        dh.document_id,
        EXISTS (SELECT 1 FROM document_flags df WHERE df.document_id = d.id AND df.type = 'template'::type_document_flags AND df.value = TRUE) as template,
        ds.schema_id
    FROM html_uploads hu
    JOIN html h ON h.id = hu.html_id
    JOIN document_html dh ON dh.html_id = h.id AND dh.active = true
    JOIN documents d ON d.id = dh.document_id
    LEFT JOIN document_schemas ds ON ds.document_id = dh.document_id AND ds.active = true
    WHERE hu.upload_id = (SELECT upload_id FROM params)
      AND hu.active = true
    ORDER BY dh.created_at DESC
    LIMIT 1
),
template_info AS (
    -- Return template info from either case (prefer regular document upload if both exist)
    SELECT 
        COALESCE(rdu.template, tu.template, false) as is_template,
        COALESCE(tu.schema_id, rdu.schema_id) as schema_id
    FROM regular_document_upload rdu
    FULL OUTER JOIN template_upload tu ON true
    WHERE rdu.document_id IS NOT NULL OR tu.document_id IS NOT NULL
    LIMIT 1
)
SELECT 
    COALESCE((SELECT upload_exists FROM upload_exists_check), false)::boolean as upload_exists,
    COALESCE((SELECT id FROM upload_info), (SELECT upload_id FROM params))::uuid as upload_id,
    COALESCE((SELECT file_path FROM upload_info), '')::text as file_path,
    COALESCE((SELECT mime_type FROM upload_info), '')::text as mime_type,
    COALESCE((SELECT size FROM upload_info), 0)::bigint as size,
    COALESCE((SELECT actor_name FROM actor_profile), 'System')::text as actor_name,
    COALESCE((SELECT is_template FROM template_info), false)::boolean as is_template,
    (SELECT schema_id FROM template_info)::uuid as schema_id;
$$;