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
    total_parameter_links bigint,
    is_inactive boolean
);

CREATE TYPE types.q_list_fields_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    count bigint
);

CREATE TYPE types.q_list_fields_v4_department AS (
    department_id uuid,
    name text,
    description text,
    count bigint
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
    user_role text,
    fields types.q_list_fields_v4_field[],
    parameters types.q_list_fields_v4_parameter[],
    departments types.q_list_fields_v4_department[],
    parameter_options types.q_list_fields_v4_option[],
    department_options types.q_list_fields_v4_option[],
    total_count bigint
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
    JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
user_profile AS (
    SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
field_parameters_agg AS (
    SELECT
        f.id as field_id,
        CASE
            WHEN (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL THEN ARRAY[(SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1)::text]
            ELSE ARRAY[]::text[]
        END as parameter_ids
    FROM field_artifact f
    WHERE EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'field_active' AND ff.value = true)
),
field_departments_data AS (
    SELECT
        fd.field_id,
        ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) as department_ids
    FROM field_departments_junction fd
    WHERE fd.active = true
    GROUP BY fd.field_id
),
field_conditional_parameters_agg AS (
    SELECT
        fcpj.field_id,
        ARRAY_AGG(cpr.parameter_id::text ORDER BY (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = pr.id LIMIT 1)) as conditional_parameter_ids,
        COUNT(*)::bigint as total_parameter_links
    FROM field_conditional_parameters_junction fcpj
    JOIN conditional_parameters_resource cpr ON cpr.id = fcpj.conditional_parameter_id
    JOIN parameters_resource pr ON pr.id = cpr.parameter_id
    WHERE fcpj.active = true
    GROUP BY fcpj.field_id
),
fields_data AS (
    SELECT
        f.id as field_id,
        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        (SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
        EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'field_active' AND ff.value = TRUE) as active,
        f.created_at,
        f.updated_at,
        COALESCE(fdd.department_ids, NULL) as department_ids,
        COALESCE(fpa.parameter_ids, ARRAY[]::text[]) as parameter_ids,
        COALESCE(fcpa.conditional_parameter_ids, ARRAY[]::text[]) as conditional_parameter_ids,
        COALESCE(fcpa.total_parameter_links, 0)::bigint as total_parameter_links,
        NOT EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'field_active' AND ff.value = TRUE) as is_inactive
    FROM params x
    JOIN field_artifact f ON true
    LEFT JOIN field_departments_data fdd ON fdd.field_id = f.id
    LEFT JOIN field_parameters_agg fpa ON fpa.field_id = f.id
    LEFT JOIN field_conditional_parameters_agg fcpa ON fcpa.field_id = f.id
    CROSS JOIN user_profile up
    WHERE EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'field_active' AND ff.value = true)
    AND (
        -- Superadmin can see all fields
        up.role = 'superadmin'::profile_type
        OR
        -- Include fields with no departments (cross-department)
        NOT EXISTS (SELECT 1 FROM field_departments_junction fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
        OR
        -- Include fields in user's departments
        EXISTS (
            SELECT 1 FROM field_departments_junction fd
            WHERE fd.field_id = f.id
            AND fd.department_id IN (SELECT department_id FROM user_departments)
            AND fd.active = true
        )
    )
    GROUP BY f.id, (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'field_active' AND ff.value = TRUE), f.created_at, f.updated_at, fdd.department_ids, fpa.parameter_ids, fcpa.conditional_parameter_ids, fcpa.total_parameter_links, up.role
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
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), '') as description,
        (SELECT COUNT(*) FROM fields_data fd WHERE p.id::text = ANY(fd.parameter_ids))::bigint as count
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
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d_desc.description FROM department_descriptions_junction dd JOIN descriptions_resource d_desc ON dd.description_id = d_desc.id WHERE dd.department_id = d.id LIMIT 1), '') as description,
        (SELECT COUNT(*) FROM fields_data fd WHERE d.id::text = ANY(fd.department_ids))::bigint as count
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
    up.role::text as user_role,
    -- Aggregate fields
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.field_id, fd.name, fd.description, fd.active, fd.created_at, fd.updated_at, fd.department_ids, fd.parameter_ids, fd.conditional_parameter_ids, fd.total_parameter_links, fd.is_inactive)::types.q_list_fields_v4_field
            ORDER BY fd.name
        ) FROM fields_data fd),
        '{}'::types.q_list_fields_v4_field[]
    ) as fields,
    -- Aggregate parameters
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.parameter_id, pd.name, pd.description, pd.count)::types.q_list_fields_v4_parameter
            ORDER BY pd.name
        ) FROM parameter_data pd),
        '{}'::types.q_list_fields_v4_parameter[]
    ) as parameters,
    -- Aggregate departments
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id, dd.name, dd.description, dd.count)::types.q_list_fields_v4_department
            ORDER BY dd.name
        ) FROM department_data dd),
        '{}'::types.q_list_fields_v4_department[]
    ) as departments,
    -- Parameter options (for UI filtering)
    COALESCE((SELECT options FROM parameter_options_data), '{}'::types.q_list_fields_v4_option[]) as parameter_options,
    -- Department options (for UI filtering)
    COALESCE((SELECT options FROM department_options_data), '{}'::types.q_list_fields_v4_option[]) as department_options,
    -- Total count
    (SELECT COUNT(*) FROM fields_data)::bigint as total_count
FROM user_profile up
$$;
