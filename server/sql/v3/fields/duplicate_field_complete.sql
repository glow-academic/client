WITH original_field AS (
    SELECT 
        f.id,
        f.name,
        f.description,
        f.default_field
    FROM fields f
    WHERE f.id = $1::uuid
),
original_parameters AS (
    SELECT fp.parameter_id
    FROM parameter_fields fp
    WHERE fp.field_id = (SELECT id FROM original_field)
    AND fp.active = true
),
original_departments AS (
    SELECT fd.department_id
    FROM field_departments fd
    WHERE fd.field_id = (SELECT id FROM original_field)
    AND fd.active = true
),
new_field AS (
    INSERT INTO fields (
        name,
        description,
        value,
        default_field
    )
    SELECT 
        of.name || ' (Copy)',
        of.description,
        o        of.default_field
    FROM original_field of
    RETURNING id::text as field_id
),
link_parameters AS (
    -- Link new field to same parameters as original
    INSERT INTO parameter_fields (field_id, parameter_id, active, created_at, updated_at)
    SELECT 
        nf.field_id::uuid,
        op.parameter_id,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN original_parameters op
    ON CONFLICT (field_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_departments AS (
    -- Link new field to same departments as original
    INSERT INTO field_departments (field_id, department_id, active, created_at, updated_at)
    SELECT 
        nf.field_id::uuid,
        od.department_id,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN original_departments od
    ON CONFLICT (field_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT field_id FROM new_field

