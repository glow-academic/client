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
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = profile_id
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
    VALUES (
        document_id, 
        name,
        COALESCE(description, ''),
        true,
        false,  -- template defaults to false - must be explicitly enabled via update
        NOW(), 
        NOW(),
        (SELECT a.id FROM agents a JOIN artifact_agents aa ON aa.agent_id = a.id AND aa.artifact_instance_id IS NULL WHERE aa.role = 'classify' AND a.active = true LIMIT 1),
        (SELECT a.id FROM agents a JOIN artifact_agents aa ON aa.agent_id = a.id AND aa.artifact_instance_id IS NULL WHERE aa.role = 'document' AND a.active = true LIMIT 1)
    )
    RETURNING id
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