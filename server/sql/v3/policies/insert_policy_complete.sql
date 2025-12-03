-- Insert policy with department links in single transaction
-- Parameters: 
--   $1 = policy_id (uuid)
--   $2 = name (text)
--   $3 = description (text)
--   $4 = upload_id (uuid)
--   $5 = active (boolean)
--   $6 = department_ids (uuid[])
-- Returns: policy_id (text)

WITH insert_policy AS (
    INSERT INTO policies (id, name, description, upload_id, active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING id
),
insert_depts AS (
    INSERT INTO policy_departments (policy_id, department_id, active, created_at, updated_at)
    SELECT $1, dept_id, true, NOW(), NOW()
    FROM unnest($6::uuid[]) as dept_id
    WHERE cardinality($6::uuid[]) > 0
    RETURNING policy_id
)
SELECT $1::text as policy_id

