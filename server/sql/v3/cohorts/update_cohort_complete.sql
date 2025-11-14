-- Update cohort with department relationships in single query (DHH style)
-- Parameters: $1=cohort_id (uuid), $2=title, $3=description, $4=active, $5=department_ids (text[])
-- Returns: id, title

WITH cohort_update AS (
    -- Update cohort
    UPDATE cohorts SET
        title = $2,
        description = $3,
        active = $4,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id, title
),
delete_departments AS (
    -- Delete existing department relationships
    DELETE FROM cohort_departments
    WHERE cohort_id = $1::uuid
),
link_departments AS (
    -- Link new departments if provided
    INSERT INTO cohort_departments (cohort_id, department_id, active, created_at, updated_at)
    SELECT 
        cu.id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM cohort_update cu
    CROSS JOIN UNNEST($5::text[]) as dept_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
    ON CONFLICT (cohort_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
-- Return updated cohort info
SELECT id, title FROM cohort_update

