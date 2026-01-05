-- Create document with department, field, and upload links in single transaction
-- Converted to function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_document_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_document_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_create_document_v4(
    name text,
    profile_id uuid,
    description text DEFAULT '',
    upload_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    parameter_item_ids uuid[] DEFAULT ARRAY[]::uuid[],
    template_upload_id uuid DEFAULT NULL,
    schema_id uuid DEFAULT NULL
)
RETURNS TABLE (
    success boolean,
    message text,
    document_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        name AS name,
        COALESCE(NULLIF(description, ''), '') AS description,
        upload_id AS upload_id,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(parameter_item_ids, ARRAY[]::uuid[]) AS field_ids,
        template_upload_id AS template_upload_id,
        schema_id AS schema_id,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
new_document_id AS (
    SELECT gen_random_uuid() as document_id
),
insert_doc AS (
    INSERT INTO documents (
        id, 
        name,
        description,
        active,
        template,
        created_at, 
        updated_at,
        classify_agent_id,
        document_agent_id
    )
    SELECT 
        ndi.document_id,
        p.name,
        p.description,
        true,
        false,  -- template defaults to false - must be explicitly enabled via update
        NOW(), 
        NOW(),
        (SELECT id FROM agents WHERE role = 'classify' AND active = true LIMIT 1),
        (SELECT id FROM agents WHERE role = 'document' AND active = true LIMIT 1)
    FROM params p
    CROSS JOIN new_document_id ndi
    RETURNING id
),
insert_upload AS (
    -- Link regular upload if provided
    INSERT INTO document_uploads (document_id, upload_id, active, created_at, updated_at)
    SELECT ndi.document_id, p.upload_id, true, NOW(), NOW()
    FROM params p
    CROSS JOIN new_document_id ndi
    WHERE p.upload_id IS NOT NULL
    ON CONFLICT (document_id, upload_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
create_or_get_template AS (
    -- Create or get template if template_upload_id is provided
    INSERT INTO templates (name, upload_id, args, created_at, updated_at)
    SELECT 
        p.name as name,
        p.template_upload_id,
        '{}'::jsonb,  -- Empty args, schema stored separately
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN new_document_id ndi
    WHERE p.template_upload_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM templates t 
          JOIN template_schemas ts ON ts.template_id = t.id
          WHERE t.upload_id = p.template_upload_id 
            AND (p.schema_id IS NULL OR ts.schema_id = p.schema_id)
      )
    RETURNING id as template_id
),
get_existing_template AS (
    -- Get existing template if it exists (matching upload_id and schema_id)
    SELECT t.id as template_id
    FROM params p
    CROSS JOIN templates t
    LEFT JOIN template_schemas ts ON ts.template_id = t.id
    WHERE t.upload_id = p.template_upload_id 
      AND (p.schema_id IS NULL OR ts.schema_id = p.schema_id)
    LIMIT 1
),
template_id AS (
    SELECT template_id FROM create_or_get_template
    UNION ALL
    SELECT template_id FROM get_existing_template
    WHERE EXISTS (SELECT 1 FROM params WHERE template_upload_id IS NOT NULL)
    LIMIT 1
),
link_template_schema AS (
    -- Link template to schema via template_schemas junction table
    INSERT INTO template_schemas (template_id, schema_id, created_at, updated_at)
    SELECT 
        ti.template_id,
        p.schema_id,
        NOW(),
        NOW()
    FROM template_id ti
    CROSS JOIN params p
    WHERE p.schema_id IS NOT NULL
    ON CONFLICT (template_id, schema_id) DO UPDATE SET
        updated_at = NOW()
),
insert_template_link AS (
    -- Link template to document if template_id is available
    INSERT INTO document_templates (document_id, template_id, active, created_at, updated_at)
    SELECT 
        ndi.document_id,
        ti.template_id,
        true,
        NOW(),
        NOW()
    FROM template_id ti
    CROSS JOIN new_document_id ndi
    WHERE EXISTS (SELECT 1 FROM params WHERE template_upload_id IS NOT NULL)
    ON CONFLICT (document_id, template_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
insert_depts AS (
    INSERT INTO document_departments (document_id, department_id, active, created_at, updated_at)
    SELECT ndi.document_id, dept_id, true, NOW(), NOW()
    FROM params p
    CROSS JOIN new_document_id ndi
    CROSS JOIN unnest(p.department_ids) as dept_id
    WHERE cardinality(p.department_ids) > 0
    RETURNING document_id
),
insert_fields AS (
    INSERT INTO document_fields (document_id, field_id, active, created_at, updated_at)
    SELECT ndi.document_id, field_id, true, NOW(), NOW()
    FROM params p
    CROSS JOIN new_document_id ndi
    CROSS JOIN unnest(p.field_ids) as field_id
    WHERE cardinality(p.field_ids) > 0
    RETURNING document_id
)
SELECT 
    true::boolean as success,
    'Document created successfully'::text as message,
    ndi.document_id,
    up.actor_name
FROM new_document_id ndi
CROSS JOIN user_profile up
LIMIT 1
$$;