-- Get default parameter detail for creation
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_parameter_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_parameter_new_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- If any other object depends on them, this will ERROR and stop the migration (good)
DROP TYPE IF EXISTS types.q_get_parameter_new_v4_department;
DROP TYPE IF EXISTS types.q_get_parameter_new_v4_field;
DROP TYPE IF EXISTS types.q_get_parameter_new_v4_item;
DROP TYPE IF EXISTS types.q_get_parameter_new_v4_field_connection;
DROP TYPE IF EXISTS types.q_get_parameter_new_v4_persona;
DROP TYPE IF EXISTS types.q_get_parameter_new_v4_document;

-- 3) Recreate types
CREATE TYPE types.q_get_parameter_new_v4_department AS (
    department_id uuid,  -- ✅ Native uuid type
    name text,
    description text
);

CREATE TYPE types.q_get_parameter_new_v4_field AS (
    field_id uuid,  -- ✅ Native uuid type
    name text,
    description text,
    usage_count bigint,
    department_ids text[]  -- ✅ text[] for arrays
);

CREATE TYPE types.q_get_parameter_new_v4_item AS (
    parameter_item_id uuid,  -- ✅ Native uuid type
    name text,
    description text,
    "default" boolean,
    usage_count bigint,
    department_ids text[]  -- ✅ text[] for arrays
);

CREATE TYPE types.q_get_parameter_new_v4_field_connection AS (
    field_id uuid,  -- ✅ Native uuid type
    "default" boolean,
    active boolean
);

CREATE TYPE types.q_get_parameter_new_v4_persona AS (
    persona_id uuid,  -- ✅ Native uuid type
    name text,
    description text
);

