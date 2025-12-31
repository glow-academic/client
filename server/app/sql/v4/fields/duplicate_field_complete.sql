-- Duplicate field with all parameter and department associations
-- Converted to function

BEGIN;

DROP FUNCTION IF EXISTS api_duplicate_field_v4(uuid, uuid);

CREATE OR REPLACE FUNCTION api_duplicate_field_v4(
    field_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    field_exists boolean,
    field_id uuid,
    field_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        field_id AS field_id,
        profile_id AS profile_id
),
field_exists_check AS (
    -- Check if field exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM fields WHERE id = (SELECT field_id FROM params)
    )::boolean as field_exists
),
user_profile AS (
    SELECT p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
original_field AS (
    SELECT 
        f.id,
        f.name,
        f.description
    FROM params x
    JOIN fields f ON f.id = x.field_id
),
original_parameters AS (
    SELECT fp.parameter_id
    FROM params x
    JOIN parameter_fields fp ON fp.field_id = x.field_id AND fp.active = true
),
original_departments AS (
    SELECT fd.department_id
    FROM params x
    JOIN field_departments fd ON fd.field_id = x.field_id AND fd.active = true
),
new_field AS (
    INSERT INTO fields (
        name,
        description
    )
    SELECT 
        orig.name || ' (Copy)',
        orig.description
    FROM original_field orig
    RETURNING id as field_id, name as field_name
),
link_parameters AS (
    -- Link new field to same parameters as original
    INSERT INTO parameter_fields (field_id, parameter_id, active, created_at, updated_at)
    SELECT 
        nf.field_id,
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
        nf.field_id,
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
    fec.field_exists::boolean as field_exists,
    nf.field_id,
    nf.field_name,
    up.actor_name
FROM field_exists_check fec
CROSS JOIN user_profile up
LEFT JOIN new_field nf ON fec.field_exists = true
$$;

COMMIT;
