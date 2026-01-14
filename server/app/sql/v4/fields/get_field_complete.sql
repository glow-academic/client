-- Unified get field function - handles both new (field_id = NULL) and detail (field_id provided)
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
        WHERE proname = 'api_get_field_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_field_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_field_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_field_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_field_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_field_v4(
    profile_id uuid,
    field_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    field_exists boolean,
    can_edit boolean,
    disabled_reason text,
    group_id uuid,
    -- Field data
    field_id uuid,
    name text,
    description text,
    active boolean,
    department_ids text[],
    parameter_ids text[],
    conditional_parameter_ids text[],
    departments types.q_get_field_v4_department[],
    valid_department_ids text[],
    parameters types.q_get_field_v4_parameter[],
    valid_parameter_ids text[],
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
-- Conditional: Only check field existence if field_id provided
field_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT field_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM fields_resource WHERE id = (SELECT field_id FROM params))::boolean
        END as field_exists
),
-- Draft data
draft_payload_data AS (
    SELECT 
        d.version as draft_version,
        NULL::jsonb as payload
    FROM params x
    LEFT JOIN drafts d ON d.id = x.draft_id
        AND d.profile_id = x.profile_id
),
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT 
        COALESCE(
            d.group_id,
            (SELECT id FROM groups ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN drafts d ON d.id = x.draft_id
    -- Always return at least one row
    WHERE TRUE
    LIMIT 1
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
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Conditional: Get field department data only if field_id provided
field_departments_data AS (
    SELECT 
        fd.field_id,
        ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) as department_ids
    FROM params x
    LEFT JOIN field_departments fd ON fd.field_id = x.field_id AND fd.active = true
    WHERE x.field_id IS NOT NULL
    GROUP BY fd.field_id
),
-- Conditional: Get field parameter data only if field_id provided
field_parameters_data AS (
    SELECT 
        f.id as field_id,
        CASE 
            WHEN (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL THEN ARRAY[(SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)::text]
            ELSE ARRAY[]::text[]
        END as parameter_ids
    FROM params x
    JOIN fields_resource f ON f.id = x.field_id
    WHERE x.field_id IS NOT NULL
),
-- Conditional: Get field conditional parameters only if field_id provided
field_conditional_parameters_data AS (
    SELECT 
        fcp.field_id,
        ARRAY_AGG(fcp.parameter_id::text ORDER BY (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1)) as conditional_parameter_ids
    FROM params x
    JOIN field_parameters fcp ON fcp.field_id = x.field_id AND fcp.active = true AND fcp.type = 'conditional'::type_field_parameters
    JOIN parameters_resource p ON p.id = fcp.parameter_id
    WHERE x.field_id IS NOT NULL
    GROUP BY fcp.field_id
),
-- Valid departments for user
valid_departments_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM department_artifact d
    WHERE d.id IN (SELECT department_id FROM user_departments)
       OR EXISTS (SELECT 1 FROM user_profile WHERE role = 'superadmin'::profile_role)
),
-- Valid parameters for user
valid_parameters_data AS (
    SELECT 
        p.id as parameter_id,
        (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM persona_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description
    FROM parameter_artifact p
    WHERE EXISTS (SELECT 1 FROM persona_flags pf WHERE pf.persona_id = p.id AND pf.type = 'active'::type_persona_flags AND pf.value = true)
),
-- User has field access check (only for detail mode)
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
    FROM params x
    WHERE x.field_id IS NOT NULL
    LIMIT 1
),
-- Can edit logic
can_edit_data AS (
    SELECT 
        CASE 
            WHEN (SELECT field_id FROM params) IS NULL THEN
                -- New mode: can edit if user has departments or is superadmin
                CASE 
                    WHEN EXISTS (SELECT 1 FROM user_departments) THEN true
                    WHEN EXISTS (SELECT 1 FROM user_profile WHERE role = 'superadmin'::profile_role) THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode: can edit based on permissions
                CASE 
                    WHEN COALESCE((SELECT department_ids FROM field_departments_data WHERE field_id = (SELECT field_id FROM params)), NULL) IS NULL 
                         AND NOT EXISTS (SELECT 1 FROM user_profile WHERE role = 'superadmin'::profile_role) THEN false
                    WHEN EXISTS (SELECT 1 FROM user_profile WHERE role IN ('admin'::profile_role, 'superadmin'::profile_role)) THEN true
                    ELSE false
                END
        END as can_edit
),
-- Disabled reason logic
disabled_reason_data AS (
    SELECT 
        CASE 
            WHEN (SELECT can_edit FROM can_edit_data) = false THEN
                CASE 
                    WHEN (SELECT field_id FROM params) IS NULL THEN
                        'No accessible departments found for user'
                    ELSE
                        'You do not have permission to edit this field'
                END
            ELSE NULL
        END as disabled_reason
)
SELECT 
    -- Required fields (first 5)
    up.actor_name,
    COALESCE(fec.field_exists, false)::boolean as field_exists,
    COALESCE(ced.can_edit, false)::boolean as can_edit,
    drd.disabled_reason,
    dgd.group_id,
    -- Field data
    f.id as field_id,
    -- Merge draft payload with field data (draft takes precedence)
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        CASE 
            WHEN (SELECT field_id FROM params) IS NOT NULL THEN
                (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.field_id LIMIT 1)
            ELSE 'New Field'
        END
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        CASE 
            WHEN (SELECT field_id FROM params) IS NOT NULL THEN
                (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1)
            ELSE ''
        END
    ) as description,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        CASE 
            WHEN (SELECT field_id FROM params) IS NOT NULL THEN
                EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = TRUE)
            ELSE true
        END
    ) as active,
    COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'departmentIds')) FROM draft_payload_data),
        fdd.department_ids,
        ARRAY[]::text[]
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
            (vdd.department_id, vdd.name, vdd.description)::types.q_get_field_v4_department
            ORDER BY vdd.name
        ) FROM valid_departments_data vdd),
        '{}'::types.q_get_field_v4_department[]
    ) as departments,
    -- Valid department IDs
    (SELECT COALESCE(array_agg(department_id::text), ARRAY[]::text[])
     FROM valid_departments_data) as valid_department_ids,
    -- Aggregate parameters
    COALESCE(
        (SELECT ARRAY_AGG(
            (vpd.parameter_id, vpd.name, vpd.description)::types.q_get_field_v4_parameter
            ORDER BY vpd.name
        ) FROM valid_parameters_data vpd),
        '{}'::types.q_get_field_v4_parameter[]
    ) as parameters,
    -- Valid parameter IDs
    (SELECT COALESCE(array_agg(parameter_id::text), ARRAY[]::text[])
     FROM valid_parameters_data) as valid_parameter_ids,
    -- Draft version
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version
FROM field_exists_check fec
CROSS JOIN user_profile up
CROSS JOIN draft_group_data dgd
CROSS JOIN can_edit_data ced
CROSS JOIN disabled_reason_data drd
LEFT JOIN params x ON true
LEFT JOIN fields_resource f ON f.id = x.field_id 
    AND (
        (SELECT field_id FROM params) IS NULL 
        OR EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true)
    )
LEFT JOIN field_departments_data fdd ON fdd.field_id = f.id
LEFT JOIN field_parameters_data fpd ON fpd.field_id = f.id
LEFT JOIN field_conditional_parameters_data fcpd ON fcpd.field_id = f.id
LEFT JOIN draft_payload_data dpd ON true
LEFT JOIN user_has_field_access uha ON (SELECT field_id FROM params) IS NOT NULL
WHERE 
    -- For new mode: always return
    (SELECT field_id FROM params) IS NULL
    OR
    -- For detail mode: only return if field exists and user has access
    (
        COALESCE(fec.field_exists, false) = true
        AND (
            COALESCE((SELECT has_access FROM user_has_field_access), false) = true
            OR fec.field_exists = false
        )
    )
$$;