CREATE TYPE types.q_get_parameter_new_v4_document AS (
    document_id uuid,  -- ✅ Native uuid type
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_parameter_new_v4(
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    user_role text,
    primary_department_id text,
    name text,
    description text,
    active boolean,
    simulation_parameter boolean,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean,
    department_ids text[],
    parameter_items types.q_get_parameter_new_v4_item[],
    departments types.q_get_parameter_new_v4_department[],
    valid_department_ids text[],
    fields types.q_get_parameter_new_v4_field[],
    valid_field_ids text[],
    field_connections types.q_get_parameter_new_v4_field_connection[],
    persona_ids text[],
    personas types.q_get_parameter_new_v4_persona[],
    valid_persona_ids text[],
    document_ids text[],
    documents types.q_get_parameter_new_v4_document[],
    valid_document_ids text[],
    can_edit boolean,
    draft_version int,
    field_ids jsonb,
    field_active_states jsonb,
    field_default_states jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        d.payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    AND d.resource_type = 'parameters'::draft_resource_type
    LIMIT 1
),
actor_profile AS (
    SELECT 
        p.id as profile_id,
        p.role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
    WHERE pd.active = true
),
field_departments_for_filter AS (
    SELECT DISTINCT
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        fd.department_id
    FROM fields f
    JOIN field_departments fd ON fd.field_id = f.id
    WHERE EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = true) AND fd.active = true AND (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
),
default_parameter AS (
    SELECT p.id
    FROM parameters p
    LEFT JOIN field_departments_for_filter fdf ON fdf.parameter_id = p.id
    WHERE EXISTS (SELECT 1 FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = true)
    GROUP BY p.id
    HAVING 
        -- Include if has matching department link via parameter_departments or field_departments OR has no department links at all (cross-dept)
        COUNT(fdf.parameter_id) FILTER (WHERE fdf.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (
            SELECT 1 FROM parameter_departments pd2 WHERE pd2.parameter_id = p.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM field_departments fd2 
            JOIN fields f2 ON f2.id = fd2.field_id 
            JOIN parameter_fields pf2 ON pf2.field_id = f2.id WHERE pf2.parameter_id = p.id AND EXISTS (SELECT 1 FROM field_flags ff2 JOIN flags fl ON ff2.flag_id = fl.id WHERE ff2.field_id = f2.id AND fl.name = 'active' AND ff2.type = 'active'::type_field_flags AND ff2.value = TRUE) AND fd2.active = true
        )
    ORDER BY p.created_at DESC
    LIMIT 1
),
parameter_departments_aggregated AS (
    -- Get parameter-level departments (union of parameter_departments and field_departments)
    SELECT 
        ARRAY_AGG(DISTINCT dept_id::text ORDER BY dept_id::text) as department_ids
    FROM (
        -- Parameter-level departments
        SELECT pd.department_id as dept_id
        FROM parameter_departments pd
        JOIN default_parameter dp ON pd.parameter_id = dp.id
        WHERE pd.active = true
        UNION
        -- Field-level departments
        SELECT fd.department_id as dept_id
        FROM fields f
        JOIN default_parameter dp ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = dp.id
        JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
        WHERE EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = true)
    ) combined_depts
),
parameter_data AS (
    SELECT 
        (SELECT n.name FROM parameter_names pn JOIN names n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        (SELECT d.description FROM parameter_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1),
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = p.id AND fl.name = 'active' AND paf.type = 'active'::type_parameter_flags AND paf.value = TRUE) as active,
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = p.id AND fl.name = 'simulation_parameter' AND paf.type = 'simulation_parameter'::type_parameter_flags AND paf.value = TRUE) as simulation_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = p.id AND fl.name = 'document_parameter' AND paf.type = 'document_parameter'::type_parameter_flags AND paf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = p.id AND fl.name = 'persona_parameter' AND paf.type = 'persona_parameter'::type_parameter_flags AND paf.value = TRUE) as persona_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = p.id AND fl.name = 'scenario_parameter' AND paf.type = 'scenario_parameter'::type_parameter_flags AND paf.value = TRUE) as scenario_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = p.id AND fl.name = 'video_parameter' AND paf.type = 'video_parameter'::type_parameter_flags AND paf.value = TRUE) as video_parameter,
        COALESCE(pda.department_ids, NULL) as department_ids
    FROM parameters p
    JOIN default_parameter dp ON p.id = dp.id
    LEFT JOIN parameter_departments_aggregated pda ON true
),
-- All available fields (not just connected ones)
all_fields_data AS (
    SELECT 
        f.id as field_id,
        COALESCE(ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) FILTER (WHERE fd.department_id IS NOT NULL), ARRAY[]::text[]) as department_ids
    FROM fields f
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = true)
    GROUP BY f.id
),
all_fields_with_usage AS (
    SELECT 
        f.id,
        (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        (SELECT d.description FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(afd.department_ids, ARRAY[]::text[]) as department_ids
    FROM fields f
    LEFT JOIN all_fields_data afd ON afd.field_id = f.id
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    WHERE EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = true)
    GROUP BY f.id, (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), afd.department_ids
),
-- Parameter items from default parameter (fields connected to default parameter)
field_departments_data AS (
    SELECT 
        f.id as parameter_item_id,
        COALESCE(ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) FILTER (WHERE fd.department_id IS NOT NULL), ARRAY[]::text[]) as department_ids
    FROM fields f
    JOIN default_parameter dp ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = dp.id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = true)
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    GROUP BY f.id
),
parameter_items_with_usage AS (
    SELECT 
        f.id,
        (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        (SELECT d.description FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
        false as "default",  -- Default flag no longer available after denormalization
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(fdd.department_ids, ARRAY[]::text[]) as department_ids
    FROM fields f
    JOIN default_parameter dp ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = dp.id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = true)
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    LEFT JOIN field_departments_data fdd ON fdd.parameter_item_id = f.id
    GROUP BY f.id, (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), fdd.department_ids
),
-- Valid departments (user's departments)
valid_depts AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1), '') as description
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
    JOIN departments d ON d.id = pd.department_id
    WHERE EXISTS (SELECT 1 FROM document_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.document_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_document_flags AND df.value = true)
),
primary_department_id AS (
    SELECT department_id::text
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
    WHERE pd.is_primary = TRUE
    LIMIT 1
),
-- Personas filtered by user's available departments
filtered_personas AS (
    SELECT DISTINCT p.id, (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1), COALESCE((SELECT d.description FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id
    CROSS JOIN user_departments ud
    WHERE EXISTS (SELECT 1 FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = true)
    AND (
        -- Include if persona is in user's departments
        pd.department_id = ud.department_id
        -- Or if persona has no department restrictions (cross-department persona)
        OR NOT EXISTS (
            SELECT 1 FROM persona_departments pd2 
            WHERE pd2.persona_id = p.id AND pd2.active = true
        )
    )
),
-- Documents filtered by user's available departments
filtered_documents AS (
    SELECT DISTINCT d.id, (SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1), COALESCE((SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1), '') as description
    FROM documents d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    CROSS JOIN user_departments ud
    WHERE EXISTS (SELECT 1 FROM document_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.document_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_document_flags AND df.value = true)
    AND (
        -- Include if document is in user's departments
        dd.department_id = ud.department_id
        -- Or if document has no department restrictions (cross-department document)
        OR NOT EXISTS (
            SELECT 1 FROM document_departments dd2 
            WHERE dd2.document_id = d.id AND dd2.active = true
        )
    )
)
SELECT 
    ap.actor_name::text as actor_name,
    ap.role::text as user_role,
    COALESCE(pdi.department_id, NULL)::text as primary_department_id,
    -- Default values for new parameter (merged with draft payload if draft_id provided)
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        pd.name::text
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        pd.description::text
    ) as description,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        pd.active::boolean
    ) as active,
    COALESCE(
        (SELECT (payload->>'simulation_parameter')::boolean FROM draft_payload_data),
        (SELECT (payload->>'simulationParameter')::boolean FROM draft_payload_data),
        pd.simulation_parameter::boolean
    ) as simulation_parameter,
    COALESCE(
        (SELECT (payload->>'document_parameter')::boolean FROM draft_payload_data),
        (SELECT (payload->>'documentParameter')::boolean FROM draft_payload_data),
        pd.document_parameter::boolean
    ) as document_parameter,
    COALESCE(
        (SELECT (payload->>'persona_parameter')::boolean FROM draft_payload_data),
        (SELECT (payload->>'personaParameter')::boolean FROM draft_payload_data),
        pd.persona_parameter::boolean
    ) as persona_parameter,
    COALESCE(
        (SELECT (payload->>'scenario_parameter')::boolean FROM draft_payload_data),
        (SELECT (payload->>'scenarioParameter')::boolean FROM draft_payload_data),
        pd.scenario_parameter::boolean
    ) as scenario_parameter,
    COALESCE(
        (SELECT (payload->>'video_parameter')::boolean FROM draft_payload_data),
        (SELECT (payload->>'videoParameter')::boolean FROM draft_payload_data),
        pd.video_parameter::boolean
    ) as video_parameter,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))::text[]
                WHEN payload->'departmentIds' IS NOT NULL AND jsonb_typeof(payload->'departmentIds') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'departmentIds'))::text[]
                ELSE NULL
            END
        FROM draft_payload_data),
        pd.department_ids
    ) as department_ids,
    -- Parameter items (from default parameter)
    COALESCE(
        (SELECT ARRAY_AGG(
            (piwu.id, piwu.name, piwu.description, piwu."default", piwu.usage_count, piwu.department_ids)::types.q_get_parameter_new_v4_item
            ORDER BY piwu.name
        ) FROM parameter_items_with_usage piwu),
        '{}'::types.q_get_parameter_new_v4_item[]
    ) as parameter_items,
    -- Departments (user's valid departments)
    COALESCE(
        (SELECT ARRAY_AGG(
            (vd.department_id, vd.name, vd.description)::types.q_get_parameter_new_v4_department
            ORDER BY vd.name
        ) FROM valid_depts vd),
        '{}'::types.q_get_parameter_new_v4_department[]
    ) as departments,
    -- Valid department IDs
    COALESCE(
        (SELECT ARRAY_AGG(vd.department_id::text ORDER BY vd.department_id)
         FROM valid_depts vd),
        ARRAY[]::text[]
    ) as valid_department_ids,
    -- Fields (all available fields)
    COALESCE(
        (SELECT ARRAY_AGG(
            (afwu.id, afwu.name, afwu.description, afwu.usage_count, afwu.department_ids)::types.q_get_parameter_new_v4_field
            ORDER BY afwu.name
        ) FROM all_fields_with_usage afwu),
        '{}'::types.q_get_parameter_new_v4_field[]
    ) as fields,
    -- Valid field IDs
    COALESCE(
        (SELECT ARRAY_AGG(afwu.id::text ORDER BY afwu.id)
         FROM all_fields_with_usage afwu),
        ARRAY[]::text[]
    ) as valid_field_ids,
    -- Field connections (empty for new parameter)
    '{}'::types.q_get_parameter_new_v4_field_connection[] as field_connections,
    -- Persona IDs (empty for new)
    ARRAY[]::text[] as persona_ids,
    -- Personas (filtered by user's departments)
    COALESCE(
        (SELECT ARRAY_AGG(
            (fp.id, fp.name, fp.description)::types.q_get_parameter_new_v4_persona
            ORDER BY fp.name
        ) FROM filtered_personas fp),
        '{}'::types.q_get_parameter_new_v4_persona[]
    ) as personas,
    -- Valid persona IDs
    COALESCE(
        (SELECT ARRAY_AGG(fp.id::text ORDER BY fp.id)
         FROM filtered_personas fp),
        ARRAY[]::text[]
    ) as valid_persona_ids,
    -- Document IDs (empty for new)
    ARRAY[]::text[] as document_ids,
    -- Documents (filtered by user's departments)
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.id, fd.name, fd.description)::types.q_get_parameter_new_v4_document
            ORDER BY fd.name
        ) FROM filtered_documents fd),
        '{}'::types.q_get_parameter_new_v4_document[]
    ) as documents,
    -- Valid document IDs
    COALESCE(
        (SELECT ARRAY_AGG(fd.id::text ORDER BY fd.id)
         FROM filtered_documents fd),
        ARRAY[]::text[]
    ) as valid_document_ids,
    -- Can edit (based on role and default parameter logic)
    CASE 
        WHEN (pd.department_ids IS NULL OR array_length(pd.department_ids, 1) = 0) AND ap.role != 'superadmin' THEN false::boolean
        WHEN ap.role = 'superadmin'::profile_role THEN true::boolean
        WHEN ap.role IN ('admin'::profile_role, 'instructional'::profile_role) THEN true::boolean
        ELSE false::boolean
    END as can_edit,
    -- Draft version (from draft payload if exists)
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version,
    -- Extract field_ids from draft payload if available (support both camelCase and snake_case)
    COALESCE(
        (SELECT payload->'fieldIds' FROM draft_payload_data),
        (SELECT payload->'field_ids' FROM draft_payload_data),
        '[]'::jsonb
    ) as field_ids,
    -- Extract field_active_states from draft payload if available (support both camelCase and snake_case)
    COALESCE(
        (SELECT payload->'fieldActiveStates' FROM draft_payload_data),
        (SELECT payload->'field_active_states' FROM draft_payload_data),
        '{}'::jsonb
    ) as field_active_states,
    -- Extract field_default_states from draft payload if available (support both camelCase and snake_case)
    COALESCE(
        (SELECT payload->'fieldDefaultStates' FROM draft_payload_data),
        (SELECT payload->'field_default_states' FROM draft_payload_data),
        '{}'::jsonb
    ) as field_default_states
FROM actor_profile ap
CROSS JOIN parameter_data pd
LEFT JOIN primary_department_id pdi ON true
$$;