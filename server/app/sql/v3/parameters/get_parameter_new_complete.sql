-- Get default parameter detail for creation
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_get_parameter_new_v3(uuid);

-- 2) Drop types WITHOUT CASCADE
-- If any other object depends on them, this will ERROR and stop the migration (good)
DROP TYPE IF EXISTS types.q_get_parameter_new_v3_department;
DROP TYPE IF EXISTS types.q_get_parameter_new_v3_field;
DROP TYPE IF EXISTS types.q_get_parameter_new_v3_item;
DROP TYPE IF EXISTS types.q_get_parameter_new_v3_field_connection;
DROP TYPE IF EXISTS types.q_get_parameter_new_v3_persona;
DROP TYPE IF EXISTS types.q_get_parameter_new_v3_document;

-- 3) Recreate types
CREATE TYPE types.q_get_parameter_new_v3_department AS (
    department_id uuid,  -- ✅ Native uuid type
    name text,
    description text
);

CREATE TYPE types.q_get_parameter_new_v3_field AS (
    field_id uuid,  -- ✅ Native uuid type
    name text,
    description text,
    usage_count bigint,
    department_ids text[]  -- ✅ text[] for arrays
);

CREATE TYPE types.q_get_parameter_new_v3_item AS (
    parameter_item_id uuid,  -- ✅ Native uuid type
    name text,
    description text,
    "default" boolean,
    usage_count bigint,
    department_ids text[]  -- ✅ text[] for arrays
);

CREATE TYPE types.q_get_parameter_new_v3_field_connection AS (
    field_id uuid,  -- ✅ Native uuid type
    "default" boolean,
    active boolean
);

CREATE TYPE types.q_get_parameter_new_v3_persona AS (
    persona_id uuid,  -- ✅ Native uuid type
    name text,
    description text
);

