-- Get field detail with permissions and relationships
-- Converted to function with composite types
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_field_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_field_detail_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DROP TYPE IF EXISTS types.q_get_field_detail_v4_department;
DROP TYPE IF EXISTS types.q_get_field_detail_v4_parameter;

-- 3) Recreate types
CREATE TYPE types.q_get_field_detail_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_field_detail_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_field_detail_v4(
    field_id uuid,
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    field_exists boolean,
    field_id uuid,
    name text,
    description text,
    active boolean,
    department_ids text[],
    parameter_ids text[],
    conditional_parameter_ids text[],
    departments types.q_get_field_detail_v4_department[],
    valid_department_ids text[],
    parameters types.q_get_field_detail_v4_parameter[],
    valid_parameter_ids text[],
    can_edit boolean,
    actor_name text,
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        field_id AS field_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        d.version as draft_version,
        NULL::jsonb as payload
    FROM params x
    LEFT JOIN drafts d ON d.id = x.draft_id
        
        AND d.profile_id = x.profile_id
),
field_exists_check AS (
    -- Check if field exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM field_artifact WHERE id = (SELECT field_id FROM params)
    )::boolean as field_exists
),
user_profile AS (
    SELECT 
        up.id,
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = up.id 
         LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = up.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = up.id AND pn2.type = 'last' LIMIT 1), 'System') as actor_name
    FROM params x
    JOIN profile_artifact up ON up.id = x.profile_id
),
field_parameters_data AS (
    SELECT 
        f.id as field_id,
        CASE 
            WHEN (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL THEN ARRAY[(SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)::text]
            ELSE ARRAY[]::text[]
        END as parameter_ids
    FROM params x
    JOIN fields_resource f ON f.id = x.field_id
),
field_conditional_parameters_data AS (
    SELECT 
        fcp.field_id,
        ARRAY_AGG(fcp.conditional_parameter_id::text ORDER BY (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1)) as conditional_parameter_ids
    FROM params x
    JOIN field_conditional_parameters fcp ON fcp.field_id = x.field_id AND fcp.active = true
    JOIN parameters_resource p ON p.id = fcp.conditional_parameter_id
    GROUP BY fcp.field_id
),
field_departments_data AS (
    SELECT 
        fd.field_id,
        ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) as department_ids
    FROM params x
    LEFT JOIN field_departments fd ON fd.field_id = x.field_id AND fd.active = true
    GROUP BY fd.field_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
valid_departments_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM department_artifact d
    WHERE d.id IN (SELECT department_id FROM user_departments)
       OR EXISTS (SELECT 1 FROM user_profile WHERE role = 'superadmin'::profile_role)
),
valid_parameters_data AS (
    SELECT 
        p.id as parameter_id,
        (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM persona_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description
    FROM parameter_artifact p
    WHERE EXISTS (SELECT 1 FROM persona_flags pf WHERE pf.persona_id = p.id AND pf.type = 'active'::type_persona_flags AND pf.value = true)
),
user_has_field_access AS (
    SELECT EXISTS(
        SELECT 1 FROM field_departments fd
        JOIN profile_departments pd ON pd.department_id = fd.department_id
        WHERE fd.field_id = (SELECT field_id FROM params)
        AND fd.active = true
        AND pd.profile_id = (SELECT profile_id FROM params)
        AND pd.active = true
    ) OR EXISTS(
        SELECT 1 FROM params x
        JOIN profile_artifact p ON p.id = x.profile_id
        WHERE EXISTS (
            SELECT 1 FROM profile_roles pr_j 
            JOIN roles_resource r ON pr_j.role_id = r.id 
            WHERE pr_j.profile_id = p.id 
            AND r.role = 'superadmin'::profile_role
        )
    ) OR (
        SELECT NOT EXISTS(
            SELECT 1 FROM field_departments fd2
            WHERE fd2.field_id = (SELECT field_id FROM params)
            AND fd2.active = true
        )
    ) as has_access
)
SELECT 
    -- Field existence check (always returned)
    fec.field_exists::boolean as field_exists,
    f.id as field_id,
    -- Merge draft payload with field data (draft takes precedence)
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1)
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1)
    ) as description,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = TRUE)
    ) as active,
    COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'departmentIds')) FROM draft_payload_data),
        fdd.department_ids,
        NULL
    ) as department_ids,
    COALESCE(fpd.parameter_ids, ARRAY[]::text[]) as parameter_ids,
    COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'conditionalParameterIds')) FROM draft_payload_data),
        fcpd.conditional_parameter_ids,
        ARRAY[]::text[]
    ) as conditional_parameter_ids,
    -- Aggregate departments
    COALESCE(
        (SELECT ARRAY_AGG(
            (vdd.department_id, vdd.name, vdd.description)::types.q_get_field_detail_v4_department
            ORDER BY vdd.name
        ) FROM valid_departments_data vdd),
        '{}'::types.q_get_field_detail_v4_department[]
    ) as departments,
    -- Valid department IDs
    (SELECT COALESCE(array_agg(department_id::text), ARRAY[]::text[])
     FROM valid_departments_data) as valid_department_ids,
    -- Aggregate parameters
    COALESCE(
        (SELECT ARRAY_AGG(
            (vpd.parameter_id, vpd.name, vpd.description)::types.q_get_field_detail_v4_parameter
            ORDER BY vpd.name
        ) FROM valid_parameters_data vpd),
        '{}'::types.q_get_field_detail_v4_parameter[]
    ) as parameters,
    -- Valid parameter IDs
    (SELECT COALESCE(array_agg(parameter_id::text), ARRAY[]::text[])
     FROM valid_parameters_data) as valid_parameter_ids,
    CASE 
        WHEN COALESCE(fdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
        WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_edit,
    up.actor_name,
    -- Draft version
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version
FROM field_exists_check fec
CROSS JOIN user_profile up
LEFT JOIN params x ON true
LEFT JOIN fields_resource f ON f.id = x.field_id AND EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true)
LEFT JOIN field_departments_data fdd ON fdd.field_id = f.id
LEFT JOIN field_parameters_data fpd ON fpd.field_id = f.id
LEFT JOIN field_conditional_parameters_data fcpd ON fcpd.field_id = f.id
CROSS JOIN user_has_field_access uha
LEFT JOIN draft_payload_data dpd ON true
WHERE uha.has_access = true OR fec.field_exists = false
$$;