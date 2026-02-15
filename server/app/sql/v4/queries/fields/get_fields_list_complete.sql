-- Get fields list with permissions and relationships
-- Resource-first: only touches field_artifact + field's own junctions + resource tables
-- No cross-entity artifact tables
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_list_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_fields_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_list_fields_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

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
    active_parameter_count bigint,
    is_inactive boolean,
    persona_ids uuid[]
);

-- Filter option types simplified: id + count only (names hydrated in Python from cache)
CREATE TYPE types.q_list_fields_v4_option_id AS (
    id uuid,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_fields_v4(
    profile_id uuid
)
RETURNS TABLE (
    fields types.q_list_fields_v4_field[],
    parameter_option_ids types.q_list_fields_v4_option_id[],
    persona_option_ids types.q_list_fields_v4_option_id[],
    department_option_ids types.q_list_fields_v4_option_id[],
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
-- User context: actor_name comes from get_profile_context_internal() in Python
user_profile AS (
    SELECT COALESCE(r.role, 'member'::profile_type) as role,
           ''::text as actor_name
    FROM profile_roles_junction prj
    JOIN roles_resource r ON prj.role_id = r.id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
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
        COUNT(*)::bigint as active_parameter_count
    FROM field_conditional_parameters_junction fcpj
    JOIN conditional_parameters_resource cpr ON cpr.id = fcpj.conditional_parameter_id
    JOIN parameters_resource pr ON pr.id = cpr.parameter_id
    WHERE fcpj.active = true
    GROUP BY fcpj.field_id
),
-- Persona linkage: field → field_fields_junction → fields_resource → parameter_fields_resource → persona_parameter_fields_junction → persona_artifact
field_personas_data AS (
    SELECT
        ffj.field_id,
        ARRAY_AGG(DISTINCT ppfj.persona_id) as persona_ids
    FROM field_fields_junction ffj
    JOIN fields_resource fr ON fr.id = ffj.fields_id
    JOIN parameter_fields_resource pfr ON pfr.field_id = fr.id
    JOIN persona_parameter_fields_junction ppfj ON ppfj.parameter_field_id = pfr.id AND ppfj.active = true
    WHERE ffj.active = true
    GROUP BY ffj.field_id
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
        COALESCE(fcpa.active_parameter_count, 0)::bigint as active_parameter_count,
        NOT EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'field_active' AND ff.value = TRUE) as is_inactive,
        COALESCE(fpd.persona_ids, ARRAY[]::uuid[]) as persona_ids
    FROM params x
    JOIN field_artifact f ON true
    LEFT JOIN field_departments_data fdd ON fdd.field_id = f.id
    LEFT JOIN field_parameters_agg fpa ON fpa.field_id = f.id
    LEFT JOIN field_conditional_parameters_agg fcpa ON fcpa.field_id = f.id
    LEFT JOIN field_personas_data fpd ON fpd.field_id = f.id
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
    GROUP BY f.id, (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'field_active' AND ff.value = TRUE), f.created_at, f.updated_at, fdd.department_ids, fpa.parameter_ids, fcpa.conditional_parameter_ids, fcpa.active_parameter_count, up.role, fpd.persona_ids
),
-- Filter option IDs with counts (names hydrated in Python from cached *_internal() functions)
all_parameter_ids AS (
    SELECT DISTINCT unnest(parameter_ids)::uuid as parameter_id
    FROM field_parameters_agg
),
parameter_option_data AS (
    SELECT
        pr.id,
        (SELECT COUNT(*) FROM fields_data fd WHERE pr.id::text = ANY(fd.parameter_ids))::bigint as count
    FROM parameters_resource pr
    WHERE pr.id IN (SELECT parameter_id FROM all_parameter_ids)
),
all_persona_ids AS (
    SELECT DISTINCT unnest(persona_ids) as persona_id
    FROM fields_data
    WHERE persona_ids IS NOT NULL AND array_length(persona_ids, 1) > 0
),
persona_option_data AS (
    SELECT
        pa.id,
        (SELECT COUNT(*) FROM fields_data fd WHERE pa.id = ANY(fd.persona_ids))::bigint as count
    FROM persona_artifact pa
    WHERE pa.id IN (SELECT persona_id FROM all_persona_ids)
),
department_option_data AS (
    SELECT
        dr.id,
        (SELECT COUNT(*) FROM fields_data)::bigint as count
    FROM departments_resource dr
    WHERE dr.id IN (SELECT department_id FROM user_departments)
)
SELECT
    -- Aggregate fields
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.field_id, fd.name, fd.description, fd.active, fd.created_at, fd.updated_at, fd.department_ids, fd.parameter_ids, fd.conditional_parameter_ids, fd.active_parameter_count, fd.is_inactive, fd.persona_ids)::types.q_list_fields_v4_field
            ORDER BY fd.name
        ) FROM fields_data fd),
        '{}'::types.q_list_fields_v4_field[]
    ) as fields,
    -- Parameter option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (pod.id, pod.count)::types.q_list_fields_v4_option_id
        ) FROM parameter_option_data pod),
        '{}'::types.q_list_fields_v4_option_id[]
    ) as parameter_option_ids,
    -- Persona option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (peod.id, peod.count)::types.q_list_fields_v4_option_id
        ) FROM persona_option_data peod),
        '{}'::types.q_list_fields_v4_option_id[]
    ) as persona_option_ids,
    -- Department option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.id, dod.count)::types.q_list_fields_v4_option_id
        ) FROM department_option_data dod),
        '{}'::types.q_list_fields_v4_option_id[]
    ) as department_option_ids,
    -- Total count
    (SELECT COUNT(*) FROM fields_data)::bigint as total_count
$$;

