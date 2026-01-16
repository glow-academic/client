-- Get parameter detail with nested items and relationships
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
        WHERE proname = 'api_get_parameter_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_parameter_detail_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE (drop types that depend on other types first)
DROP TYPE IF EXISTS types.q_get_parameter_detail_v4_item;
DROP TYPE IF EXISTS types.q_get_parameter_detail_v4_department;
DROP TYPE IF EXISTS types.q_get_parameter_detail_v4_field;
DROP TYPE IF EXISTS types.q_get_parameter_detail_v4_field_connection;
DROP TYPE IF EXISTS types.q_get_parameter_detail_v4_persona;
DROP TYPE IF EXISTS types.q_get_parameter_detail_v4_document;

-- 3) Recreate types
CREATE TYPE types.q_get_parameter_detail_v4_item AS (
    parameter_item_id uuid,
    name text,
    description text,
    "default" boolean,
    usage_count bigint,
    department_ids text[]
);

CREATE TYPE types.q_get_parameter_detail_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_parameter_detail_v4_field AS (
    field_id uuid,
    name text,
    description text,
    usage_count bigint,
    department_ids text[]
);

CREATE TYPE types.q_get_parameter_detail_v4_field_connection AS (
    field_id uuid,
    "default" boolean,
    active boolean
);

