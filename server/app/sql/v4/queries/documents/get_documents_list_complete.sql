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
    is_inactive boolean,
    num_scenarios int,
    active_scenario_count int,
    total_scenario_links int,
    updated_at timestamptz
);

-- Filter option types simplified: id + count only (names hydrated in Python from cache)
CREATE TYPE types.q_list_documents_v4_option_id AS (
    id uuid,
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
    actor_name text,
    user_role text,
    documents types.q_list_documents_v4_document[],
    scenario_option_ids types.q_list_documents_v4_option_id[],
    field_option_ids types.q_list_documents_v4_option_id[],
    department_option_ids types.q_list_documents_v4_option_id[],
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
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
user_profile AS (
    SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
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
document_all_scenario_links AS (
    SELECT
        sd.document_id,
        COUNT(*) as total_scenario_links
    FROM scenario_documents_junction sd
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
document_data AS (
    SELECT
        d.id as document_id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1) as document_name,
        EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'document_active' AND df.value = TRUE) as active,
        d.updated_at,
        COALESCE(ddd.department_ids, NULL) as department_ids,
        COALESCE(ds.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(dfc.field_ids, ARRAY[]::uuid[]) as field_ids,
        COALESCE(dasl.active_scenario_count, 0) as active_scenario_count,
        COALESCE(dasl_all.total_scenario_links, 0) as total_scenario_links
    FROM document_artifact d
    LEFT JOIN document_departments_junction dd ON dd.document_id = d.id AND dd.active = true
    LEFT JOIN document_departments_data ddd ON ddd.document_id = d.id
    LEFT JOIN document_scenarios ds ON ds.document_id = d.id
    LEFT JOIN document_fields_cte dfc ON dfc.document_id = d.id
    LEFT JOIN document_active_scenario_links dasl ON dasl.document_id = d.id
    LEFT JOIN document_all_scenario_links dasl_all ON dasl_all.document_id = d.id
    GROUP BY d.id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
        EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'document_active' AND df.value = TRUE),
        d.updated_at,
        ddd.department_ids, ds.scenario_ids, dfc.field_ids, dasl.active_scenario_count, dasl_all.total_scenario_links
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
-- Filter option IDs with counts (names hydrated in Python from cached *_internal() functions)
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM document_data
),
scenario_option_data AS (
    SELECT
        sr.id,
        (SELECT COUNT(*) FROM document_data dd WHERE sr.id = ANY(dd.scenario_ids)) as count
    FROM scenarios_resource sr
    WHERE sr.id IN (SELECT scenario_id FROM all_scenario_ids)
),
assigned_field_ids AS (
    SELECT DISTINCT unnest(field_ids) as field_id
    FROM document_data
    WHERE field_ids IS NOT NULL AND array_length(field_ids, 1) > 0
),
field_option_data AS (
    SELECT
        fr.id,
        (SELECT COUNT(*) FROM document_data dd WHERE fr.id = ANY(dd.field_ids)) as count
    FROM fields_resource fr
    WHERE fr.id IN (SELECT field_id FROM assigned_field_ids)
),
department_option_data AS (
    SELECT
        dr.id,
        (SELECT COUNT(*) FROM document_data) as count
    FROM departments_resource dr
    WHERE dr.id IN (SELECT department_id FROM user_departments)
)
SELECT
    up.actor_name::text as actor_name,
    up.role::text as user_role,
    -- Aggregate paginated documents
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.document_id, pd.document_name,
             pd.department_ids, pd.scenario_ids, pd.field_ids,
             NOT pd.active, COALESCE(array_length(pd.scenario_ids, 1), 0),
             pd.active_scenario_count,
             pd.total_scenario_links,
             pd.updated_at
            )::types.q_list_documents_v4_document
            ORDER BY pd.updated_at DESC NULLS LAST
        ) FROM paginated_documents pd),
        '{}'::types.q_list_documents_v4_document[]
    ) as documents,
    -- Scenario option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sod.id, sod.count)::types.q_list_documents_v4_option_id
        ) FROM scenario_option_data sod),
        '{}'::types.q_list_documents_v4_option_id[]
    ) as scenario_option_ids,
    -- Field option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (fod.id, fod.count)::types.q_list_documents_v4_option_id
        ) FROM field_option_data fod),
        '{}'::types.q_list_documents_v4_option_id[]
    ) as field_option_ids,
    -- Department option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.id, dod.count)::types.q_list_documents_v4_option_id
        ) FROM department_option_data dod),
        '{}'::types.q_list_documents_v4_option_id[]
    ) as department_option_ids,
    -- Total count of filtered documents (before pagination)
    (SELECT total_count FROM filtered_count) as total_count
FROM user_profile up
$$;
