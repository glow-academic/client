-- Insert document with department and parameter item links in single transaction
-- Parameters: 
--   $1 = document_id (uuid)
--   $2 = name (text)
--   $3 = upload_id (uuid)
--   $4 = department_ids (uuid[])
--   $5 = parameter_item_ids (uuid[])
-- Returns: document_id (text)

WITH insert_doc AS (
    INSERT INTO documents (id, name, upload_id, active, created_at, updated_at)
    VALUES ($1, $2, $3, true, NOW(), NOW())
    RETURNING id
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

