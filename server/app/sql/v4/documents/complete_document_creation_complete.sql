DROP FUNCTION IF EXISTS api_complete_document_creation_v4(uuid, text, text, bigint, text, text, uuid, uuid);
CREATE OR REPLACE FUNCTION api_complete_document_creation_v4(
    parent_document_id uuid,
    file_path text,
    mime_type text,
    file_size bigint,
    child_name text,
    child_description text,
    document_domain_id uuid,
    scenario_id uuid
)
RETURNS TABLE (
    child_document_id text,
    upload_id text
)
LANGUAGE sql
AS $$
WITH -- Insert name INTO names_resource table and get ID
name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT api_complete_document_creation_v4.child_name, NOW(), NOW()
    WHERE api_complete_document_creation_v4.child_name IS NOT NULL AND api_complete_document_creation_v4.child_name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description INTO descriptions_resource table and get ID
description_resource AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT api_complete_document_creation_v4.child_description, NOW(), NOW()
    WHERE api_complete_document_creation_v4.child_description IS NOT NULL AND api_complete_document_creation_v4.child_description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
create_child_document AS (
    -- Create child document (without name/description/active/template/document_domain_id columns)
    INSERT INTO document_artifact (
        id, created_at, updated_at
    )
    VALUES (gen_random_uuid(), NOW(), NOW())
    RETURNING id as document_id
),
-- Domain-based agent assignment removed - no longer needed
link_child_document_agent_domain AS (
    -- Placeholder CTE (removed domain logic)
    SELECT NULL::uuid as dummy FROM create_child_document LIMIT 0
),
-- Link document to name
link_document_name AS (
    INSERT INTO document_names (document_id, name_id, created_at, updated_at)
    SELECT 
        ccd.document_id,
        nr.name_id,
        NOW(),
        NOW()
    FROM create_child_document ccd
    CROSS JOIN name_resource nr
    ON CONFLICT (document_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link document to description
link_document_description AS (
    INSERT INTO document_descriptions (document_id, description_id, created_at, updated_at)
    SELECT 
        ccd.document_id,
        dr.description_id,
        NOW(),
        NOW()
    FROM create_child_document ccd
    CROSS JOIN description_resource dr
    ON CONFLICT (document_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link document active flag
link_document_active_flag AS (
    INSERT INTO document_flags (document_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        ccd.document_id,
        f.id,
        'active'::type_document_flags,
        true,
        NOW(),
        NOW()
    FROM create_child_document ccd
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
        ccd.document_id,
        f.id,
        'template'::type_document_flags,
        false,
        NOW(),
        NOW()
    FROM create_child_document ccd
    CROSS JOIN flags_resource f
    WHERE f.name = 'template'
    ON CONFLICT (document_id, flag_id, type) DO UPDATE SET 
        value = false,
        updated_at = NOW()
),
create_upload AS (
    -- Create upload record
    INSERT INTO uploads (file_path, mime_type, size, created_at, updated_at)
    VALUES (api_complete_document_creation_v4.file_path, api_complete_document_creation_v4.mime_type, api_complete_document_creation_v4.file_size, NOW(), NOW())
    RETURNING id
),
link_document_upload AS (
    -- Link document to upload (regular upload, not template upload)
    INSERT INTO document_uploads (document_id, upload_id, active, created_at, updated_at)
    SELECT ccd.document_id, cu.id, true, NOW(), NOW()
    FROM create_child_document ccd
    CROSS JOIN create_upload cu
    ON CONFLICT (document_id, upload_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING document_id, upload_id
),
link_document_tree AS (
    -- Link parent→child in document_tree
    INSERT INTO document_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT api_complete_document_creation_v4.parent_document_id, ccd.document_id, true, NOW(), NOW()
    FROM create_child_document ccd
    ON CONFLICT (parent_id, child_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING child_id
),
copy_document_departments AS (
    -- Copy document_departments from parent to child (for department filtering)
    INSERT INTO document_departments (document_id, department_id, active, created_at, updated_at)
    SELECT 
        ccd.document_id,
        dd.department_id,
        dd.active,
        NOW(),
        NOW()
    FROM create_child_document ccd
    CROSS JOIN document_departments dd
    WHERE dd.document_id = api_complete_document_creation_v4.parent_document_id AND dd.active = true
    ON CONFLICT (document_id, department_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
),
-- NOTE: Child documents are "bare" - we do NOT copy document_fields or parameter_documents 
-- from parent template to avoid collisions in scenarios/videos.
-- We DO copy document_departments for proper department filtering.
-- The child document exists only as a dynamic instance linked to the parent via document_tree
link_scenario AS (
    -- Optionally link to scenario if scenario_id provided
    INSERT INTO scenario_documents (scenario_id, document_id, active, created_at, updated_at)
    SELECT api_complete_document_creation_v4.scenario_id, ccd.document_id, true, NOW(), NOW()
    FROM create_child_document ccd
    WHERE api_complete_document_creation_v4.scenario_id IS NOT NULL
    ON CONFLICT (scenario_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING document_id
)
SELECT 
    ccd.document_id::text as child_document_id,
    cu.id::text as upload_id
FROM create_child_document ccd
CROSS JOIN create_upload cu
CROSS JOIN link_document_upload ldu
CROSS JOIN link_document_tree ldt
LEFT JOIN link_scenario ls ON ls.document_id = ccd.document_id
$$;