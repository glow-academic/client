-- Get auth list with item counts, department visibility, pagination, and search
-- Resource-first: only touches auths_resource + auth's own junctions + resource tables
-- No SQL-computed permissions (computed in Python from permissions.py)
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_auth_list_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_auth_list_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITH CASCADE (needed for nested composite types)
-- CASCADE is needed because outer types contain arrays of inner types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_auth_list_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_auth_list_v4_auth_item AS (
    auth_item_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_auth_list_v4_auth AS (
    auth_id uuid,
    name text,
    description text,
    is_inactive boolean,
    updated_at timestamptz,
    num_items integer,
    sample_items types.q_get_auth_list_v4_auth_item[],
    department_ids text[],
    active_settings_count bigint
);

-- Filter option type: id + count only (names hydrated in Python from cache)
CREATE TYPE types.q_get_auth_list_v4_option_id AS (
    id uuid,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_auth_list_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    department_search text DEFAULT NULL,
    page_size int DEFAULT 1000,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    auths types.q_get_auth_list_v4_auth[],
    department_option_ids types.q_get_auth_list_v4_option_id[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
-- Pre-aggregate department IDs per auth (auth_departments_junction.auth_id -> auth_artifact.id)
auth_departments_data AS (
    SELECT
        ad.auth_id,
        ARRAY_AGG(ad.department_id::text ORDER BY ad.created_at) as department_ids
    FROM auth_departments_junction ad
    GROUP BY ad.auth_id
),
-- Item counts per auth (via auth_auths_junction -> auth_items_junction -> items_resource)
auth_item_counts AS (
    SELECT
        aaj.auths_id,
        COUNT(*) as num_items
    FROM auth_auths_junction aaj
    JOIN auth_items_junction ai_j ON ai_j.auth_id = aaj.auth_id
    JOIN items_resource i ON i.id = ai_j.item_id
    GROUP BY aaj.auths_id
),
-- Sample items (top 3) per auth
auth_sample_items AS (
    SELECT
        ai.auths_id,
        ARRAY_AGG(
            (ai.id, ai.name, ai.description)::types.q_get_auth_list_v4_auth_item
            ORDER BY ai.name
        ) as sample_items
    FROM (
        SELECT i.id, aaj.auths_id, i.name, i.description,
               ROW_NUMBER() OVER (PARTITION BY aaj.auths_id ORDER BY i.name) as rn
        FROM auth_auths_junction aaj
        JOIN auth_items_junction ai_j ON ai_j.auth_id = aaj.auth_id
        JOIN items_resource i ON i.id = ai_j.item_id
    ) ai
    WHERE ai.rn <= 3
    GROUP BY ai.auths_id
),
-- Count active settings linked to each auth via setting_auths_junction
auth_settings_counts AS (
    SELECT
        sa.auth_id,
        COUNT(DISTINCT sa.settings_id)::bigint as active_settings_count
    FROM setting_auths_junction sa
    WHERE sa.active = true
    GROUP BY sa.auth_id
),
-- Core entity data with department visibility check
auth_data_base AS (
    SELECT
        a.id as auth_id,
        (SELECT n.name FROM auth_auths_junction aaj_n JOIN auth_names_junction an ON an.auth_id = aaj_n.auth_id JOIN names_resource n ON an.name_id = n.id WHERE aaj_n.auths_id = a.id LIMIT 1) as auth_name,
        (SELECT d.description FROM auth_auths_junction aaj_d JOIN auth_descriptions_junction ad ON ad.auth_id = aaj_d.auth_id JOIN descriptions_resource d ON ad.description_id = d.id WHERE aaj_d.auths_id = a.id LIMIT 1) as description,
        NOT EXISTS (SELECT 1 FROM auth_auths_junction aaj_f JOIN auth_flags_junction af ON af.auth_id = aaj_f.auth_id JOIN flags_resource f ON af.flag_id = f.id WHERE aaj_f.auths_id = a.id AND f.name = 'auth_active' AND af.value = TRUE) as is_inactive,
        a.created_at as updated_at,
        COALESCE(aic.num_items, 0) as num_items,
        COALESCE(asi.sample_items, '{}'::types.q_get_auth_list_v4_auth_item[]) as sample_items,
        COALESCE(add_data.department_ids, NULL) as department_ids,
        COALESCE(asc_data.active_settings_count, 0) as active_settings_count
    FROM auths_resource a
    LEFT JOIN auth_item_counts aic ON aic.auths_id = a.id
    LEFT JOIN auth_sample_items asi ON asi.auths_id = a.id
    LEFT JOIN auth_settings_counts asc_data ON asc_data.auth_id = a.id
    -- Department data via auth_auths_junction -> auth_artifact -> auth_departments_junction
    LEFT JOIN auth_auths_junction aaj ON aaj.auths_id = a.id
    LEFT JOIN auth_departments_data add_data ON add_data.auth_id = aaj.auth_id
    -- Department visibility: user must share a department with the auth, or auth has no departments
    LEFT JOIN auth_departments_junction adv ON adv.auth_id = aaj.auth_id AND adv.department_id IN (SELECT department_id FROM user_departments)
    GROUP BY a.id,
        (SELECT n.name FROM auth_auths_junction aaj_n JOIN auth_names_junction an ON an.auth_id = aaj_n.auth_id JOIN names_resource n ON an.name_id = n.id WHERE aaj_n.auths_id = a.id LIMIT 1),
        (SELECT d.description FROM auth_auths_junction aaj_d JOIN auth_descriptions_junction ad ON ad.auth_id = aaj_d.auth_id JOIN descriptions_resource d ON ad.description_id = d.id WHERE aaj_d.auths_id = a.id LIMIT 1),
        NOT EXISTS (SELECT 1 FROM auth_auths_junction aaj_f JOIN auth_flags_junction af ON af.auth_id = aaj_f.auth_id JOIN flags_resource f ON af.flag_id = f.id WHERE aaj_f.auths_id = a.id AND f.name = 'auth_active' AND af.value = TRUE),
        a.created_at, aic.num_items, asi.sample_items, add_data.department_ids, asc_data.active_settings_count
    HAVING COUNT(adv.auth_id) > 0 OR NOT EXISTS (
        SELECT 1 FROM auth_auths_junction aaj2 JOIN auth_departments_junction ad2 ON ad2.auth_id = aaj2.auth_id WHERE aaj2.auths_id = a.id
    )
),
auth_data AS (
    SELECT adb.*
    FROM auth_data_base adb
),
-- Apply server-side filters
filtered_auths AS (
    SELECT ad.*
    FROM auth_data ad
    WHERE
        -- Search filter: match name or description (case-insensitive)
        (search IS NULL OR LOWER(ad.auth_name) LIKE '%' || LOWER(search) || '%' OR LOWER(ad.description) LIKE '%' || LOWER(search) || '%')
        -- Department filter: auth must belong to at least one selected department
        AND (filter_department_ids IS NULL OR ad.department_ids && filter_department_ids::text[])
),
-- Count total filtered results (before pagination)
filtered_count AS (
    SELECT COUNT(*)::bigint as total_count FROM filtered_auths
),
-- Paginate filtered results
paginated_auths AS (
    SELECT fa.*
    FROM filtered_auths fa
    ORDER BY fa.updated_at DESC NULLS LAST
    LIMIT page_size OFFSET page_offset
),
-- Department filter option IDs with counts (names hydrated in Python)
department_option_data AS (
    SELECT
        dr.id,
        (SELECT COUNT(*) FROM auth_data) as count
    FROM departments_resource dr
    WHERE dr.id IN (SELECT department_id FROM user_departments)
)
SELECT
    -- Aggregate paginated auths
    COALESCE(
        (SELECT ARRAY_AGG(
            (pa.auth_id, pa.auth_name, pa.description,
             pa.is_inactive, pa.updated_at,
             pa.num_items, pa.sample_items,
             pa.department_ids,
             pa.active_settings_count
            )::types.q_get_auth_list_v4_auth
            ORDER BY pa.updated_at DESC NULLS LAST
        ) FROM paginated_auths pa),
        '{}'::types.q_get_auth_list_v4_auth[]
    ) as auths,
    -- Department option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.id, dod.count)::types.q_get_auth_list_v4_option_id
        ) FROM department_option_data dod),
        '{}'::types.q_get_auth_list_v4_option_id[]
    ) as department_option_ids,
    -- Total count of filtered auths (before pagination)
    (SELECT total_count FROM filtered_count) as total_count
FROM params
$$;
