-- Insert policy with department links and parameter items in single transaction
-- Parameters: 
--   $1 = policy_id (uuid)
--   $2 = name (text)
--   $3 = description (text)
--   $4 = upload_id (uuid)
--   $5 = active (boolean)
--   $6 = classify_agent_id (uuid, nullable)
--   $7 = department_ids (uuid[])
--   $8 = parameter_item_ids (uuid[])
-- Returns: policy_id (text)

WITH insert_policy AS (
    INSERT INTO policies (id, name, description, upload_id, active, classify_agent_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, COALESCE($6, '434b105b-a302-5638-93c6-e4bbac94b4f0'::uuid), NOW(), NOW())
    RETURNING id
),
insert_depts AS (
    INSERT INTO policy_departments (policy_id, department_id, active, created_at, updated_at)
    SELECT $1, dept_id, true, NOW(), NOW()
    FROM unnest($7::uuid[]) as dept_id
    WHERE cardinality($7::uuid[]) > 0
    RETURNING policy_id
),
insert_params AS (
    INSERT INTO policy_parameter_items (policy_id, parameter_item_id, active, created_at, updated_at)
    SELECT $1, param_id, true, NOW(), NOW()
    FROM unnest($8::uuid[]) as param_id
    WHERE cardinality($8::uuid[]) > 0
    RETURNING policy_id
)
SELECT $1::text as policy_id

