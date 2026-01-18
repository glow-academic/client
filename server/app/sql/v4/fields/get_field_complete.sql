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

CREATE TYPE types.q_get_field_v4_name_resource AS (
    name_id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_field_v4_description_resource AS (
    description_id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_field_v4_flag_resource AS (
    flag_id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean
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
    name_id uuid,
    name_resource types.q_get_field_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_field_v4_name_resource[],
    description_id uuid,
    description_resource types.q_get_field_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_field_v4_description_resource[],
    -- Single-select resources: active flag
    active_flag_id uuid,
    active_flag_resource types.q_get_field_v4_flag_resource,
    show_active_flag boolean,
    active_flag_agent_id uuid,
    active_flag_required boolean,
    name text,
    description text,
    active boolean,
    department_ids text[],
    department_resources types.q_get_field_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_field_v4_department[],
    parameter_ids text[],
    parameter_resources types.q_get_field_v4_parameter[],
    show_parameters boolean,
    parameters_agent_id uuid,
    parameters_required boolean,
    parameter_suggestions uuid[],
    valid_department_ids text[],
    conditional_parameter_ids text[],
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
        COALESCE(
            ARRAY_AGG(pf.parameter_id::text ORDER BY pf.created_at) FILTER (WHERE pf.parameter_id IS NOT NULL),
            ARRAY[]::text[]
        ) as parameter_ids
    FROM params x
    JOIN fields_resource f ON f.id = x.field_id
    LEFT JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
    WHERE x.field_id IS NOT NULL
    GROUP BY f.id
),
-- Conditional: Get field conditional parameters only if field_id provided
field_conditional_parameters_data AS (
    SELECT 
        fcp.field_id,
        ARRAY_AGG(
            fcp.parameter_id::text
            ORDER BY (
                SELECT n.name
                FROM parameter_names pn
                JOIN names_resource n ON pn.name_id = n.id
                WHERE pn.parameter_id = p.id
                LIMIT 1
            )
        ) as conditional_parameter_ids
    FROM params x
    JOIN field_parameters fcp ON fcp.field_id = x.field_id AND fcp.active = true AND fcp.type = 'conditional'::type_field_parameters
    JOIN parameters_resource p ON p.id = fcp.parameter_id
    WHERE x.field_id IS NOT NULL
    GROUP BY fcp.field_id
),
name_id_data AS (
    SELECT 
        CASE 
            WHEN (SELECT field_id FROM params) IS NULL THEN NULL::uuid
            ELSE (SELECT fn.name_id FROM field_names fn WHERE fn.field_id = (SELECT field_id FROM params) LIMIT 1)
        END as name_id
    FROM params
    LIMIT 1
),
description_id_data AS (
    SELECT 
        CASE 
            WHEN (SELECT field_id FROM params) IS NULL THEN NULL::uuid
            ELSE (SELECT fd.description_id FROM field_descriptions fd WHERE fd.field_id = (SELECT field_id FROM params) LIMIT 1)
        END as description_id
    FROM params
    LIMIT 1
),
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(fn.name_id ORDER BY fn.created_at DESC)
             FROM (
                 SELECT DISTINCT fn.name_id, MAX(fn.created_at) as created_at
                 FROM field_names fn
                 JOIN names_resource n ON n.id = fn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE fn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       COALESCE(n.generated, false) = false
                       OR (
                           COALESCE(n.generated, false) = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = n.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY fn.name_id
                 ORDER BY MAX(fn.created_at) DESC
                 LIMIT 20
             ) fn),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    LIMIT 1
),
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_field_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_field_v4_name_resource[]
        ) as names
    FROM params
    LIMIT 1
),
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(fd.description_id ORDER BY fd.created_at DESC)
             FROM (
                 SELECT DISTINCT fd.description_id, MAX(fd.created_at) as created_at
                 FROM field_descriptions fd
                 JOIN descriptions_resource d ON d.id = fd.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE fd.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       COALESCE(d.generated, false) = false
                       OR (
                           COALESCE(d.generated, false) = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = d.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY fd.description_id
                 ORDER BY MAX(fd.created_at) DESC
                 LIMIT 20
             ) fd),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    LIMIT 1
),
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_field_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_field_v4_description_resource[]
        ) as descriptions
    FROM params
    LIMIT 1
),
active_flag_id_data AS (
    SELECT 
        CASE 
            WHEN (SELECT field_id FROM params) IS NULL THEN NULL::uuid
            ELSE (
                SELECT ff.flag_id
                FROM field_flags ff
                JOIN flags_resource f ON f.id = ff.flag_id
                WHERE ff.field_id = (SELECT field_id FROM params)
                  AND f.name = 'active'
                  AND ff.value = true
                LIMIT 1
            )
        END as active_flag_id
    FROM params
    LIMIT 1
),
active_flag_resource_data AS (
    SELECT 
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_field_v4_flag_resource
            FROM flags_resource f
            WHERE f.id = (SELECT active_flag_id FROM active_flag_id_data)
            LIMIT 1
        ) as active_flag_resource
    FROM params
    LIMIT 1
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
        (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM parameter_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), '') as description
    FROM parameter_artifact p
    WHERE EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'active' AND pf.value = true)
),
department_ids_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'departmentIds')) FROM draft_payload_data),
            fdd.department_ids,
            ARRAY[]::text[]
        ) as department_ids
    FROM params x
    LEFT JOIN field_departments_data fdd ON fdd.field_id = x.field_id
    LIMIT 1
),
parameter_ids_data AS (
    SELECT 
        COALESCE(
            fpd.parameter_ids,
            ARRAY[]::text[]
        ) as parameter_ids
    FROM params x
    LEFT JOIN field_parameters_data fpd ON fpd.field_id = x.field_id
    LIMIT 1
),
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(fd.department_id ORDER BY fd.created_at DESC)
             FROM (
                 SELECT DISTINCT fd.department_id, MAX(fd.created_at) as created_at
                 FROM field_departments fd
                 JOIN departments_resource d ON d.id = fd.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE fd.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
                   AND (
                       fd.active = true
                       OR (
                           fd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = d.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY fd.department_id
                 ORDER BY MAX(fd.created_at) DESC
                 LIMIT 20
             ) fd),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    LIMIT 1
),
parameter_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pf.parameter_id ORDER BY pf.created_at DESC)
             FROM (
                 SELECT DISTINCT pf.parameter_id, MAX(pf.created_at) as created_at
                 FROM parameter_fields pf
                 JOIN parameter_artifact p ON p.id = pf.parameter_id
                 LEFT JOIN parameters_resource pr ON pr.parameter_id = p.id
                 CROSS JOIN draft_group_data dgd
                 WHERE pf.parameter_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM parameter_flags pf2 JOIN flags_resource f ON pf2.flag_id = f.id WHERE pf2.parameter_id = p.id AND f.name = 'active' AND pf2.value = true)
                   AND (
                       pf.generated = false
                       OR (
                           pf.generated = true
                           AND COALESCE(pr.generated, false) = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = pr.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pf.parameter_id
                 ORDER BY MAX(pf.created_at) DESC
                 LIMIT 20
             ) pf),
            ARRAY[]::uuid[]
        ) as parameter_suggestions
    FROM params
    LIMIT 1
),
department_resources_data AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (vdd.department_id, vdd.name, vdd.description)::types.q_get_field_v4_department
                    ORDER BY array_position(did.department_ids, vdd.department_id::text)
                )
                FROM department_ids_data did
                JOIN valid_departments_data vdd ON vdd.department_id::text = ANY(did.department_ids)
            ),
            '{}'::types.q_get_field_v4_department[]
        ) as department_resources
    FROM params
    LIMIT 1
),
parameter_resources_data AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (vpd.parameter_id, vpd.name, vpd.description)::types.q_get_field_v4_parameter
                    ORDER BY array_position(pid.parameter_ids, vpd.parameter_id::text)
                )
                FROM parameter_ids_data pid
                JOIN valid_parameters_data vpd ON vpd.parameter_id::text = ANY(pid.parameter_ids)
            ),
            '{}'::types.q_get_field_v4_parameter[]
        ) as parameter_resources
    FROM params
    LIMIT 1
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
    nid.name_id,
    (
        SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_field_v4_name_resource
        FROM names_resource n
        WHERE n.id = nid.name_id
        LIMIT 1
    ) as name_resource,
    true as show_name,
    NULL::uuid as name_agent_id,
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    (SELECT names FROM names_suggestions_objects) as names,
    did.description_id,
    (
        SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_field_v4_description_resource
        FROM descriptions_resource d
        WHERE d.id = did.description_id
        LIMIT 1
    ) as description_resource,
    true as show_description,
    NULL::uuid as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    (SELECT descriptions FROM descriptions_suggestions_objects) as descriptions,
    (SELECT active_flag_id FROM active_flag_id_data) as active_flag_id,
    (SELECT active_flag_resource FROM active_flag_resource_data) as active_flag_resource,
    true as show_active_flag,
    NULL::uuid as active_flag_agent_id,
    false as active_flag_required,
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
                EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = TRUE)
            ELSE true
        END
    ) as active,
    (SELECT department_ids FROM department_ids_data) as department_ids,
    (SELECT department_resources FROM department_resources_data) as department_resources,
    CASE 
        WHEN (SELECT COUNT(*) FROM valid_departments_data) > 0 THEN true
        ELSE false
    END as show_departments,
    NULL::uuid as departments_agent_id,
    false as departments_required,
    COALESCE((SELECT department_suggestions FROM department_suggestions_data), ARRAY[]::uuid[]) as department_suggestions,
    -- Aggregate departments
    COALESCE(
        (SELECT ARRAY_AGG(
            (vdd.department_id, vdd.name, vdd.description)::types.q_get_field_v4_department
            ORDER BY vdd.name
        ) FROM valid_departments_data vdd),
        '{}'::types.q_get_field_v4_department[]
    ) as departments,
    (SELECT parameter_ids FROM parameter_ids_data) as parameter_ids,
    (SELECT parameter_resources FROM parameter_resources_data) as parameter_resources,
    CASE 
        WHEN (SELECT COUNT(*) FROM valid_parameters_data) > 0 THEN true
        ELSE false
    END as show_parameters,
    NULL::uuid as parameters_agent_id,
    false as parameters_required,
    COALESCE((SELECT parameter_suggestions FROM parameter_suggestions_data), ARRAY[]::uuid[]) as parameter_suggestions,
    -- Valid department IDs
    (SELECT COALESCE(array_agg(department_id::text), ARRAY[]::text[])
     FROM valid_departments_data) as valid_department_ids,
    COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'conditionalParameterIds')) FROM draft_payload_data),
        fcpd.conditional_parameter_ids,
        ARRAY[]::text[]
    ) as conditional_parameter_ids,
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
        OR EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
    )
LEFT JOIN field_departments_data fdd ON fdd.field_id = f.id
LEFT JOIN field_parameters_data fpd ON fpd.field_id = f.id
LEFT JOIN field_conditional_parameters_data fcpd ON fcpd.field_id = f.id
LEFT JOIN name_id_data nid ON true
LEFT JOIN description_id_data did ON true
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
