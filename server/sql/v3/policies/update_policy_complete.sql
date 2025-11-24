-- Update policy with department links in a single transaction
-- Parameters: $1 = policy_id (uuid), $2 = name (text), $3 = description (text),
--            $4 = active (boolean), $5 = department_ids (uuid[])

WITH update_policy AS (
    UPDATE policies
    SET 
        name = $2,
        description = $3,
        active = $4,
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
    FROM unnest($5::uuid[]) as dept_id
    WHERE cardinality($5::uuid[]) > 0
    ON CONFLICT (policy_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT policy_id, name FROM update_policy

