-- Get evals list with department data for Python permission computation
-- Two-pass: SQL returns raw data, Python computes can_edit/can_delete/can_duplicate

-- Drop function if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_list_evals_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_evals_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_list_evals_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Recreate types
CREATE TYPE types.q_list_evals_v4_eval AS (
    eval_id uuid,
    name text,
    description text,
    department_ids text[],
    is_inactive boolean,
    is_dynamic boolean,
    use_groups boolean,
    num_runs int,
    num_groups int,
    updated_at timestamptz
);

-- Filter option type: value/label/count (names resolved in SQL, no Python hydration needed)
CREATE TYPE types.q_list_evals_v4_option AS (
    value text,
    label text,
    count bigint
);

-- Create function
CREATE OR REPLACE FUNCTION api_list_evals_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    department_search text DEFAULT NULL,
    page_size int DEFAULT 50,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    evals types.q_list_evals_v4_eval[],
    department_options types.q_list_evals_v4_option[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        COALESCE(NULLIF(search, ''), NULL) AS search,
        filter_department_ids AS filter_department_ids,
        COALESCE(NULLIF(department_search, ''), NULL) AS department_search,
        page_size AS page_size,
        page_offset AS page_offset
),
-- User context: actor_name comes from get_profile_context_internal() in Python
user_profile AS (
    SELECT COALESCE(r.role, 'member'::profile_type) as role,
           ''::text as actor_name
    FROM profile_roles_junction prj
    JOIN roles_resource r ON prj.role_id = r.id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Get all accessible evals
accessible_evals AS (
    SELECT DISTINCT e.id, e.updated_at
    FROM eval_artifact e
    CROSS JOIN user_profile up
    LEFT JOIN eval_departments_junction ed ON ed.eval_id = e.id AND ed.active = true
    WHERE
        -- Access check: superadmin sees all, others need department overlap or no departments
        (
            up.role = 'superadmin'
            OR ed.department_id IN (SELECT department_id FROM user_departments)
            OR NOT EXISTS (SELECT 1 FROM eval_departments_junction ed2 WHERE ed2.eval_id = e.id AND ed2.active = true)
        )
),
-- Apply filters
filtered_evals AS (
    SELECT ae.id, ae.updated_at
    FROM accessible_evals ae
    WHERE
        -- Search filter
        (
            (SELECT search FROM params) IS NULL
            OR EXISTS (
                SELECT 1 FROM eval_names_junction en
                JOIN names_resource n ON en.name_id = n.id
                WHERE en.eval_id = ae.id
                AND LOWER(n.name) LIKE '%' || LOWER((SELECT search FROM params)) || '%'
            )
            OR EXISTS (
                SELECT 1 FROM eval_descriptions_junction ed
                JOIN descriptions_resource d ON ed.description_id = d.id
                WHERE ed.eval_id = ae.id
                AND LOWER(d.description) LIKE '%' || LOWER((SELECT search FROM params)) || '%'
            )
        )
        -- Department filter
        AND (
            api_list_evals_v4.filter_department_ids IS NULL
            OR COALESCE(array_length(api_list_evals_v4.filter_department_ids, 1), 0) = 0
            OR EXISTS (
                SELECT 1 FROM eval_departments_junction ed
                WHERE ed.eval_id = ae.id AND ed.active = true
                AND ed.department_id = ANY(api_list_evals_v4.filter_department_ids)
            )
        )
),
-- Count total
total AS (
    SELECT COUNT(*) as count FROM filtered_evals
),
-- Paginate
paginated_evals AS (
    SELECT fe.id, fe.updated_at
    FROM filtered_evals fe
    ORDER BY fe.updated_at DESC
    LIMIT (SELECT page_size FROM params)
    OFFSET (SELECT page_offset FROM params)
),
-- Build eval objects with enriched data
eval_objects AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (
                pe.id,
                (SELECT n.name FROM eval_names_junction en JOIN names_resource n ON en.name_id = n.id WHERE en.eval_id = pe.id LIMIT 1),
                COALESCE((SELECT d.description FROM eval_descriptions_junction ed JOIN descriptions_resource d ON ed.description_id = d.id WHERE ed.eval_id = pe.id LIMIT 1), ''),
                COALESCE((SELECT ARRAY_AGG(ed.department_id::text) FROM eval_departments_junction ed WHERE ed.eval_id = pe.id AND ed.active = true), ARRAY[]::text[]),
                NOT COALESCE((SELECT f.value FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = pe.id AND f.name = 'eval_active' LIMIT 1), false),
                COALESCE((SELECT f.value FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = pe.id AND f.name = 'dynamic' LIMIT 1), false),
                COALESCE((SELECT f.value FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = pe.id AND f.name = 'use_groups' LIMIT 1), false),
                0,  -- num_runs: eval_runs_junction dropped, runs are runtime-only
                0,  -- num_groups: eval_groups_junction dropped, groups are runtime-only
                pe.updated_at
            )::types.q_list_evals_v4_eval
            ORDER BY pe.updated_at DESC
        ),
        '{}'::types.q_list_evals_v4_eval[]
    ) as evals
    FROM paginated_evals pe
),
-- Department options with names resolved in SQL (ListFilterSection pattern)
department_option_data AS (
    SELECT
        dr.id::text as value,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON n.id = dn.name_id WHERE dn.department_id = dd.department_id LIMIT 1) as label,
        COUNT(DISTINCT ae.id) as count
    FROM departments_resource dr
    JOIN department_departments_junction dd ON dd.departments_id = dr.id
    JOIN accessible_evals ae ON EXISTS (
        SELECT 1 FROM eval_departments_junction ed WHERE ed.eval_id = ae.id AND ed.active = true AND ed.department_id = dr.id
    )
    WHERE dr.id IN (SELECT department_id FROM user_departments)
      AND (department_search IS NULL OR LOWER((SELECT n.name FROM department_names_junction dn JOIN names_resource n ON n.id = dn.name_id WHERE dn.department_id = dd.department_id LIMIT 1)) LIKE '%' || LOWER(department_search) || '%')
    GROUP BY dr.id, dd.department_id
)
SELECT
    (SELECT evals FROM eval_objects) as evals,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.value, dod.label, dod.count)::types.q_list_evals_v4_option
            ORDER BY dod.label
        ) FROM department_option_data dod),
        '{}'::types.q_list_evals_v4_option[]
    ) as department_options,
    (SELECT count FROM total) as total_count
FROM user_profile up;
$$;
