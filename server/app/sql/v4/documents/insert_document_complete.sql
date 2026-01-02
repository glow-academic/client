-- Insert document with department, parameter item, and upload links in single transaction
-- Converted to PostgreSQL function
-- Note: Uses JSONB for template_args - may need refactoring per STANDARDS.md

BEGIN;

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
    description text DEFAULT NULL,
    upload_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    field_ids uuid[] DEFAULT ARRAY[]::uuid[],
    template_upload_id uuid DEFAULT NULL,
    template_args jsonb DEFAULT NULL,
    profile_id uuid
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
        (SELECT id FROM agents WHERE role = 'classify' AND active = true LIMIT 1),
        (SELECT id FROM agents WHERE role = 'document' AND active = true LIMIT 1)
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
create_or_get_template AS (
    -- Create or get template if template_upload_id is provided
    INSERT INTO templates (name, upload_id, args, created_at, updated_at)
    SELECT 
        name as name,
        template_upload_id,
        COALESCE(template_args, '{}'::jsonb),
        NOW(),
        NOW()
    WHERE template_upload_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM templates t 
          WHERE t.upload_id = template_upload_id AND t.args = COALESCE(template_args, '{}'::jsonb)
      )
    RETURNING id as template_id
),
get_existing_template AS (
    -- Get existing template if it exists
    SELECT id as template_id
    FROM templates
    WHERE upload_id = template_upload_id 
      AND args = COALESCE(template_args, '{}'::jsonb)
    LIMIT 1
),
template_id AS (
    SELECT template_id FROM create_or_get_template
    UNION ALL
    SELECT template_id FROM get_existing_template
    WHERE template_upload_id IS NOT NULL
    LIMIT 1
),
insert_template_link AS (
    -- Link template to document if template_id is available
    INSERT INTO document_templates (document_id, template_id, active, created_at, updated_at)
    SELECT 
        document_id,
        ti.template_id,
        true,
        NOW(),
        NOW()
    FROM template_id ti
    WHERE template_upload_id IS NOT NULL
    ON CONFLICT (document_id, template_id) DO UPDATE SET
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

COMMIT;
