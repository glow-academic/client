-- Get parameter detail with nested items and relationships
-- Converted to function with composite types

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_get_parameter_detail_v3(uuid, uuid);

-- 2) Drop types WITHOUT CASCADE (drop types that depend on other types first)
DROP TYPE IF EXISTS types.q_get_parameter_detail_v3_item;
DROP TYPE IF EXISTS types.q_get_parameter_detail_v3_department;
DROP TYPE IF EXISTS types.q_get_parameter_detail_v3_field;
DROP TYPE IF EXISTS types.q_get_parameter_detail_v3_field_connection;
DROP TYPE IF EXISTS types.q_get_parameter_detail_v3_persona;
DROP TYPE IF EXISTS types.q_get_parameter_detail_v3_document;

-- 3) Recreate types
CREATE TYPE types.q_get_parameter_detail_v3_item AS (
    parameter_item_id uuid,
    name text,
    description text,
    "default" boolean,
    usage_count bigint,
    department_ids text[]
);

CREATE TYPE types.q_get_parameter_detail_v3_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_parameter_detail_v3_field AS (
    field_id uuid,
    name text,
    description text,
    usage_count bigint,
    department_ids text[]
);

CREATE TYPE types.q_get_parameter_detail_v3_field_connection AS (
    field_id uuid,
    "default" boolean,
    active boolean
);

