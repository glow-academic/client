BEGIN;
DROP FUNCTION IF EXISTS api_complete_document_creation_v4(uuid, text, text, bigint, text, text, uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION api_complete_document_creation_v4(
    parent_document_id uuid,
    file_path text,
    mime_type text,
    file_size bigint,
    child_name text,
    child_description text,
    classify_agent_id uuid,
    document_agent_id uuid,
    scenario_id uuid
)
RETURNS TABLE (
    child_document_id text,
    upload_id text
)
LANGUAGE sql
AS $$
WITH create_child_document AS (
    -- Create child document (not a template)
    INSERT INTO documents (
        id, name, description, active, template, created_at, updated_at,
        classify_agent_id, document_agent_id
    )
    VALUES (gen_random_uuid(), api_complete_document_creation_v4.child_name, api_complete_document_creation_v4.child_description, true, false, NOW(), NOW(), api_complete_document_creation_v4.classify_agent_id, api_complete_document_creation_v4.document_agent_id)
    RETURNING id
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
    SELECT ccd.id, cu.id, true, NOW(), NOW()
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
    SELECT api_complete_document_creation_v4.parent_document_id, ccd.id, true, NOW(), NOW()
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
        ccd.id,
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
    SELECT api_complete_document_creation_v4.scenario_id, ccd.id, true, NOW(), NOW()
    FROM create_child_document ccd
    WHERE api_complete_document_creation_v4.scenario_id IS NOT NULL
    ON CONFLICT (scenario_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING document_id
)
SELECT 
    ccd.id::text as child_document_id,
    cu.id::text as upload_id
FROM create_child_document ccd
CROSS JOIN create_upload cu
CROSS JOIN link_document_upload ldu
CROSS JOIN link_document_tree ldt
LEFT JOIN link_scenario ls ON ls.document_id = ccd.id
$$;
COMMIT;

