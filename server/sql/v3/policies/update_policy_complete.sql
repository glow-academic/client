-- Update policy with department links in a single transaction
-- Parameters: $1 = policy_id (uuid), $2 = name (text), $3 = description (text),
--            $4 = file_path (text), $5 = mime_type (text), $6 = active (boolean),
--            $7 = department_id (nullable uuid)

WITH update_policy AS (
    UPDATE policies
    SET 
        name = $2,
        description = $3,
        file_path = $4,
        mime_type = $5,
        active = $6,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as policy_id, name
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM policy_departments WHERE policy_id = $1::uuid
),
link_department AS (
    -- Insert new department link if provided
    INSERT INTO policy_departments (policy_id, department_id, active, created_at, updated_at)
    SELECT $1::uuid, $7::uuid, true, NOW(), NOW()
    WHERE $7::uuid IS NOT NULL
    ON CONFLICT (policy_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT policy_id, name FROM update_policy

