-- Insert document with department, parameter item, and upload links in single transaction
-- Converted to PostgreSQL function
-- Note: Uses JSONB for template_args - may need refactoring per STANDARDS.md
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_insert_document_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_insert_document_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_insert_document_v4(
    document_id uuid,
    name text,
    profile_id uuid,
    description text DEFAULT NULL,
    upload_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    field_ids uuid[] DEFAULT ARRAY[]::uuid[],
    html_id uuid DEFAULT NULL,
    schema_id uuid DEFAULT NULL
)
RETURNS TABLE (
    document_id text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH user_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM profile p
    WHERE p.id = profile_id
),
-- Insert name into names table and get ID
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description into descriptions table and get ID
description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT COALESCE(description, ''), NOW(), NOW()
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
insert_doc AS (
    -- Create document (without name/description/active/template columns)
    INSERT INTO document (
        id, 
        created_at, 
        updated_at
    )
    VALUES (
        document_id, 
        NOW(), 
        NOW()
    )
    RETURNING id as document_id
),
-- Link document to agent domain if default document agent exists
link_document_agent_domain AS (
    INSERT INTO document_agent_domains (document_id, agent_domain_id, created_at, updated_at)
    SELECT 
        id.document_id,
        dd.domain_id,
        NOW(),
        NOW()
    FROM insert_doc id
    CROSS JOIN (
        SELECT adom.domain_id
        FROM agent_domains adom
        JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = 'document'::artifacts
        JOIN agents a ON a.id = adom.agent_id
        WHERE EXISTS (
            SELECT 1 FROM agent_flags af 
            JOIN flags fl ON af.flag_id = fl.id 
            WHERE af.agent_id = a.id 
            AND fl.name = 'active' 
            AND af.type = 'active'::type_agent_flags 
            AND af.value = true
        )
        LIMIT 1
    ) dd
    ON CONFLICT (document_id, agent_domain_id) DO UPDATE SET updated_at = NOW()
),
-- Link document to name
link_document_name AS (
    INSERT INTO document_names (document_id, name_id, created_at, updated_at)
    SELECT 
        id.document_id,
        nr.name_id,
        NOW(),
        NOW()
    FROM insert_doc id
    CROSS JOIN name_resource nr
    ON CONFLICT (document_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link document to description
link_document_description AS (
    INSERT INTO document_descriptions (document_id, description_id, created_at, updated_at)
    SELECT 
        id.document_id,
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
        id.document_id,
        f.id,
        'active'::type_document_flags,
        true,
        NOW(),
        NOW()
    FROM insert_doc id
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (document_id, flag_id, type) DO UPDATE SET 
        value = true,
        updated_at = NOW()
),
-- Link document template flag (defaults to false)
link_document_template_flag AS (
    INSERT INTO document_flags (document_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        id.document_id,
        f.id,
        'template'::type_document_flags,
        false,
        NOW(),
        NOW()
    FROM insert_doc id
    CROSS JOIN flags f
    WHERE f.name = 'template'
    ON CONFLICT (document_id, flag_id, type) DO UPDATE SET 
        value = false,
        updated_at = NOW()
),
insert_upload AS (
    -- Link regular upload if provided
    INSERT INTO document_uploads (document_id, upload_id, active, created_at, updated_at)
    SELECT document_id, upload_id, true, NOW(), NOW()
    WHERE upload_id IS NOT NULL
    ON CONFLICT (document_id, upload_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
create_template AS (
    -- Create template (just values, no schema/HTML refs) if html_id and schema_id are provided
    INSERT INTO templates (name, created_at, updated_at)
    SELECT 
        name as name,
        NOW(),
        NOW()
    WHERE html_id IS NOT NULL AND schema_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM document_templates dt
          JOIN document_html dh ON dh.document_id = dt.document_id AND dh.html_id = html_id AND dh.active = true
          JOIN document_schemas ds ON ds.document_id = dt.document_id AND ds.schema_id = schema_id AND ds.active = true
          WHERE dt.active = true
      )
    RETURNING id as template_id
),
get_existing_template AS (
    -- Get existing template if it exists (matching html_id and schema_id via document_html and document_schemas)
    SELECT DISTINCT dt.template_id
    FROM document_templates dt
    JOIN document_html dh ON dh.document_id = dt.document_id AND dh.html_id = html_id AND dh.active = true
    JOIN document_schemas ds ON ds.document_id = dt.document_id AND ds.schema_id = schema_id AND ds.active = true
    WHERE dt.active = true
      AND html_id IS NOT NULL AND schema_id IS NOT NULL
    LIMIT 1
),
template_id AS (
    SELECT template_id FROM create_template
    UNION ALL
    SELECT template_id FROM get_existing_template
    WHERE html_id IS NOT NULL AND schema_id IS NOT NULL
    LIMIT 1
),
link_template_schema AS (
    -- Link template to schema via schema_templates junction table
    INSERT INTO schema_templates (schema_id, template_id, created_at, updated_at)
    SELECT 
        schema_id,
        ti.template_id,
        NOW(),
        NOW()
    FROM template_id ti
    WHERE schema_id IS NOT NULL
    ON CONFLICT (schema_id, template_id) DO UPDATE SET
        updated_at = NOW()
),
insert_template_link AS (
    -- Link template to document (without html_id and schema_id)
    INSERT INTO document_templates (document_id, template_id, active, created_at, updated_at)
    SELECT 
        document_id,
        ti.template_id,
        true,
        NOW(),
        NOW()
    FROM template_id ti
    WHERE html_id IS NOT NULL AND schema_id IS NOT NULL
    ON CONFLICT (document_id, template_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
insert_html_link AS (
    -- Link HTML to document via document_html junction
    INSERT INTO document_html (document_id, html_id, active, created_at, updated_at)
    SELECT 
        document_id,
        html_id,
        true,
        NOW(),
        NOW()
    WHERE html_id IS NOT NULL
    ON CONFLICT (document_id, html_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
insert_schema_link AS (
    -- Link schema to document via document_schemas junction
    INSERT INTO document_schemas (document_id, schema_id, active, created_at, updated_at)
    SELECT 
        document_id,
        schema_id,
        true,
        NOW(),
        NOW()
    WHERE schema_id IS NOT NULL
    ON CONFLICT (document_id, schema_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
insert_depts AS (
    INSERT INTO document_departments (document_id, department_id, active, created_at, updated_at)
    SELECT document_id, dept_id, true, NOW(), NOW()
    FROM unnest(department_ids) as dept_id
    WHERE cardinality(department_ids) > 0
    RETURNING document_id
),
insert_fields AS (
    INSERT INTO document_fields (document_id, field_id, active, created_at, updated_at)
    SELECT document_id, field_id, true, NOW(), NOW()
    FROM unnest(field_ids) as field_id
    WHERE cardinality(field_ids) > 0
    RETURNING document_id
)
SELECT 
    document_id::text as document_id,
    (SELECT actor_name FROM user_profile LIMIT 1) as actor_name
$$;