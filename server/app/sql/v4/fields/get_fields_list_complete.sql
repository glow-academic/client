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
        role,
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
field_parameters_agg AS (
    SELECT 
        pf.field_id,
        ARRAY_AGG(pf.parameter_id::text ORDER BY p.name) as parameter_ids
    FROM parameter_fields pf
    JOIN parameters p ON p.id = pf.parameter_id
    WHERE pf.active = true
    GROUP BY pf.field_id
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
        ARRAY_AGG(fcp.conditional_parameter_id::text ORDER BY p.name) as conditional_parameter_ids
    FROM field_conditional_parameters fcp
    JOIN parameters p ON p.id = fcp.conditional_parameter_id
    WHERE fcp.active = true
    GROUP BY fcp.field_id
),
fields_data AS (
    SELECT 
        f.id as field_id,
        f.name,
        f.description,
        f.active,
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
    JOIN fields f ON f.active = true
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
    GROUP BY f.id, f.name, f.description, f.active, f.created_at, f.updated_at, fdd.department_ids, fpa.parameter_ids, fcpa.conditional_parameter_ids, up.role
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
        p.name,
        COALESCE(p.description, '') as description
    FROM all_parameter_ids api
    JOIN parameters p ON p.id = api.parameter_id
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
        d.title as name,
        COALESCE(d.description, '') as description
    FROM all_department_ids adi
    JOIN departments d ON d.id = adi.department_id
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