-- Insert document with department, parameter item, and upload links in single transaction
-- Parameters: 
--   $1 = document_id (uuid)
--   $2 = name (text)
--   $3 = upload_id (uuid, nullable - for regular documents)
--   $4 = department_ids (uuid[])
--   $5 = parameter_item_ids (uuid[])
--   $6 = template (boolean, default false)
--   $7 = template_upload_id (uuid, nullable - for template HTML)
--   $8 = template_args (jsonb, nullable - template schema)
-- Returns: document_id (text)

WITH insert_doc AS (
    INSERT INTO documents (
        id, 
        name, 
        active, 
        template,
        template_args,
        created_at, 
        updated_at,
        classify_agent_id,
        document_agent_id
    )
    VALUES (
        $1, 
        $2, 
        true, 
        COALESCE($6, false),
        COALESCE($8, '{}'::jsonb),
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
    SELECT $1, $3::uuid, true, NOW(), NOW()
    WHERE $3::uuid IS NOT NULL
    ON CONFLICT (document_id, upload_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
insert_template_upload AS (
    -- Link template upload if provided (for template documents)
    INSERT INTO document_uploads (document_id, upload_id, active, created_at, updated_at)
    SELECT $1, $7::uuid, true, NOW(), NOW()
    WHERE $7::uuid IS NOT NULL
    ON CONFLICT (document_id, upload_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
insert_depts AS (
    INSERT INTO document_departments (document_id, department_id, active, created_at, updated_at)
    SELECT $1, dept_id, true, NOW(), NOW()
    FROM unnest($4::uuid[]) as dept_id
    WHERE cardinality($4::uuid[]) > 0
    RETURNING document_id
),
insert_params AS (
    INSERT INTO document_parameter_items (document_id, parameter_item_id, active, created_at, updated_at)
    SELECT $1, param_id, true, NOW(), NOW()
    FROM unnest($5::uuid[]) as param_id
    WHERE cardinality($5::uuid[]) > 0
    RETURNING document_id
)
SELECT $1::text as document_id