CREATE TYPE types.q_get_parameter_new_v3_document AS (
    document_id uuid,  -- ✅ Native uuid type
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_parameter_new_v3(profile_id uuid)
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
    parameter_items types.q_get_parameter_new_v3_item[],
    departments types.q_get_parameter_new_v3_department[],
    valid_department_ids text[],
    fields types.q_get_parameter_new_v3_field[],
    valid_field_ids text[],
    field_connections types.q_get_parameter_new_v3_field_connection[],
    persona_ids text[],
    personas types.q_get_parameter_new_v3_persona[],
    valid_persona_ids text[],
    document_ids text[],
    documents types.q_get_parameter_new_v3_document[],
    valid_document_ids text[],
    can_edit boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        p.id as profile_id,
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
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
        fp.parameter_id,
        fd.department_id
    FROM parameter_fields fp
    JOIN field_departments fd ON fd.field_id = fp.field_id
    WHERE fp.active = true AND fd.active = true
),
default_parameter AS (
    SELECT p.id
    FROM parameters p
    LEFT JOIN field_departments_for_filter fdf ON fdf.parameter_id = p.id
    WHERE p.active = true
    GROUP BY p.id
    HAVING 
        -- Include if has matching department link via parameter_departments or field_departments OR has no department links at all (cross-dept)
        COUNT(fdf.parameter_id) FILTER (WHERE fdf.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (
            SELECT 1 FROM parameter_departments pd2 WHERE pd2.parameter_id = p.id AND pd2.active = true
        )
        AND NOT EXISTS (
            SELECT 1 FROM field_departments fd2 
            JOIN parameter_fields fp2 ON fp2.field_id = fd2.field_id 
            WHERE fp2.parameter_id = p.id AND fp2.active = true AND fd2.active = true
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
        FROM parameter_fields fp
        JOIN default_parameter dp ON fp.parameter_id = dp.id
        JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
        WHERE fp.active = true
    ) combined_depts
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
-- Parameter items from default parameter (fields connected to default parameter)
field_departments_data AS (
    SELECT 
        f.id as parameter_item_id,
        COALESCE(ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) FILTER (WHERE fd.department_id IS NOT NULL), ARRAY[]::text[]) as department_ids
    FROM fields f
    JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
    JOIN default_parameter dp ON fp.parameter_id = dp.id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    GROUP BY f.id
),
parameter_items_with_usage AS (
    SELECT 
        f.id,
        f.name,
        f.description,
        COALESCE(fp."default", false) as "default",
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(fdd.department_ids, ARRAY[]::text[]) as department_ids
    FROM fields f
    JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
    JOIN default_parameter dp ON fp.parameter_id = dp.id
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    LEFT JOIN field_departments_data fdd ON fdd.parameter_item_id = f.id
    GROUP BY f.id, f.name, f.description, fp."default", fdd.department_ids
),
-- Valid departments (user's departments)
valid_depts AS (
    SELECT 
        d.id as department_id,
        d.title as name,
        COALESCE(d.description, '') as description
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
    JOIN departments d ON d.id = pd.department_id
    WHERE d.active = true
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
    SELECT DISTINCT p.id, p.name, COALESCE(p.description, '') as description
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
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
    SELECT DISTINCT d.id, d.name, COALESCE(d.description, '') as description
    FROM documents d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    CROSS JOIN user_departments ud
    WHERE d.active = true
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
    pd.name::text as name,
    pd.description::text as description,
    pd.active::boolean as active,
    pd.simulation_parameter::boolean as simulation_parameter,
    pd.document_parameter::boolean as document_parameter,
    pd.persona_parameter::boolean as persona_parameter,
    pd.scenario_parameter::boolean as scenario_parameter,
    pd.video_parameter::boolean as video_parameter,
    pd.department_ids as department_ids,
    -- Parameter items (from default parameter)
    COALESCE(
        (SELECT ARRAY_AGG(
            (piwu.id, piwu.name, piwu.description, piwu."default", piwu.usage_count, piwu.department_ids)::types.q_get_parameter_new_v3_item
            ORDER BY piwu.name
        ) FROM parameter_items_with_usage piwu),
        '{}'::types.q_get_parameter_new_v3_item[]
    ) as parameter_items,
    -- Departments (user's valid departments)
    COALESCE(
        (SELECT ARRAY_AGG(
            (vd.department_id, vd.name, vd.description)::types.q_get_parameter_new_v3_department
            ORDER BY vd.name
        ) FROM valid_depts vd),
        '{}'::types.q_get_parameter_new_v3_department[]
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
            (afwu.id, afwu.name, afwu.description, afwu.usage_count, afwu.department_ids)::types.q_get_parameter_new_v3_field
            ORDER BY afwu.name
        ) FROM all_fields_with_usage afwu),
        '{}'::types.q_get_parameter_new_v3_field[]
    ) as fields,
    -- Valid field IDs
    COALESCE(
        (SELECT ARRAY_AGG(afwu.id::text ORDER BY afwu.id)
         FROM all_fields_with_usage afwu),
        ARRAY[]::text[]
    ) as valid_field_ids,
    -- Field connections (empty for new parameter)
    '{}'::types.q_get_parameter_new_v3_field_connection[] as field_connections,
    -- Persona IDs (empty for new)
    ARRAY[]::text[] as persona_ids,
    -- Personas (filtered by user's departments)
    COALESCE(
        (SELECT ARRAY_AGG(
            (fp.id, fp.name, fp.description)::types.q_get_parameter_new_v3_persona
            ORDER BY fp.name
        ) FROM filtered_personas fp),
        '{}'::types.q_get_parameter_new_v3_persona[]
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
            (fd.id, fd.name, fd.description)::types.q_get_parameter_new_v3_document
            ORDER BY fd.name
        ) FROM filtered_documents fd),
        '{}'::types.q_get_parameter_new_v3_document[]
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
        WHEN ap.role = 'superadmin' THEN true::boolean
        WHEN ap.role IN ('admin', 'instructional') THEN true::boolean
        ELSE false::boolean
    END as can_edit
FROM actor_profile ap
CROSS JOIN parameter_data pd
LEFT JOIN primary_department_id pdi ON true
$$;

COMMIT;
