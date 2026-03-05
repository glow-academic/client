-- Duplicate field with all parameter, department, and conditional parameter associations
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_duplicate_field_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_field_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_duplicate_field_v4(
    field_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    new_field_id uuid,
    original_name text
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        field_id AS field_id,
        profile_id AS profile_id
),
original_field AS (
    SELECT
        f.id,
        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.names_id = n.id WHERE fn.field_id = f.id LIMIT 1) as name,
        (SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.descriptions_id = d.id WHERE fd.field_id = f.id LIMIT 1) as description
    FROM params x
    JOIN field_artifact f ON f.id = x.field_id
),
original_parameters AS (
    SELECT pf.parameter_id
    FROM params x
    JOIN parameter_fields_junction pf ON pf.field_id = x.field_id
    WHERE EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flags_id = f.id WHERE ff.field_id = x.field_id AND f.name = 'field_active' AND f.value = true)
    LIMIT 1
),
original_departments AS (
    SELECT fd.departments_id
    FROM params x
    JOIN field_departments_junction fd ON fd.field_id = x.field_id AND fd.active = true
),
original_conditional_parameters AS (
    SELECT fcpj.conditional_parameters_id
    FROM params x
    JOIN field_conditional_parameters_junction fcpj
        ON fcpj.field_id = x.field_id AND fcpj.active = true
),
-- Insert name INTO names_resource table
new_name_resource AS (
    INSERT INTO names_resource (name, created_at)
    SELECT name || ' (Copy)', NOW()
    FROM original_field
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as names_id, name
),
-- Insert description INTO descriptions_resource table
new_description_resource AS (
    INSERT INTO descriptions_resource (description, created_at)
    SELECT description, NOW()
    FROM original_field
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as descriptions_id, description
),
new_field AS (
    -- Create field (without name/description/parameter_id columns)
    INSERT INTO field_artifact (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM original_field
    RETURNING id as field_id
),
-- Link field to name
link_field_name AS (
    INSERT INTO field_names_junction (field_id, names_id, created_at)
    SELECT
        nf.field_id,
        nnr.names_id,
        NOW()
    FROM new_field nf
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (field_id, names_id) DO NOTHING
),
-- Link field to description
link_field_description AS (
    INSERT INTO field_descriptions_junction (field_id, descriptions_id, created_at)
    SELECT
        nf.field_id,
        ndr.descriptions_id,
        NOW()
    FROM new_field nf
    CROSS JOIN new_description_resource ndr
    ON CONFLICT (field_id, descriptions_id) DO NOTHING
),
-- Link field to parameter via parameter_fields_junction junction table
link_field_parameter AS (
    INSERT INTO parameter_fields_junction (parameter_id, field_id, created_at)
    SELECT
        op.parameter_id,
        nf.field_id,
        NOW()
    FROM new_field nf
    CROSS JOIN original_parameters op
    WHERE op.parameter_id IS NOT NULL
    ON CONFLICT (parameter_id, field_id) DO NOTHING
),
-- Link field active flag (set to false for duplicate)
link_field_active_flag AS (
    INSERT INTO field_flags_junction (field_id, flags_id, created_at) SELECT nf.field_id,
        f.id,
        NOW()
    FROM new_field nf
    CROSS JOIN flags_resource f
    WHERE f.name = 'field_active'
    ON CONFLICT (field_id, flags_id) DO NOTHING
),
link_departments AS (
    -- Link new field to same departments as original
    INSERT INTO field_departments_junction (field_id, departments_id, active, created_at)
    SELECT
        nf.field_id,
        od.department_id,
        true,
        NOW()
    FROM new_field nf
    CROSS JOIN original_departments od
    ON CONFLICT (field_id, departments_id) DO UPDATE SET
        active = true
),
copy_conditional_parameters AS (
    -- Link new field to same conditional parameters as original
    INSERT INTO field_conditional_parameters_junction (field_id, conditional_parameters_id, active, created_at)
    SELECT
        nf.field_id,
        ocp.conditional_parameters_id,
        true,
        NOW()
    FROM new_field nf
    CROSS JOIN original_conditional_parameters ocp
    ON CONFLICT (field_id, conditional_parameters_id) DO NOTHING
)
SELECT
    (SELECT field_id FROM new_field LIMIT 1) as new_field_id,
    (SELECT name FROM original_field LIMIT 1) as original_name
$$;

