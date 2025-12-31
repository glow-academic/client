-- Get upload file info for download
-- Converted to function following agents pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

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
    template_args jsonb
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
    SELECT COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM profiles
    WHERE id = (SELECT profile_id FROM params)
),
regular_document_upload AS (
    -- Case 1: Upload is linked to a document via document_uploads
    -- Also get template_args if document has template=true
    SELECT 
        du.document_id,
        d.template,
        COALESCE(
            (SELECT t.args 
             FROM document_templates dt 
             JOIN templates t ON t.id = dt.template_id 
             WHERE dt.document_id = d.id AND dt.active = true 
             ORDER BY dt.created_at DESC 
             LIMIT 1),
            '{}'::jsonb
        ) as template_args
    FROM document_uploads du
    JOIN documents d ON d.id = du.document_id
    WHERE du.upload_id = (SELECT upload_id FROM params)
      AND du.active = true
    LIMIT 1
),
template_upload AS (
    -- Case 2: Upload is a template upload (via document_templates → templates)
    SELECT 
        dt.document_id,
        d.template,
        t.args as template_args
    FROM templates t
    JOIN document_templates dt ON dt.template_id = t.id AND dt.active = true
    JOIN documents d ON d.id = dt.document_id
    WHERE t.upload_id = (SELECT upload_id FROM params)
    ORDER BY dt.created_at DESC
    LIMIT 1
),
template_info AS (
    -- Return template info from either case (prefer regular document upload if both exist)
    SELECT 
        COALESCE(rdu.template, tu.template, false) as is_template,
        COALESCE(tu.template_args, rdu.template_args, '{}'::jsonb) as template_args
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
    COALESCE((SELECT template_args FROM template_info), '{}'::jsonb) as template_args;
$$;

COMMIT;

