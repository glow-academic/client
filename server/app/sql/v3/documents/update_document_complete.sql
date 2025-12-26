-- Update document with department links and field links in a single transaction
-- Converted to function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- 1) Drop function first (drop all overloads)
DROP FUNCTION IF EXISTS api_update_document_v3(uuid, uuid, text, text, boolean, boolean, uuid, text[], uuid, uuid, uuid, jsonb) CASCADE;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_update_document_v3(
    document_id uuid,
    profile_id uuid,
    name text DEFAULT NULL,
    description text DEFAULT NULL,
    active boolean DEFAULT NULL,
    template boolean DEFAULT NULL,
    department_id uuid DEFAULT NULL,
    field_ids text[] DEFAULT ARRAY[]::text[],
    classify_agent_id uuid DEFAULT NULL,
    document_agent_id uuid DEFAULT NULL,
    template_upload_id uuid DEFAULT NULL,
    template_args jsonb DEFAULT NULL
)
RETURNS TABLE (
    success boolean,
    message text,
    document_id uuid,
    document_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        document_id AS document_id,
        profile_id AS profile_id,
        name AS name,
        description AS description,
        active AS active,
        template AS template,
        department_id AS department_id,
        COALESCE(field_ids, ARRAY[]::text[]) AS field_ids,
        classify_agent_id AS classify_agent_id,
        document_agent_id AS document_agent_id,
        template_upload_id AS template_upload_id,
        COALESCE(template_args, '{}'::jsonb) AS template_args
),
actor_profile AS (
    SELECT 
        p.id as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
update_document AS (
    UPDATE documents d
    SET 
        name = COALESCE((SELECT name FROM params), d.name),
        description = COALESCE((SELECT description FROM params), d.description),
        active = COALESCE((SELECT active FROM params), d.active),
        template = COALESCE((SELECT template FROM params), d.template),
        classify_agent_id = COALESCE((SELECT classify_agent_id FROM params), d.classify_agent_id),
        document_agent_id = COALESCE((SELECT document_agent_id FROM params), d.document_agent_id),
        updated_at = NOW()
    FROM params p
    WHERE d.id = p.document_id
    RETURNING d.id
),
create_or_get_template AS (
    -- Create or get template if template_upload_id is provided
    INSERT INTO templates (name, upload_id, args, created_at, updated_at)
    SELECT 
        COALESCE((SELECT name FROM documents WHERE id = (SELECT document_id FROM params)), 'Template'),
        p.template_upload_id,
        p.template_args,
        NOW(),
        NOW()
    FROM params p
    WHERE p.template_upload_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM templates t 
          WHERE t.upload_id = p.template_upload_id AND t.args = p.template_args
      )
    RETURNING id as template_id
),
get_existing_template AS (
    -- Get existing template if it exists
    SELECT id as template_id
    FROM params p
    CROSS JOIN templates t
    WHERE t.upload_id = p.template_upload_id 
      AND t.args = p.template_args
    LIMIT 1
),
template_id AS (
    SELECT template_id FROM create_or_get_template
    UNION ALL
    SELECT template_id FROM get_existing_template
    WHERE EXISTS (SELECT 1 FROM params WHERE template_upload_id IS NOT NULL)
    LIMIT 1
),
deactivate_previous_templates AS (
    -- Deactivate all previous templates if new one is provided
    UPDATE document_templates
    SET active = false, updated_at = NOW()
    WHERE document_id = (SELECT document_id FROM params)
      AND active = true
      AND (SELECT template_upload_id FROM params) IS NOT NULL
),
update_template_link AS (
    -- Update or insert template link if template_id is available
    INSERT INTO document_templates (document_id, template_id, active, created_at, updated_at)
    SELECT 
        p.document_id,
        ti.template_id,
        true,
        NOW(),
        NOW()
    FROM template_id ti
    CROSS JOIN params p
    WHERE p.template_upload_id IS NOT NULL
    ON CONFLICT (document_id, template_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_template_link AS (
    -- Delete template link if template_upload_id is NULL (removing template)
    DELETE FROM document_templates 
    WHERE document_id = (SELECT document_id FROM params)
    AND (SELECT template_upload_id FROM params) IS NULL
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM document_departments 
    WHERE document_id = (SELECT document_id FROM params)
),
link_department AS (
    -- Insert new department link if provided
    INSERT INTO document_departments (document_id, department_id, active, created_at, updated_at)
    SELECT p.document_id, p.department_id, true, NOW(), NOW()
    FROM params p
    WHERE p.department_id IS NOT NULL
    ON CONFLICT (document_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_fields AS (
    -- Delete all existing field links
    DELETE FROM document_fields 
    WHERE document_id = (SELECT document_id FROM params)
),
link_fields AS (
    -- Insert new field links if provided (array is never NULL, but may be empty)
    INSERT INTO document_fields (document_id, field_id, active, created_at, updated_at)
    SELECT 
        p.document_id,
        field_id::uuid,
        true,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN unnest(p.field_ids) as field_id
    WHERE COALESCE(array_length(p.field_ids, 1), 0) > 0
    ON CONFLICT (document_id, field_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
)
SELECT 
    true::boolean as success,
    'Document updated successfully'::text as message,
    ud.id as document_id,
    COALESCE((SELECT name FROM documents WHERE id = ud.id), 'Unknown')::text as document_name,
    ap.actor_name::text as actor_name
FROM update_document ud
CROSS JOIN actor_profile ap
LIMIT 1
$$;

COMMIT;
