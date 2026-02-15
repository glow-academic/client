-- Get documents list with permissions and mappings
-- Resource-first: only touches document_artifact + document's own junctions + resource tables
-- No cross-entity artifact tables (scenario_artifact, field_artifact, department_artifact)
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_list_documents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_documents_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_list_documents_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
-- Document: NO can_edit/can_delete (moved to Python)
CREATE TYPE types.q_list_documents_v4_document AS (
    document_id uuid,
    name text,
    department_ids text[],
    scenario_ids uuid[],
    field_ids uuid[],
    upload_ids uuid[],
    is_inactive boolean,
    num_scenarios int,
    active_scenario_count int,
    updated_at timestamptz
);

-- Filter option type: value/label/count (names resolved in SQL, no Python hydration needed)
CREATE TYPE types.q_list_documents_v4_option AS (
    value text,
    label text,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_documents_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    field_ids uuid[] DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    scenario_search text DEFAULT NULL,
    field_search text DEFAULT NULL,
    department_search text DEFAULT NULL,
    page_size int DEFAULT 12,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    documents types.q_list_documents_v4_document[],
    scenario_options types.q_list_documents_v4_option[],
    field_options types.q_list_documents_v4_option[],
    department_options types.q_list_documents_v4_option[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
-- Scenario linkage via scenario_documents_junction (junction table, not artifact)
document_active_scenario_links AS (
    SELECT
        sd.document_id,
        COUNT(*) as active_scenario_count
    FROM scenario_documents_junction sd
    WHERE sd.active = true
    GROUP BY sd.document_id
),
document_scenarios AS (
    SELECT
        sd.document_id,
        ARRAY_AGG(DISTINCT sd.scenario_id) as scenario_ids
    FROM scenario_documents_junction sd
    WHERE sd.active = true
    GROUP BY sd.document_id
),
-- Field linkage via parameter_fields_resource.field_id -> fields_resource.id
document_fields_cte AS (
    SELECT
        dpfj.document_id,
        ARRAY_AGG(pfr.field_id) as field_ids
    FROM document_parameter_fields_junction dpfj
    JOIN parameter_fields_resource pfr ON pfr.id = dpfj.parameter_field_id
    WHERE dpfj.active = true
    GROUP BY dpfj.document_id
),
document_departments_data AS (
    SELECT
        dd.document_id,
        ARRAY_AGG(dd.department_id::text ORDER BY dd.created_at) as department_ids
    FROM document_departments_junction dd
    WHERE dd.active = true
    GROUP BY dd.document_id
),
document_uploads_cte AS (
    SELECT
        du.document_id,
        ARRAY_AGG(du.uploads_id) as upload_ids
    FROM document_uploads_junction du
    WHERE du.active = true
    GROUP BY du.document_id
),
document_data AS (
    SELECT
        d.id as document_id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1) as document_name,
        EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'document_active' AND df.value = TRUE) as active,
        d.updated_at,
        COALESCE(ddd.department_ids, NULL) as department_ids,
        COALESCE(ds.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(dfc.field_ids, ARRAY[]::uuid[]) as field_ids,
        COALESCE(duc.upload_ids, ARRAY[]::uuid[]) as upload_ids,
        COALESCE(dasl.active_scenario_count, 0) as active_scenario_count
    FROM document_artifact d
    LEFT JOIN document_departments_junction dd ON dd.document_id = d.id AND dd.active = true
    LEFT JOIN document_departments_data ddd ON ddd.document_id = d.id
    LEFT JOIN document_scenarios ds ON ds.document_id = d.id
    LEFT JOIN document_fields_cte dfc ON dfc.document_id = d.id
    LEFT JOIN document_uploads_cte duc ON duc.document_id = d.id
    LEFT JOIN document_active_scenario_links dasl ON dasl.document_id = d.id
    GROUP BY d.id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
        EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'document_active' AND df.value = TRUE),
        d.updated_at,
        ddd.department_ids, ds.scenario_ids, dfc.field_ids, duc.upload_ids, dasl.active_scenario_count
    HAVING
        COUNT(dd.document_id) FILTER (WHERE dd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM document_departments_junction dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
),
-- Apply server-side filters
filtered_documents AS (
    SELECT dd.*
    FROM document_data dd
    WHERE
        -- Search filter: match name (case-insensitive)
        (search IS NULL OR LOWER(dd.document_name) LIKE '%' || LOWER(search) || '%')
        -- Scenario filter: document must be linked to at least one selected scenario
        AND (api_list_documents_v4.scenario_ids IS NULL OR dd.scenario_ids && api_list_documents_v4.scenario_ids)
        -- Field filter: document must have at least one of the selected fields
        AND (api_list_documents_v4.field_ids IS NULL OR dd.field_ids && api_list_documents_v4.field_ids)
        -- Department filter: document must belong to at least one selected department
        AND (filter_department_ids IS NULL OR dd.department_ids && filter_department_ids::text[])
),
-- Count total filtered results (before pagination)
filtered_count AS (
    SELECT COUNT(*)::bigint as total_count FROM filtered_documents
),
-- Paginate filtered results
paginated_documents AS (
    SELECT fd.*
    FROM filtered_documents fd
    ORDER BY fd.updated_at DESC NULLS LAST
    LIMIT page_size OFFSET page_offset
),
-- Filter options with value/label/count (names resolved in SQL)
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM document_data
),
all_field_ids AS (
    SELECT DISTINCT unnest(field_ids) as field_id
    FROM document_data
    WHERE field_ids IS NOT NULL AND array_length(field_ids, 1) > 0
),
all_department_ids AS (
    SELECT DISTINCT department_id
    FROM user_departments
)
SELECT
    -- Aggregate paginated documents
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.document_id, pd.document_name,
             pd.department_ids, pd.scenario_ids, pd.field_ids, pd.upload_ids,
             NOT pd.active, COALESCE(array_length(pd.scenario_ids, 1), 0),
             pd.active_scenario_count,
             pd.updated_at
            )::types.q_list_documents_v4_document
            ORDER BY pd.updated_at DESC NULLS LAST
        ) FROM paginated_documents pd),
        '{}'::types.q_list_documents_v4_document[]
    ) as documents,
    -- Scenario filter options (value/label/count resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sr.id::text, sn_name.name, (SELECT COUNT(*) FROM document_data dd WHERE sr.id = ANY(dd.scenario_ids)))::types.q_list_documents_v4_option
            ORDER BY sn_name.name
         )
         FROM scenarios_resource sr
         JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = sr.id
         JOIN (SELECT sn.scenario_id, n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id) sn_name ON sn_name.scenario_id = ssj.scenario_id
         WHERE sr.id IN (SELECT scenario_id FROM all_scenario_ids)
           AND (scenario_search IS NULL OR LOWER(sn_name.name) LIKE '%' || LOWER(scenario_search) || '%')),
        '{}'::types.q_list_documents_v4_option[]
    ) as scenario_options,
    -- Field filter options (value/label/count resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (fr.id::text, fn_name.name, (SELECT COUNT(*) FROM document_data dd WHERE fr.id = ANY(dd.field_ids)))::types.q_list_documents_v4_option
            ORDER BY fn_name.name
         )
         FROM fields_resource fr
         JOIN field_fields_junction ffj ON ffj.fields_id = fr.id
         JOIN (SELECT fn.field_id, n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id) fn_name ON fn_name.field_id = ffj.field_id
         WHERE fr.id IN (SELECT field_id FROM all_field_ids)
           AND (field_search IS NULL OR LOWER(fn_name.name) LIKE '%' || LOWER(field_search) || '%')),
        '{}'::types.q_list_documents_v4_option[]
    ) as field_options,
    -- Department filter options (value/label/count resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dr.id::text, dn_name.name, (SELECT COUNT(*) FROM document_data dd WHERE dr.id::text = ANY(dd.department_ids)))::types.q_list_documents_v4_option
            ORDER BY dn_name.name
         )
         FROM departments_resource dr
         JOIN department_departments_junction ddj ON ddj.departments_id = dr.id
         JOIN (SELECT dn.department_id, n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id) dn_name ON dn_name.department_id = ddj.department_id
         WHERE dr.id IN (SELECT department_id FROM all_department_ids)
           AND (department_search IS NULL OR LOWER(dn_name.name) LIKE '%' || LOWER(department_search) || '%')),
        '{}'::types.q_list_documents_v4_option[]
    ) as department_options,
    -- Total count of filtered documents (before pagination)
    (SELECT total_count FROM filtered_count) as total_count
FROM params
$$;

