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
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT upload_id AS upload_id, profile_id AS profile_id
),
upload_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM uploads_entry WHERE id = (SELECT upload_id FROM params)
    )::boolean as upload_exists
),
upload_info AS (
    SELECT
        u.id,
        u.file_path,
        u.mime_type,
        u.size
    FROM uploads_entry u
    WHERE u.id = (SELECT upload_id FROM params)
),
actor_profile AS (
    SELECT COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.profile_id = profile_artifact.id LIMIT 1), 'System') as actor_name
    FROM profile_artifact
    WHERE id = (SELECT profile_id FROM params)
)
SELECT 
    COALESCE((SELECT upload_exists FROM upload_exists_check), false)::boolean as upload_exists,
    COALESCE((SELECT id FROM upload_info), (SELECT upload_id FROM params))::uuid as upload_id,
    COALESCE((SELECT file_path FROM upload_info), '')::text as file_path,
    COALESCE((SELECT mime_type FROM upload_info), '')::text as mime_type,
    COALESCE((SELECT size FROM upload_info), 0)::bigint as size,
    COALESCE((SELECT actor_name FROM actor_profile), 'System')::text as actor_name;
$$;