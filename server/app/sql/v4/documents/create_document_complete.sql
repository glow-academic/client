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
    html_id uuid DEFAULT NULL,
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
        html_id AS html_id,
        schema_id AS schema_id,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
new_document_id AS (
    SELECT gen_random_uuid() as document_id
),
-- Insert name INTO names_resource table and get ID
name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    FROM params
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description INTO descriptions_resource table and get ID
description_resource AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
insert_doc AS (
    -- Create document (without name/description/active/template/document_domain_id columns)
    INSERT INTO document_artifact (
        id, 
        created_at, 
        updated_at
    )
    SELECT 
        ndi.document_id,
        NOW(), 
        NOW()
    FROM params p
    CROSS JOIN new_document_id ndi
    RETURNING id
),
-- Domain-based agent assignment removed - no longer needed
link_document_agent_domain AS (
    -- Placeholder CTE (removed domain logic)
    SELECT NULL::uuid as dummy FROM insert_doc LIMIT 0
),
-- Link document to description
link_document_description AS (
    INSERT INTO document_descriptions (document_id, description_id, created_at, updated_at)
    SELECT 
        id.id,
        dr.description_id,
        NOW(),
        NOW()
    FROM insert_doc id
    CROSS JOIN description_resource dr
    ON CONFLICT (document_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link document active flag
link_document_active_flag AS (
    INSERT INTO document_flags (document_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        id.id,
        f.id,
        'active'::type_document_flags,
        true,
        NOW(),
        NOW()
    FROM insert_doc id
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
    ON CONFLICT (document_id, flag_id, type) DO UPDATE SET 
        value = true,
        updated_at = NOW()
),
-- Link document template flag (defaults to false)
link_document_template_flag AS (
    INSERT INTO document_flags (document_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        id.id,
        f.id,
        'template'::type_document_flags,
        false,
        NOW(),
        NOW()
    FROM insert_doc id
    CROSS JOIN flags_resource f
    WHERE f.name = 'template'
    ON CONFLICT (document_id, flag_id, type) DO UPDATE SET 
        value = false,
        updated_at = NOW()
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
create_template AS (
    -- Create template (just values, no schema/HTML refs) if html_id and schema_id are provided
    INSERT INTO templates_resource (name, created_at, updated_at)
    SELECT 
        (SELECT n.name FROM names_resource n JOIN name_resource nr ON n.id = nr.name_id LIMIT 1) as name,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN new_document_id ndi
    WHERE p.html_id IS NOT NULL AND p.schema_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM document_templates dt
          JOIN document_html dh ON dh.document_id = dt.document_id AND dh.html_id = p.html_id AND dh.active = true
          JOIN document_schemas ds ON ds.document_id = dt.document_id AND ds.schema_id = p.schema_id AND ds.active = true
          WHERE dt.active = true
      )
    RETURNING id as template_id
),
get_existing_template AS (
    -- Get existing template if it exists (matching html_id and schema_id via document_html and document_schemas)
    SELECT DISTINCT dt.template_id
    FROM params p
    JOIN document_templates dt ON dt.active = true
    JOIN document_html dh ON dh.document_id = dt.document_id AND dh.html_id = p.html_id AND dh.active = true
    JOIN document_schemas ds ON ds.document_id = dt.document_id AND ds.schema_id = p.schema_id AND ds.active = true
    WHERE p.html_id IS NOT NULL AND p.schema_id IS NOT NULL
    LIMIT 1
),
template_id AS (
    SELECT template_id FROM create_template
    UNION ALL
    SELECT template_id FROM get_existing_template
    WHERE EXISTS (SELECT 1 FROM params WHERE html_id IS NOT NULL AND schema_id IS NOT NULL)
    LIMIT 1
),
link_template_schema AS (
    -- Link template to schema via schema_templates junction table
    INSERT INTO schema_templates (schema_id, template_id, created_at, updated_at)
    SELECT 
        p.schema_id,
        ti.template_id,
        NOW(),
        NOW()
    FROM template_id ti
    CROSS JOIN params p
    WHERE p.schema_id IS NOT NULL
    ON CONFLICT (schema_id, template_id) DO UPDATE SET
        updated_at = NOW()
),
insert_template_link AS (
    -- Link template to document (without html_id and schema_id)
    INSERT INTO document_templates (document_id, template_id, active, created_at, updated_at)
    SELECT 
        ndi.document_id,
        ti.template_id,
        true,
        NOW(),
        NOW()
    FROM template_id ti
    CROSS JOIN new_document_id ndi
    CROSS JOIN params p
    WHERE p.html_id IS NOT NULL AND p.schema_id IS NOT NULL
    ON CONFLICT (document_id, template_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
insert_html_link AS (
    -- Link HTML to document via document_html junction
    INSERT INTO document_html (document_id, html_id, active, created_at, updated_at)
    SELECT 
        ndi.document_id,
        p.html_id,
        true,
        NOW(),
        NOW()
    FROM new_document_id ndi
    CROSS JOIN params p
    WHERE p.html_id IS NOT NULL
    ON CONFLICT (document_id, html_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
insert_schema_link AS (
    -- Link schema to document via document_schemas junction
    INSERT INTO document_schemas (document_id, schema_id, active, created_at, updated_at)
    SELECT 
        ndi.document_id,
        p.schema_id,
        true,
        NOW(),
        NOW()
    FROM new_document_id ndi
    CROSS JOIN params p
    WHERE p.schema_id IS NOT NULL
    ON CONFLICT (document_id, schema_id) DO UPDATE SET
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