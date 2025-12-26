-- Get template upload file path and document template args for rendering
-- Converted to function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Keeps JSONB for template_args (schema structure)

BEGIN;

-- 1) Drop function first
DROP FUNCTION IF EXISTS api_render_template_v3(uuid, uuid) CASCADE;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_render_template_v3(
    document_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    document_name text,
    actor_name text,
    file_path text,
    template_args jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT document_id AS document_id,
           profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        p.id as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
)
SELECT 
    d.name::text as document_name,
    ap.actor_name::text as actor_name,
    u.file_path::text as file_path,
    t.args::jsonb as template_args
FROM params x
JOIN documents d ON d.id = x.document_id
INNER JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
INNER JOIN templates t ON t.id = dt.template_id
INNER JOIN uploads u ON u.id = t.upload_id
CROSS JOIN actor_profile ap
ORDER BY dt.created_at DESC
LIMIT 1
$$;

COMMIT;