CREATE TYPE types.q_get_parameter_detail_v4_persona AS (
    persona_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_parameter_detail_v4_document AS (
    document_id uuid,
    name text,
    description text
);


-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_parameter_detail_v4(
    parameter_id uuid,
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    parameter_exists boolean,
    name text,
    description text,
    active boolean,
    simulation_parameter boolean,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean,
    department_ids text[],
    persona_ids text[],
    document_ids text[],
    parameter_items types.q_get_parameter_detail_v4_item[],
    departments types.q_get_parameter_detail_v4_department[],
    valid_department_ids text[],
    fields types.q_get_parameter_detail_v4_field[],
    valid_field_ids text[],
    field_connections types.q_get_parameter_detail_v4_field_connection[],
    personas types.q_get_parameter_detail_v4_persona[],
    valid_persona_ids text[],
    documents types.q_get_parameter_detail_v4_document[],
    valid_document_ids text[],
    can_edit boolean,
    actor_name text,
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
        parameter_id AS parameter_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    
    LIMIT 1
),
parameter_exists_check AS (
    -- Check if parameter exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM parameter_artifact WHERE id = (SELECT parameter_id FROM params)
    )::boolean as parameter_exists
),
user_profile AS (
    SELECT 
        up.id,
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = up.id 
         LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = up.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = up.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact up ON up.id = x.profile_id
),
parameter_active_scenario_links AS (
    SELECT 
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        COUNT(DISTINCT sf.scenario_id) as active_scenario_count
    FROM params x
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = x.parameter_id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
    JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    GROUP BY (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)
),
field_departments_data AS (
    SELECT 
        f.id as field_id,
        COALESCE(ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) FILTER (WHERE fd.department_id IS NOT NULL), ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = x.parameter_id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    GROUP BY f.id
),
parameter_departments_aggregated AS (
    SELECT 
        ARRAY_AGG(DISTINCT dept_id::text ORDER BY dept_id::text) as department_ids
    FROM (
        SELECT pd.department_id as dept_id
        FROM params x
        JOIN parameter_departments pd ON pd.parameter_id = x.parameter_id
        UNION
        SELECT fd.department_id as dept_id
        FROM params x
        JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = x.parameter_id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
        JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    ) combined_depts
),
user_has_parameter_access AS (
    SELECT EXISTS(
        SELECT 1 FROM parameter_departments pd
        JOIN profile_departments pdp ON pdp.department_id = pd.department_id
        WHERE pd.parameter_id = (SELECT parameter_id FROM params)
        AND pdp.profile_id = (SELECT profile_id FROM params)
        AND pdp.active = true
    ) OR EXISTS(
        SELECT 1 FROM field_departments fd
        JOIN profile_departments pd ON pd.department_id = fd.department_id
        JOIN fields_resource f ON f.id = fd.field_id
        WHERE (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = (SELECT parameter_id FROM params)
        AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
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
        (SELECT COUNT(*) FROM parameter_departments pd
         WHERE pd.parameter_id = (SELECT parameter_id FROM params)) = 0
        AND (SELECT COUNT(*) FROM field_departments fd
             JOIN fields_resource f ON f.id = fd.field_id
             WHERE (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = (SELECT parameter_id FROM params)
             AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
             AND fd.active = true) = 0
    ) as has_access
),
parameter_data AS (
    SELECT 
        (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        (SELECT d.description FROM parameter_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1),
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags_resource f ON paf.flag_id = f.id WHERE paf.parameter_id = p.id AND f.name = 'active' AND paf.value = TRUE) as active,
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags_resource f ON paf.flag_id = f.id WHERE paf.parameter_id = p.id AND f.name = 'simulation_parameter' AND paf.value = TRUE) as simulation_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags_resource f ON paf.flag_id = f.id WHERE paf.parameter_id = p.id AND f.name = 'document_parameter' AND paf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags_resource f ON paf.flag_id = f.id WHERE paf.parameter_id = p.id AND f.name = 'persona_parameter' AND paf.value = TRUE) as persona_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags_resource f ON paf.flag_id = f.id WHERE paf.parameter_id = p.id AND f.name = 'scenario_parameter' AND paf.value = TRUE) as scenario_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags_resource f ON paf.flag_id = f.id WHERE paf.parameter_id = p.id AND f.name = 'video_parameter' AND paf.value = TRUE) as video_parameter,
        COALESCE(pda.department_ids, NULL) as department_ids,
        ARRAY[]::text[] as persona_ids,
        ARRAY[]::text[] as document_ids,
        CASE 
            WHEN COALESCE(pasl.active_scenario_count, 0) > 0 THEN false
            WHEN (COALESCE(pda.department_ids, NULL) IS NULL OR array_length(pda.department_ids, 1) = 0) AND up.role != 'superadmin' THEN false
            WHEN up.role = 'superadmin'::profile_role THEN true
            WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role) THEN true
            ELSE false
        END as can_edit
    FROM params x
    JOIN parameters_resource p ON p.id = x.parameter_id
    CROSS JOIN user_profile up
    LEFT JOIN parameter_departments_aggregated pda ON true
    LEFT JOIN parameter_active_scenario_links pasl ON pasl.parameter_id = p.id
    CROSS JOIN user_has_parameter_access uhpa
    WHERE uhpa.has_access = true
),
all_fields_data AS (
    SELECT 
        f.id as field_id,
        COALESCE(ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) FILTER (WHERE fd.department_id IS NOT NULL), ARRAY[]::text[]) as department_ids
    FROM field_artifact f
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
    GROUP BY f.id
),
all_fields_with_usage AS (
    SELECT 
        f.id,
        (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(afd.department_ids, ARRAY[]::text[]) as department_ids
    FROM field_artifact f
    LEFT JOIN all_fields_data afd ON afd.field_id = f.id
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    WHERE EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
    GROUP BY f.id, (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), afd.department_ids
),
field_connections_data AS (
    SELECT 
        f.id as field_id,
        false as "default",  -- Default flag no longer available after denormalization
        EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = TRUE) as connection_active
    FROM params x
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = x.parameter_id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
),
fields_with_usage AS (
    SELECT 
        f.id,
        (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
        false as "default",  -- Default flag no longer available after denormalization
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(fdd.department_ids, ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = x.parameter_id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    LEFT JOIN field_departments_data fdd ON fdd.field_id = f.id
    GROUP BY f.id, (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), fdd.department_ids
),
parameter_department_ids AS (
    SELECT 
        dept_id as department_id
    FROM parameter_departments_aggregated pda
    CROSS JOIN LATERAL unnest(
        CASE 
            WHEN pda.department_ids IS NOT NULL AND array_length(pda.department_ids, 1) > 0
            THEN pda.department_ids::uuid[]
            ELSE ARRAY[]::uuid[]
        END
    ) AS dept_id
),
filtered_personas AS (
    SELECT DISTINCT p.id, (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1), COALESCE((SELECT d.description FROM persona_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description
    FROM persona_artifact p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id
    CROSS JOIN parameter_departments_aggregated pda
    WHERE EXISTS (SELECT 1 FROM persona_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'active' AND pf.value = true)
    AND (
        (pda.department_ids IS NULL OR array_length(pda.department_ids, 1) = 0)
        OR (pda.department_ids IS NOT NULL AND pd.department_id = ANY(pda.department_ids::uuid[]))
        OR NOT EXISTS (
            SELECT 1 FROM persona_departments pd2 
            WHERE pd2.persona_id = p.id AND pd2.active = true
        )
    )
),
filtered_documents AS (
    SELECT DISTINCT d.id, (SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1), COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM document_artifact d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    CROSS JOIN parameter_departments_aggregated pda
    WHERE EXISTS (SELECT 1 FROM document_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'active' AND df.value = true)
    AND (
        (pda.department_ids IS NULL OR array_length(pda.department_ids, 1) = 0)
        OR (pda.department_ids IS NOT NULL AND dd.department_id = ANY(pda.department_ids::uuid[]))
        OR NOT EXISTS (
            SELECT 1 FROM document_departments dd2 
            WHERE dd2.document_id = d.id AND dd2.active = true
        )
    )
),
valid_depts AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM params x
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
    JOIN profile_departments pd ON d.id = pd.department_id AND pd.profile_id = x.profile_id AND pd.active = true
)
SELECT 
    (SELECT parameter_exists FROM parameter_exists_check)::boolean as parameter_exists,
    -- Merge draft payload with parameter data (draft takes precedence)
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
    pd.persona_ids as persona_ids,
    pd.document_ids as document_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fwu.id, fwu.name, fwu.description, fwu."default", fwu.usage_count, fwu.department_ids)::types.q_get_parameter_detail_v4_item
            ORDER BY fwu.name
        ) FROM fields_with_usage fwu),
        '{}'::types.q_get_parameter_detail_v4_item[]
    ) as parameter_items,
    COALESCE(
        (SELECT ARRAY_AGG(
            (vd.department_id, vd.name, vd.description)::types.q_get_parameter_detail_v4_department
            ORDER BY vd.name
        ) FROM valid_depts vd),
        '{}'::types.q_get_parameter_detail_v4_department[]
    ) as departments,
    COALESCE(
        (SELECT ARRAY_AGG(vd.department_id::text ORDER BY vd.department_id)
         FROM valid_depts vd),
        ARRAY[]::text[]
    ) as valid_department_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (afwu.id, afwu.name, afwu.description, afwu.usage_count, afwu.department_ids)::types.q_get_parameter_detail_v4_field
            ORDER BY afwu.name
        ) FROM all_fields_with_usage afwu),
        '{}'::types.q_get_parameter_detail_v4_field[]
    ) as fields,
    COALESCE(
        (SELECT ARRAY_AGG(afwu.id::text ORDER BY afwu.id)
         FROM all_fields_with_usage afwu),
        ARRAY[]::text[]
    ) as valid_field_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fcd.field_id, fcd."default", fcd.connection_active)::types.q_get_parameter_detail_v4_field_connection
            ORDER BY fcd.field_id
        ) FROM field_connections_data fcd),
        '{}'::types.q_get_parameter_detail_v4_field_connection[]
    ) as field_connections,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fp.id, fp.name, fp.description)::types.q_get_parameter_detail_v4_persona
            ORDER BY fp.name
        ) FROM filtered_personas fp),
        '{}'::types.q_get_parameter_detail_v4_persona[]
    ) as personas,
    COALESCE(
        (SELECT ARRAY_AGG(fp.id::text ORDER BY fp.id)
         FROM filtered_personas fp),
        ARRAY[]::text[]
    ) as valid_persona_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.id, fd.name, fd.description)::types.q_get_parameter_detail_v4_document
            ORDER BY fd.name
        ) FROM filtered_documents fd),
        '{}'::types.q_get_parameter_detail_v4_document[]
    ) as documents,
    COALESCE(
        (SELECT ARRAY_AGG(fd.id::text ORDER BY fd.id)
         FROM filtered_documents fd),
        ARRAY[]::text[]
    ) as valid_document_ids,
    pd.can_edit::boolean as can_edit,
    up.actor_name::text as actor_name,
    -- Draft version (from draft payload if exists)
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version,
    -- Extract field_ids from draft payload if available (support both camelCase and snake_case)
    COALESCE(
        (SELECT payload->'fieldIds' FROM draft_payload_data),
        (SELECT payload->'field_ids' FROM draft_payload_data),
        -- Fallback: extract from field_connections if no draft
        (SELECT jsonb_agg(fcd.field_id::text ORDER BY fcd.field_id) FROM field_connections_data fcd),
        '[]'::jsonb
    ) as field_ids,
    -- Extract field_active_states from draft payload if available (support both camelCase and snake_case)
    COALESCE(
        (SELECT payload->'fieldActiveStates' FROM draft_payload_data),
        (SELECT payload->'field_active_states' FROM draft_payload_data),
        -- Fallback: extract from field_connections if no draft
        (SELECT jsonb_object_agg(fcd.field_id::text, fcd.connection_active) FROM field_connections_data fcd),
        '{}'::jsonb
    ) as field_active_states,
    -- Extract field_default_states from draft payload if available (support both camelCase and snake_case)
    COALESCE(
        (SELECT payload->'fieldDefaultStates' FROM draft_payload_data),
        (SELECT payload->'field_default_states' FROM draft_payload_data),
        -- Fallback: extract from field_connections if no draft
        (SELECT jsonb_object_agg(fcd.field_id::text, fcd."default") FROM field_connections_data fcd),
        '{}'::jsonb
    ) as field_default_states
FROM parameter_data pd
CROSS JOIN user_profile up
$$;