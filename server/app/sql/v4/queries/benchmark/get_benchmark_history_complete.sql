-- Get benchmark history with eval attempts pagination, search, filters, and sorting
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
        WHERE proname = 'api_get_benchmark_history_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_benchmark_history_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_benchmark_history_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_benchmark_history_v4_attempt AS (
    attempt_id uuid,
    eval_id uuid,
    eval_name text,
    eval_description text,
    rubric_id uuid,
    rubric_name text,
    created_at timestamptz,
    archived boolean,
    status text,
    total_runs bigint,
    completed_runs bigint,
    pending_runs bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_benchmark_history_v4(
    profile_id uuid,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    eval_ids uuid[] DEFAULT ARRAY[]::uuid[],
    status text DEFAULT NULL,
    archived boolean DEFAULT NULL,
    search text DEFAULT NULL,
    sort_by text DEFAULT 'created_at',
    sort_order text DEFAULT 'desc',
    page int DEFAULT 0,
    page_size int DEFAULT 20
)
RETURNS TABLE (
    actor_name text,
    data types.q_get_benchmark_history_v4_attempt[],
    total_count int,
    page int,
    page_size int,
    total_pages int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(NULLIF(eval_ids, ARRAY[]::uuid[]), NULL::uuid[]) AS eval_ids,
        COALESCE(NULLIF(status, ''), NULL::text) AS status,
        archived AS archived,
        COALESCE(NULLIF(search, ''), NULL::text) AS search,
        COALESCE(sort_by, 'created_at') AS sort_by,
        COALESCE(sort_order, 'desc') AS sort_order,
        COALESCE(page, 0) AS page,
        COALESCE(page_size, 20) AS page_size
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params)::text IS NULL OR (SELECT profile_id FROM params)::text = '' THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM resolve_profile_id rpi
    JOIN profile_artifact p ON p.id = rpi.resolved_profile_id
    WHERE rpi.resolved_profile_id IS NOT NULL
),
user_departments AS (
    SELECT department_id
    FROM profile_departments_junction
    WHERE profile_id = (SELECT resolved_profile_id FROM resolve_profile_id) AND active = true
),
user_profile AS (
    SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
),
-- Get eval attempts with eval info
attempts_with_eval AS (
    SELECT
        ea.id as attempt_id,
        ea.created_at as attempt_created_at,
        eaj.evals_id as eval_id,
        ea.archived,
        (SELECT n.name FROM eval_names_junction en JOIN names_resource n ON en.name_id = n.id WHERE en.eval_id = e.id LIMIT 1) as eval_name,
        (SELECT d.description FROM eval_descriptions_junction ed JOIN descriptions_resource d ON ed.description_id = d.id WHERE ed.eval_id = e.id LIMIT 1) as eval_description,
        -- Get first rubric from junction table (view_runs_entry or view_groups_entry based on use_groups)
        (SELECT combined.rubric_id
         FROM (
             SELECT rr.rubric_id, err.created_at
             FROM eval_runs_rubrics_junction err
             JOIN run_rubrics_resource rr ON rr.id = err.run_rubric_id
             WHERE err.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = '' AND ef.value = false)
             UNION ALL
             SELECT gr.rubric_id, egr.created_at
             FROM eval_groups_rubrics_junction egr
             JOIN group_rubrics_resource gr ON gr.id = egr.group_rubric_id
             WHERE egr.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = '' AND ef.value = true)
         ) combined
         ORDER BY combined.created_at
         LIMIT 1) as rubric_id,
        (SELECT (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1)
         FROM (
             SELECT rr.rubric_id, err.created_at
             FROM eval_runs_rubrics_junction err
             JOIN run_rubrics_resource rr ON rr.id = err.run_rubric_id
             WHERE err.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = '' AND ef.value = false)
             UNION ALL
             SELECT gr.rubric_id, egr.created_at
             FROM eval_groups_rubrics_junction egr
             JOIN group_rubrics_resource gr ON gr.id = egr.group_rubric_id
             WHERE egr.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = '' AND ef.value = true)
         ) combined
         JOIN rubrics_resource r ON r.id = combined.rubric_id
         ORDER BY combined.created_at
         LIMIT 1) as rubric_name
    FROM view_benchmark_attempts_entry ea
    JOIN benchmark_attempts_evals_connection eaj ON eaj.attempt_id = ea.id
    JOIN evals_resource e ON e.id = eaj.evals_id
),
-- Get eval departments for access control
attempt_eval_departments AS (
    SELECT 
        rd.rubric_id as eval_id,
        ARRAY_AGG(rd.department_id::text ORDER BY rd.created_at) as department_ids
    FROM rubric_departments_junction rd
    WHERE rd.active = true
    GROUP BY rd.rubric_id
),
-- Calculate run counts and status for each attempt
attempt_status_summary AS (
    SELECT 
        aea.attempt_id,
        aea.eval_id,
        -- Count view_runs_entry from eval_runs_junction for this eval
        COUNT(DISTINCT er.run_id) as total_runs,
        -- Count completed view_runs_entry (where test exists and is completed)
        COUNT(DISTINCT er.run_id) FILTER (
            WHERE EXISTS (
                SELECT 1
                FROM view_tests_entry t
                WHERE t.attempt_id = aea.attempt_id
                  AND t.trace_id LIKE 'eval_' || aea.attempt_id::text || '_%'
                  AND SPLIT_PART(t.trace_id, '_', 3) = er.run_id::text
                  AND t.completed = true
            )
        ) as completed_runs,
        -- Count pending view_runs_entry (where test doesn't exist or is not completed)
        COUNT(DISTINCT er.run_id) FILTER (
            WHERE NOT EXISTS (
                SELECT 1
                FROM view_tests_entry t
                WHERE t.attempt_id = aea.attempt_id
                  AND t.trace_id LIKE 'eval_' || aea.attempt_id::text || '_%'
                  AND SPLIT_PART(t.trace_id, '_', 3) = er.run_id::text
                  AND t.completed = true
            )
        ) as pending_runs
    FROM attempts_with_eval aea
    LEFT JOIN eval_runs_junction er ON er.eval_id = aea.eval_id
    GROUP BY aea.attempt_id, aea.eval_id
),
-- Derive status FROM view_runs_entry counts
attempts_with_status AS (
    SELECT 
        aea.*,
        COALESCE(ass.total_runs, 0) as total_runs,
        COALESCE(ass.completed_runs, 0) as completed_runs,
        COALESCE(ass.pending_runs, 0) as pending_runs,
        CASE 
            WHEN COALESCE(ass.total_runs, 0) = 0 THEN 'pending'
            WHEN COALESCE(ass.pending_runs, 0) > 0 THEN 'running'
            WHEN COALESCE(ass.completed_runs, 0) = COALESCE(ass.total_runs, 0) AND COALESCE(ass.total_runs, 0) > 0 THEN 'completed'
            ELSE 'pending'
        END as status
    FROM attempts_with_eval aea
    LEFT JOIN attempt_status_summary ass ON ass.attempt_id = aea.attempt_id
),
-- Apply filters (status, archived, search, eval_ids, department_ids)
filtered_attempts AS (
    SELECT aas.*
    FROM attempts_with_status aas
    CROSS JOIN params p
    LEFT JOIN attempt_eval_departments aed ON aed.eval_id = aas.eval_id
    WHERE 
        -- Filter by eval_ids if provided
        (p.eval_ids IS NULL OR p.eval_ids = ARRAY[]::uuid[] OR aas.eval_id = ANY(p.eval_ids))
        -- Filter by status if provided
        AND (p.status IS NULL OR p.status = '' OR aas.status = p.status)
        -- Filter by archived if provided
        AND (p.archived IS NULL OR aas.archived = p.archived)
        -- Apply search filter if provided
        AND (
            p.search IS NULL 
            OR p.search = '' 
            OR aas.eval_name ILIKE '%' || p.search || '%'
            OR aas.eval_description ILIKE '%' || p.search || '%'
        )
        -- Filter by department_ids if provided
        AND (
            cardinality(p.department_ids) = 0
            OR aed.department_ids IS NULL 
            OR array_length(aed.department_ids, 1) IS NULL
            OR EXISTS (
                SELECT 1 FROM unnest(p.department_ids) dept_id
                WHERE dept_id::text = ANY(aed.department_ids)
            )
        )
        -- Apply department access control
        AND (
            aed.department_ids IS NULL 
            OR array_length(aed.department_ids, 1) IS NULL
            OR EXISTS (
                SELECT 1 
                FROM attempt_eval_departments aed2
                JOIN user_departments ud ON ud.department_id::text = ANY(aed2.department_ids)
                WHERE aed2.eval_id = aas.eval_id
            )
            OR EXISTS (SELECT 1 FROM user_profile WHERE role IN ('admin', 'superadmin'))
        )
),
-- Apply sorting and pagination
numbered_attempts AS (
    SELECT 
        fa.*,
        ROW_NUMBER() OVER (
            ORDER BY 
                -- Sort by created_at (timestamptz)
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'created_at' AND (SELECT sort_order FROM params) = 'desc' THEN fa.attempt_created_at
                END DESC NULLS LAST,
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'created_at' AND (SELECT sort_order FROM params) = 'asc' THEN fa.attempt_created_at
                END ASC NULLS LAST,
                -- Sort by eval_name (text)
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'eval_name' AND (SELECT sort_order FROM params) = 'desc' THEN fa.eval_name
                END DESC NULLS LAST,
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'eval_name' AND (SELECT sort_order FROM params) = 'asc' THEN fa.eval_name
                END ASC NULLS LAST,
                -- Sort by status (text)
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'status' AND (SELECT sort_order FROM params) = 'desc' THEN fa.status
                END DESC NULLS LAST,
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'status' AND (SELECT sort_order FROM params) = 'asc' THEN fa.status
                END ASC NULLS LAST,
                -- Default fallback: sort by created_at desc
                fa.attempt_created_at DESC NULLS LAST
        ) as rn
    FROM filtered_attempts fa
),
paginated_attempts AS (
    SELECT 
        na.attempt_id,
        na.eval_id,
        na.eval_name,
        na.eval_description,
        na.rubric_id,
        na.rubric_name,
        na.attempt_created_at,
        na.archived,
        na.status,
        na.total_runs,
        na.completed_runs,
        na.pending_runs
    FROM numbered_attempts na
    CROSS JOIN params p
    WHERE na.rn > (p.page * p.page_size) 
      AND na.rn <= ((p.page + 1) * p.page_size)
),
-- Get total count
total_count AS (
    SELECT COUNT(*) as count
    FROM filtered_attempts
),
-- Build composite type arrays for attempts
attempts_array AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (pa.attempt_id, pa.eval_id, pa.eval_name, pa.eval_description, pa.rubric_id, pa.rubric_name,
             pa.attempt_created_at, pa.archived, pa.status, pa.total_runs, pa.completed_runs, pa.pending_runs
            )::types.q_get_benchmark_history_v4_attempt
        ),
        '{}'::types.q_get_benchmark_history_v4_attempt[]
    ) as attempts
    FROM paginated_attempts pa
)
SELECT 
    (SELECT actor_name FROM actor_profile LIMIT 1)::text as actor_name,
    (SELECT attempts FROM attempts_array) as data,
    COALESCE((SELECT count FROM total_count), 0)::int as total_count,
    p.page::int as page,
    p.page_size::int as page_size,
    CASE 
        WHEN p.page_size > 0 THEN CEIL(COALESCE((SELECT count FROM total_count), 0)::float / p.page_size::float)
        ELSE 0
    END::int as total_pages
FROM params p
$$;
