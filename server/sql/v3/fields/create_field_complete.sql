WITH new_field AS (
    INSERT INTO fields (
        name,
        description,
        active
    )
    VALUES ($1, $2, COALESCE($3, true))
    RETURNING id::text as field_id
),
link_conditional_parameters AS (
    -- Link field to conditional parameters if provided
    INSERT INTO field_conditional_parameters (field_id, conditional_parameter_id, active, created_at, updated_at)
    SELECT 
        nf.field_id::uuid,
        cond_param_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN UNNEST(COALESCE($5::text[], ARRAY[]::text[])) as cond_param_id
    WHERE $5 IS NOT NULL AND array_length($5::text[], 1) > 0
    ON CONFLICT (field_id, conditional_parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_departments AS (
    -- Link field to departments if provided
    INSERT INTO field_departments (field_id, department_id, active, created_at, updated_at)
    SELECT 
        nf.field_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN UNNEST(COALESCE($4::text[], ARRAY[]::text[])) as dept_id
    WHERE $4 IS NOT NULL AND array_length($4::text[], 1) > 0
    ON CONFLICT (field_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT field_id FROM new_field

