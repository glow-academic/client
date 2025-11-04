INSERT INTO scenario_departments (scenario_id, department_id, active, created_at, updated_at)
SELECT $1, dept_id::uuid, true, NOW(), NOW()
FROM UNNEST($2::text[]) as dept_id
ON CONFLICT (scenario_id, department_id) DO UPDATE SET
    active = true,
    updated_at = NOW()