CREATE TYPE types.q_get_parameter_detail_v3_persona AS (
    persona_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_parameter_detail_v3_document AS (
    document_id uuid,
    name text,
    description text
);


-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_parameter_detail_v3(
    parameter_id uuid,
    profile_id uuid
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
    parameter_items types.q_get_parameter_detail_v3_item[],
    departments types.q_get_parameter_detail_v3_department[],
    valid_department_ids text[],
    fields types.q_get_parameter_detail_v3_field[],
    valid_field_ids text[],
    field_connections types.q_get_parameter_detail_v3_field_connection[],
    personas types.q_get_parameter_detail_v3_persona[],
    valid_persona_ids text[],
    documents types.q_get_parameter_detail_v3_document[],
    valid_document_ids text[],
    can_edit boolean,
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        parameter_id AS parameter_id,
        profile_id AS profile_id
),
parameter_exists_check AS (
    -- Check if parameter exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM parameters WHERE id = (SELECT parameter_id FROM params)
    )::boolean as parameter_exists
),
user_profile AS (
    SELECT 
        up.id,
        up.role,
        up.first_name || ' ' || up.last_name as actor_name
    FROM params x
    JOIN profiles up ON up.id = x.profile_id
),
parameter_active_scenario_links AS (
    SELECT 
        pf.parameter_id,
        COUNT(DISTINCT sf.scenario_id) as active_scenario_count
    FROM params x
    JOIN parameter_fields pf ON pf.parameter_id = x.parameter_id AND pf.active = true
    JOIN scenario_fields sf ON sf.field_id = pf.field_id AND sf.active = true
    GROUP BY pf.parameter_id
),
field_departments_data AS (
    SELECT 
        f.id as field_id,
        COALESCE(ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) FILTER (WHERE fd.department_id IS NOT NULL), ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN parameter_fields pf ON pf.parameter_id = x.parameter_id AND pf.active = true
    JOIN fields f ON f.id = pf.field_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    GROUP BY f.id
),
parameter_departments_aggregated AS (
    SELECT 
        ARRAY_AGG(DISTINCT dept_id::text ORDER BY dept_id::text) as department_ids
    FROM (
        SELECT pd.department_id as dept_id
        FROM params x
        JOIN parameter_departments pd ON pd.parameter_id = x.parameter_id AND pd.active = true
        UNION
        SELECT fd.department_id as dept_id
        FROM params x
        JOIN parameter_fields pf ON pf.parameter_id = x.parameter_id AND pf.active = true
        JOIN field_departments fd ON fd.field_id = pf.field_id AND fd.active = true
    ) combined_depts
),
user_has_parameter_access AS (
    SELECT EXISTS(
        SELECT 1 FROM parameter_departments pd
        JOIN profile_departments pdp ON pdp.department_id = pd.department_id
        WHERE pd.parameter_id = (SELECT parameter_id FROM params)
        AND pd.active = true
        AND pdp.profile_id = (SELECT profile_id FROM params)
        AND pdp.active = true
    ) OR EXISTS(
        SELECT 1 FROM field_departments fd
        JOIN profile_departments pd ON pd.department_id = fd.department_id
        JOIN parameter_fields pf ON pf.field_id = fd.field_id
        WHERE pf.parameter_id = (SELECT parameter_id FROM params)
        AND pf.active = true
        AND fd.active = true
        AND pd.profile_id = (SELECT profile_id FROM params)
        AND pd.active = true
    ) OR EXISTS(
        SELECT 1 FROM params x
        JOIN profiles p ON p.id = x.profile_id
        WHERE p.role = 'superadmin'
    ) OR (
        (SELECT COUNT(*) FROM parameter_departments pd
         WHERE pd.parameter_id = (SELECT parameter_id FROM params)
         AND pd.active = true) = 0
        AND (SELECT COUNT(*) FROM field_departments fd
             JOIN parameter_fields pf ON pf.field_id = fd.field_id
             WHERE pf.parameter_id = (SELECT parameter_id FROM params)
             AND pf.active = true
             AND fd.active = true) = 0
    ) as has_access
),
parameter_data AS (
    SELECT 
        p.name,
        p.description,
        p.active,
        p.simulation_parameter,
        p.document_parameter,
        p.persona_parameter,
        p.scenario_parameter,
        p.video_parameter,
        COALESCE(pda.department_ids, NULL) as department_ids,
        ARRAY[]::text[] as persona_ids,
        ARRAY[]::text[] as document_ids,
        CASE 
            WHEN COALESCE(pasl.active_scenario_count, 0) > 0 THEN false
            WHEN (COALESCE(pda.department_ids, NULL) IS NULL OR array_length(pda.department_ids, 1) = 0) AND up.role != 'superadmin' THEN false
            WHEN up.role = 'superadmin' THEN true
            WHEN up.role IN ('admin', 'instructional') THEN true
            ELSE false
        END as can_edit
    FROM params x
    JOIN parameters p ON p.id = x.parameter_id
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
    FROM fields f
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE f.active = true
    GROUP BY f.id
),
all_fields_with_usage AS (
    SELECT 
        f.id,
        f.name,
        f.description,
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(afd.department_ids, ARRAY[]::text[]) as department_ids
    FROM fields f
    LEFT JOIN all_fields_data afd ON afd.field_id = f.id
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    WHERE f.active = true
    GROUP BY f.id, f.name, f.description, afd.department_ids
),
field_connections_data AS (
    SELECT 
        pf.field_id,
        pf."default",
        pf.active as connection_active
    FROM params x
    JOIN parameter_fields pf ON pf.parameter_id = x.parameter_id AND pf.active = true
),
fields_with_usage AS (
    SELECT 
        f.id,
        f.name,
        f.description,
        COALESCE(fcd."default", false) as "default",
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(fdd.department_ids, ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN parameter_fields pf ON pf.parameter_id = x.parameter_id AND pf.active = true
    JOIN fields f ON f.id = pf.field_id AND f.active = true
    LEFT JOIN field_connections_data fcd ON fcd.field_id = f.id
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    LEFT JOIN field_departments_data fdd ON fdd.field_id = f.id
    GROUP BY f.id, f.name, f.description, fcd."default", fdd.department_ids
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
    SELECT DISTINCT p.id, p.name, COALESCE(p.description, '') as description
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN parameter_departments_aggregated pda
    WHERE p.active = true
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
    SELECT DISTINCT d.id, d.name, COALESCE(d.description, '') as description
    FROM documents d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    CROSS JOIN parameter_departments_aggregated pda
    WHERE d.active = true
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
        d.title as name,
        COALESCE(d.description, '') as description
    FROM params x
    JOIN departments d ON d.active = true
    JOIN profile_departments pd ON d.id = pd.department_id AND pd.profile_id = x.profile_id AND pd.active = true
)
SELECT 
    (SELECT parameter_exists FROM parameter_exists_check)::boolean as parameter_exists,
    pd.name::text as name,
    pd.description::text as description,
    pd.active::boolean as active,
    pd.simulation_parameter::boolean as simulation_parameter,
    pd.document_parameter::boolean as document_parameter,
    pd.persona_parameter::boolean as persona_parameter,
    pd.scenario_parameter::boolean as scenario_parameter,
    pd.video_parameter::boolean as video_parameter,
    pd.department_ids as department_ids,
    pd.persona_ids as persona_ids,
    pd.document_ids as document_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fwu.id, fwu.name, fwu.description, fwu."default", fwu.usage_count, fwu.department_ids)::types.q_get_parameter_detail_v3_item
            ORDER BY fwu.name
        ) FROM fields_with_usage fwu),
        '{}'::types.q_get_parameter_detail_v3_item[]
    ) as parameter_items,
    COALESCE(
        (SELECT ARRAY_AGG(
            (vd.department_id, vd.name, vd.description)::types.q_get_parameter_detail_v3_department
            ORDER BY vd.name
        ) FROM valid_depts vd),
        '{}'::types.q_get_parameter_detail_v3_department[]
    ) as departments,
    COALESCE(
        (SELECT ARRAY_AGG(vd.department_id::text ORDER BY vd.department_id)
         FROM valid_depts vd),
        ARRAY[]::text[]
    ) as valid_department_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (afwu.id, afwu.name, afwu.description, afwu.usage_count, afwu.department_ids)::types.q_get_parameter_detail_v3_field
            ORDER BY afwu.name
        ) FROM all_fields_with_usage afwu),
        '{}'::types.q_get_parameter_detail_v3_field[]
    ) as fields,
    COALESCE(
        (SELECT ARRAY_AGG(afwu.id::text ORDER BY afwu.id)
         FROM all_fields_with_usage afwu),
        ARRAY[]::text[]
    ) as valid_field_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fcd.field_id, fcd."default", fcd.connection_active)::types.q_get_parameter_detail_v3_field_connection
            ORDER BY fcd.field_id
        ) FROM field_connections_data fcd),
        '{}'::types.q_get_parameter_detail_v3_field_connection[]
    ) as field_connections,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fp.id, fp.name, fp.description)::types.q_get_parameter_detail_v3_persona
            ORDER BY fp.name
        ) FROM filtered_personas fp),
        '{}'::types.q_get_parameter_detail_v3_persona[]
    ) as personas,
    COALESCE(
        (SELECT ARRAY_AGG(fp.id::text ORDER BY fp.id)
         FROM filtered_personas fp),
        ARRAY[]::text[]
    ) as valid_persona_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.id, fd.name, fd.description)::types.q_get_parameter_detail_v3_document
            ORDER BY fd.name
        ) FROM filtered_documents fd),
        '{}'::types.q_get_parameter_detail_v3_document[]
    ) as documents,
    COALESCE(
        (SELECT ARRAY_AGG(fd.id::text ORDER BY fd.id)
         FROM filtered_documents fd),
        ARRAY[]::text[]
    ) as valid_document_ids,
    pd.can_edit::boolean as can_edit,
    up.actor_name::text as actor_name
FROM parameter_data pd
CROSS JOIN user_profile up
$$;

COMMIT;
