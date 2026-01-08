-- Duplicate field with all parameter and department associations
-- Converted to function
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
    SELECT COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
original_field AS (
    SELECT 
        f.id,
        (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1) as name,
        (SELECT d.description FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1) as description
    FROM params x
    JOIN fields f ON f.id = x.field_id
),
original_parameters AS (
    SELECT pf.parameter_id
    FROM params x
    JOIN parameter_fields pf ON pf.field_id = x.field_id
    WHERE EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = x.field_id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = true)
    LIMIT 1
),
original_departments AS (
    SELECT fd.department_id
    FROM params x
    JOIN field_departments fd ON fd.field_id = x.field_id AND fd.active = true
),
-- Insert name into names table
new_name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT name || ' (Copy)', NOW(), NOW()
    FROM original_field
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name
),
-- Insert description into descriptions table
new_description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM original_field
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id, description
),
new_field AS (
    -- Create field (without name/description/parameter_id columns)
    INSERT INTO fields (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM original_field
    RETURNING id as field_id
),
-- Link field to name
link_field_name AS (
    INSERT INTO field_names (field_id, name_id, created_at, updated_at)
    SELECT 
        nf.field_id,
        nnr.name_id,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (field_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link field to description
link_field_description AS (
    INSERT INTO field_descriptions (field_id, description_id, created_at, updated_at)
    SELECT 
        nf.field_id,
        ndr.description_id,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN new_description_resource ndr
    ON CONFLICT (field_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link field to parameter via parameter_fields junction table
link_field_parameter AS (
    INSERT INTO parameter_fields (parameter_id, field_id, created_at, updated_at)
    SELECT 
        op.parameter_id,
        nf.field_id,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN original_parameters op
    WHERE op.parameter_id IS NOT NULL
    ON CONFLICT (parameter_id, field_id) DO UPDATE SET updated_at = NOW()
),
-- Link field active flag (set to false for duplicate)
link_field_active_flag AS (
    INSERT INTO field_flags (field_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        nf.field_id,
        f.id,
        'active'::type_field_flags,
        FALSE,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (field_id, flag_id, type) DO UPDATE SET 
        value = FALSE,
        updated_at = NOW()
),
field_with_name AS (
    -- Get field with name for return
    SELECT 
        nf.field_id,
        nnr.name as field_name
    FROM new_field nf
    LEFT JOIN new_name_resource nnr ON true
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
    fwn.field_id,
    fwn.field_name,
    up.actor_name
FROM field_exists_check fec
CROSS JOIN user_profile up
LEFT JOIN field_with_name fwn ON fec.field_exists = true
$$;