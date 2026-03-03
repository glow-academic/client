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
    field_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    document_id text
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH -- Insert name INTO names_resource table and get ID
name_resource AS (
    INSERT INTO names_resource (name, created_at)
    SELECT name, NOW()
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as name_id
),
-- Insert description INTO descriptions_resource table and get ID
description_resource AS (
    INSERT INTO descriptions_resource (description, created_at)
    SELECT COALESCE(description, ''), NOW()
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as description_id
),
insert_doc AS (
    -- Create document (without name/description/active/template columns)
    INSERT INTO document_artifact (
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
-- Domain-based agent assignment removed - no longer needed
link_document_agent_domain AS (
    -- Placeholder CTE (removed domain logic)
    SELECT NULL::uuid as dummy FROM insert_doc LIMIT 0
),
-- Link document to description
link_document_description AS (
    INSERT INTO document_descriptions_junction (document_id, description_id, created_at)
    SELECT 
        id.document_id,
        dr.description_id,
        NOW()
    FROM insert_doc id
    CROSS JOIN description_resource dr
    ON CONFLICT (document_id, description_id) DO NOTHING
),
-- Link document active flag
link_document_active_flag AS (
    INSERT INTO document_flags_junction (document_id, flag_id, value, created_at) SELECT id.document_id,
        f.id,
        true,
        NOW()
    FROM insert_doc id
    CROSS JOIN flags_resource f
    WHERE f.name = 'document_active'
    ON CONFLICT (document_id, flag_id) DO UPDATE SET 
        value = true
),
-- Link document template flag (defaults to false)
link_document_template_flag AS (
    INSERT INTO document_flags_junction (document_id, flag_id, value, created_at)
    SELECT 
        id.document_id,
        f.id,
        false,
        NOW()
    FROM insert_doc id
    CROSS JOIN flags_resource f
    WHERE f.name = 'template'
    ON CONFLICT (document_id, flag_id) DO UPDATE SET 
        value = false
),
get_uploads_resource_id AS (
    -- Look up uploads_resource.id from upload_id via connection table
    SELECT ur.id as uploads_id
    FROM uploads_resource ur
    JOIN uploads_uploads_connection uuc ON uuc.uploads_id = ur.id
    WHERE uuc.upload_id = api_insert_document_v4.upload_id
    AND api_insert_document_v4.upload_id IS NOT NULL
    LIMIT 1
),
insert_upload AS (
    -- Link regular upload if provided
    INSERT INTO document_uploads_junction (document_id, uploads_id, active, created_at)
    SELECT id.document_id, gur.uploads_id, true, NOW()
    FROM insert_doc id
    CROSS JOIN get_uploads_resource_id gur
    ON CONFLICT (document_id, uploads_id) DO UPDATE SET
        active = true
),
insert_depts AS (
    INSERT INTO document_departments_junction (document_id, department_id, active, created_at)
    SELECT document_id, dept_id, true, NOW()
    FROM unnest(department_ids) as dept_id
    WHERE cardinality(department_ids) > 0
    RETURNING document_id
),
insert_fields AS (
    -- Insert into document_parameter_fields_junction (link document to parameter_fields_resource entries)
    INSERT INTO document_parameter_fields_junction (document_id, parameter_field_id, active, created_at)
    SELECT id.document_id, pfr.id, true, NOW()
    FROM insert_doc id
    CROSS JOIN unnest(field_ids) as field_resource_id
    JOIN parameter_fields_resource pfr ON pfr.field_id = field_resource_id
    WHERE cardinality(field_ids) > 0
    ON CONFLICT (document_id, parameter_field_id) DO NOTHING
    RETURNING document_id
),
insert_parameters AS (
    -- Populate document_parameters_junction from field -> parameter relationships
    INSERT INTO document_parameters_junction (document_id, parameter_id, type, active, created_at)
    SELECT DISTINCT id.document_id, pfr.parameter_id, 'direct'::link_type, true, NOW()
    FROM insert_doc id
    CROSS JOIN unnest(field_ids) as field_resource_id
    JOIN parameter_fields_resource pfr ON pfr.field_id = field_resource_id
    WHERE cardinality(field_ids) > 0
      AND pfr.parameter_id IS NOT NULL
    ON CONFLICT (document_id, parameter_id, type) DO NOTHING
    RETURNING document_id
)
SELECT
    document_id::text as document_id
$$;
