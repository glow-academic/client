-- Complete document creation: create child document, upload, and all links in one query
-- Parameters: $1=parent_document_id (uuid), $2=file_path (text), $3=mime_type (text), $4=file_size (bigint), 
--             $5=child_name (text), $6=child_description (text), $7=classify_agent_id (uuid), 
--             $8=document_agent_id (uuid), $9=scenario_id (uuid, nullable)
-- Returns: child_document_id (text), upload_id (text)
-- Creates child document, upload record, links document to upload, links parent→child in document_tree,
-- and optionally links to scenario - all atomically
WITH create_child_document AS (
    -- Create child document (not a template)
    INSERT INTO documents (
        id, name, description, active, template, created_at, updated_at,
        classify_agent_id, document_agent_id
    )
    VALUES (gen_random_uuid(), $5, $6, true, false, NOW(), NOW(), $7, $8)
    RETURNING id
),
create_upload AS (
    -- Create upload record
    INSERT INTO uploads (file_path, mime_type, size, created_at, updated_at)
    VALUES ($2, $3, $4, NOW(), NOW())
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
    SELECT $1::uuid, ccd.id, true, NOW(), NOW()
    FROM create_child_document ccd
    ON CONFLICT (parent_id, child_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING child_id
),
link_scenario AS (
    -- Optionally link to scenario if scenario_id provided
    INSERT INTO scenario_documents (scenario_id, document_id, active, created_at, updated_at)
    SELECT $9::uuid, ccd.id, true, NOW(), NOW()
    FROM create_child_document ccd
    WHERE $9 IS NOT NULL
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

