-- Get fields list with permissions and relationships
-- Converted to function with composite types
-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_list_fields_v4(uuid);

-- 2) Drop types WITHOUT CASCADE
DROP TYPE IF EXISTS types.q_list_fields_v4_field;
DROP TYPE IF EXISTS types.q_list_fields_v4_parameter;
DROP TYPE IF EXISTS types.q_list_fields_v4_department;
DROP TYPE IF EXISTS types.q_list_fields_v4_option;

-- 3) Recreate types
CREATE TYPE types.q_list_fields_v4_field AS (
    field_id uuid,
    name text,
    description text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz,
    department_ids text[],
    parameter_ids text[],
    conditional_parameter_ids text[],
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean
);

CREATE TYPE types.q_list_fields_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_fields_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_fields_v4_option AS (
    value text,
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_fields_v4(
    profile_id uuid
)
RETURNS TABLE (
    actor_name text,
    fields types.q_list_fields_v4_field[],
    parameters types.q_list_fields_v4_parameter[],
    departments types.q_list_fields_v4_department[],
    parameter_options types.q_list_fields_v4_option[],
    department_options types.q_list_fields_v4_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) AND pn.type = 'full'::type_profile_names LIMIT 1),
            (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names_resource n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = (SELECT profile_id FROM params) AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
field_parameters_agg AS (
    SELECT 
        f.id as field_id,
        CASE 
            WHEN (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL THEN ARRAY[(SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)::text]
            ELSE ARRAY[]::text[]
        END as parameter_ids
    FROM field_artifact f
    WHERE EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true)
),
field_departments_data AS (
    SELECT 
        fd.field_id,
        ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) as department_ids
    FROM field_departments fd
    WHERE fd.active = true
    GROUP BY fd.field_id
),
field_conditional_parameters_agg AS (
    SELECT 
        fcp.field_id,
        ARRAY_AGG(fcp.conditional_parameter_id::text ORDER BY (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1)) as conditional_parameter_ids
    FROM field_conditional_parameters fcp
    JOIN parameters_resource p ON p.id = fcp.conditional_parameter_id
    WHERE fcp.active = true
    GROUP BY fcp.field_id
),
fields_data AS (
    SELECT 
        f.id as field_id,
        (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
        EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = TRUE) as active,
        f.created_at,
        f.updated_at,
        COALESCE(fdd.department_ids, NULL) as department_ids,
        COALESCE(fpa.parameter_ids, ARRAY[]::text[]) as parameter_ids,
        COALESCE(fcpa.conditional_parameter_ids, ARRAY[]::text[]) as conditional_parameter_ids,
        CASE 
            WHEN COALESCE(fdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN COALESCE(fdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_delete,
        true as can_duplicate
    FROM params x
    JOIN fields_resource f ON EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true)
    LEFT JOIN field_departments_data fdd ON fdd.field_id = f.id
    LEFT JOIN field_parameters_agg fpa ON fpa.field_id = f.id
    LEFT JOIN field_conditional_parameters_agg fcpa ON fcpa.field_id = f.id
    CROSS JOIN user_profile up
    WHERE (
        -- Include fields with no departments (cross-department)
        NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
        OR
        -- Include fields in user's departments
        EXISTS (
            SELECT 1 FROM field_departments fd
            WHERE fd.field_id = f.id 
            AND fd.department_id IN (SELECT department_id FROM user_departments)
            AND fd.active = true
        )
    )
    GROUP BY f.id, (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = TRUE), f.created_at, f.updated_at, fdd.department_ids, fpa.parameter_ids, fcpa.conditional_parameter_ids, up.role
),
assigned_parameter_ids AS (
    SELECT DISTINCT unnest(parameter_ids)::text as parameter_id
    FROM fields_data
    WHERE parameter_ids IS NOT NULL
),
assigned_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::text as department_id
    FROM fields_data
    WHERE department_ids IS NOT NULL
),
all_parameter_ids AS (
    SELECT DISTINCT unnest(parameter_ids)::uuid as parameter_id
    FROM field_parameters_agg
),
parameter_data AS (
    SELECT 
        p.id as parameter_id,
        (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM parameter_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), '') as description
    FROM all_parameter_ids api
    JOIN parameters_resource p ON p.id = api.parameter_id
),
parameter_options_data AS (
    SELECT 
        ARRAY_AGG(
            (p.parameter_id::text,
             CASE 
                 WHEN (SELECT COUNT(*) FROM parameter_data pd2 WHERE pd2.name = p.name) > 1 
                 THEN p.name || ' (' || SUBSTRING(p.parameter_id::text FROM LENGTH(p.parameter_id::text) - 7) || ')'
                 ELSE p.name
             END)::types.q_list_fields_v4_option
            ORDER BY p.name
        ) FILTER (WHERE p.parameter_id IN (SELECT parameter_id::uuid FROM assigned_parameter_ids)) as options
    FROM parameter_data p
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM field_departments_data
    WHERE department_ids IS NOT NULL
    UNION
    SELECT department_id FROM user_departments
),
department_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d_desc.description FROM department_descriptions dd JOIN descriptions_resource d_desc ON dd.description_id = d_desc.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM all_department_ids adi
    JOIN departments_resource d ON d.id = adi.department_id
),
department_options_data AS (
    SELECT 
        ARRAY_AGG(
            (d.department_id::text, d.name)::types.q_list_fields_v4_option
            ORDER BY d.name
        ) FILTER (WHERE d.department_id::text IN (SELECT department_id FROM assigned_department_ids) AND d.department_id IN (SELECT department_id FROM user_departments)) as options
    FROM department_data d
)
SELECT 
    up.actor_name,
    -- Aggregate fields
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.field_id, fd.name, fd.description, fd.active, fd.created_at, fd.updated_at, fd.department_ids, fd.parameter_ids, fd.conditional_parameter_ids, fd.can_edit, fd.can_delete, fd.can_duplicate)::types.q_list_fields_v4_field
            ORDER BY fd.name
        ) FROM fields_data fd),
        '{}'::types.q_list_fields_v4_field[]
    ) as fields,
    -- Aggregate parameters
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.parameter_id, pd.name, pd.description)::types.q_list_fields_v4_parameter
            ORDER BY pd.name
        ) FROM parameter_data pd),
        '{}'::types.q_list_fields_v4_parameter[]
    ) as parameters,
    -- Aggregate departments
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_list_fields_v4_department
            ORDER BY dd.name
        ) FROM department_data dd),
        '{}'::types.q_list_fields_v4_department[]
    ) as departments,
    -- Parameter options (for UI filtering)
    COALESCE((SELECT options FROM parameter_options_data), '{}'::types.q_list_fields_v4_option[]) as parameter_options,
    -- Department options (for UI filtering)
    COALESCE((SELECT options FROM department_options_data), '{}'::types.q_list_fields_v4_option[]) as department_options
FROM user_profile up
$$;