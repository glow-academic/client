-- Update policy with department links and parameter items in a single transaction
-- Parameters: $1 = policy_id (uuid), $2 = name (text), $3 = description (text),
--            $4 = active (boolean), $5 = classify_agent_id (uuid, nullable),
--            $6 = department_ids (uuid[]), $7 = parameter_item_ids (uuid[])

WITH update_policy AS (
    UPDATE policies
    SET 
        name = $2,
        description = $3,
        active = $4,
        classify_agent_id = COALESCE($5, classify_agent_id),
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as policy_id, name
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM policy_departments WHERE policy_id = $1::uuid
),
link_departments AS (
    -- Insert new department links
    INSERT INTO policy_departments (policy_id, department_id, active, created_at, updated_at)
    SELECT $1::uuid, dept_id, true, NOW(), NOW()
    FROM unnest($6::uuid[]) as dept_id
    WHERE cardinality($6::uuid[]) > 0
    ON CONFLICT (policy_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_parameter_items AS (
    -- Delete all existing parameter item links
    DELETE FROM policy_parameter_items WHERE policy_id = $1::uuid
),
link_parameter_items AS (
    -- Insert new parameter item links
    INSERT INTO policy_parameter_items (policy_id, parameter_item_id, active, created_at, updated_at)
    SELECT $1::uuid, param_id, true, NOW(), NOW()
    FROM unnest($7::uuid[]) as param_id
    WHERE cardinality($7::uuid[]) > 0
    ON CONFLICT (policy_id, parameter_item_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT policy_id, name FROM update_policy

