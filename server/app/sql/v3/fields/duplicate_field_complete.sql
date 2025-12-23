WITH resolve_profile_id AS (
    SELECT $2::uuid as resolved_profile_id
),
user_profile AS (
    SELECT p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
original_field AS (
    SELECT 
        f.id,
        f.name,
        f.description
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
        description
    )
    SELECT 
        of.name || ' (Copy)',
        of.description
    FROM original_field of
    RETURNING id::text as field_id, name as field_name
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
SELECT 
    nf.field_id,
    nf.field_name,
    up.actor_name
FROM new_field nf
CROSS JOIN user_profile up

