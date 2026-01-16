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
    document_id text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH user_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM profile_artifact p
    WHERE p.id = profile_id
),
-- Insert name INTO names_resource table and get ID
name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description INTO descriptions_resource table and get ID
description_resource AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT COALESCE(description, ''), NOW(), NOW()
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
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
    INSERT INTO document_flags (document_id, flag_id, value, created_at, updated_at) SELECT id.document_id,
        f.id,
        true,
        NOW(),
        NOW()
    FROM insert_doc id
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
    ON CONFLICT (document_id, flag_id) DO UPDATE SET 
        value = true,
        updated_at = NOW()
),
-- Link document template flag (defaults to false)
link_document_template_flag AS (
    INSERT INTO document_flags (document_id, flag_id, value, created_at, updated_at)
    SELECT 
        id.document_id,
        f.id,
        false,
        NOW(),
        NOW()
    FROM insert_doc id
    CROSS JOIN flags_resource f
    WHERE f.name = 'template'
    ON CONFLICT (document_id, flag_id) DO UPDATE SET 
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