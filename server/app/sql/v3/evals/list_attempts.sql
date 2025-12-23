-- List eval attempts with pagination, filtering, and status information
-- Parameters: 
--   $1 = profile_id (uuid)
--   $2 = eval_ids (uuid[], optional) - filter by eval IDs
--   $3 = status (text, optional) - filter by status (pending/running/completed)
--   $4 = archived (bool, optional) - filter archived attempts
--   $5 = search (text, optional) - search in eval name and description
--   $6 = page (int) - page number (0-indexed)
--   $7 = page_size (int) - page size
-- Returns: attempts with eval info, status, and run counts

WITH resolve_profile_id AS (
    -- Resolve profile ID from parameter
    SELECT 
        CASE 
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = (SELECT resolved_profile_id FROM resolve_profile_id) AND active = true
),
user_profile AS (
    SELECT 
        role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = (SELECT resolved_profile_id FROM resolve_profile_id)
),
-- Get eval attempts with eval info
attempts_with_eval AS (
    SELECT 
        ea.id as attempt_id,
        ea.created_at as attempt_created_at,
        ea.eval_id,
        ea.archived,
        e.name as eval_name,
        e.description as eval_description,
        e.rubric_id,
        r.name as rubric_name
    FROM eval_attempts ea
    JOIN evals e ON e.id = ea.eval_id
    JOIN rubrics r ON r.id = e.rubric_id
    WHERE 
        -- Filter by eval_ids if provided
        ($2::uuid[] IS NULL OR $2 = ARRAY[]::uuid[] OR ea.eval_id = ANY($2))
        -- Filter by archived if provided
        AND ($4::bool IS NULL OR ea.archived = $4)
),
-- Get eval departments for access control
eval_departments AS (
    SELECT 
        ed.eval_id,
        ARRAY_AGG(ed.department_id::text ORDER BY ed.created_at) as department_ids
    FROM eval_departments ed
    WHERE ed.active = true
    GROUP BY ed.eval_id
),
-- Calculate run counts and status for each attempt
attempt_status_summary AS (
    SELECT 
        aea.attempt_id,
        aea.eval_id,
        -- Count runs from eval_runs for this eval
        COUNT(DISTINCT er.run_id) as total_runs,
        -- Count completed runs (where test exists and is completed)
        COUNT(DISTINCT er.run_id) FILTER (
            WHERE EXISTS (
                SELECT 1
                FROM attempt_tests at
                JOIN tests t ON t.id = at.test_id
                WHERE at.attempt_id = aea.attempt_id
                  AND t.trace_id LIKE 'eval_' || aea.attempt_id::text || '_%'
                  AND SPLIT_PART(t.trace_id, '_', 3) = er.run_id::text
                  AND t.completed = true
            )
        ) as completed_runs,
        -- Count pending runs (where test doesn't exist or is not completed)
        COUNT(DISTINCT er.run_id) FILTER (
            WHERE NOT EXISTS (
                SELECT 1
                FROM attempt_tests at
                JOIN tests t ON t.id = at.test_id
                WHERE at.attempt_id = aea.attempt_id
                  AND t.trace_id LIKE 'eval_' || aea.attempt_id::text || '_%'
                  AND SPLIT_PART(t.trace_id, '_', 3) = er.run_id::text
                  AND t.completed = true
            )
        ) as pending_runs
    FROM attempts_with_eval aea
    LEFT JOIN eval_runs er ON er.eval_id = aea.eval_id
    GROUP BY aea.attempt_id, aea.eval_id
),
-- Derive status from run counts
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
-- Apply status filter and search if provided
filtered_attempts AS (
    SELECT *
    FROM attempts_with_status
    WHERE 
        ($3::text IS NULL OR $3 = '' OR status = $3)
        -- Apply search filter if provided
        AND (
            $5::text IS NULL 
            OR $5 = '' 
            OR eval_name ILIKE '%' || $5 || '%'
            OR eval_description ILIKE '%' || $5 || '%'
        )
        -- Apply department access control
        AND (
            NOT EXISTS (SELECT 1 FROM eval_departments ed WHERE ed.eval_id = eval_id)
            OR EXISTS (
                SELECT 1 
                FROM eval_departments ed
                JOIN user_departments ud ON ud.department_id::text = ANY(ed.department_ids)
                WHERE ed.eval_id = eval_id
            )
            OR EXISTS (SELECT 1 FROM user_profile WHERE role IN ('admin', 'superadmin'))
        )
),
-- Apply pagination
paginated_attempts AS (
    SELECT *
    FROM filtered_attempts
    ORDER BY attempt_created_at DESC
    LIMIT $7 OFFSET ($6 * $7)
),
-- Get total count
total_count AS (
    SELECT COUNT(*) as count
    FROM filtered_attempts
)
SELECT 
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'attempt_id', attempt_id::text,
                'eval_id', eval_id::text,
                'eval_name', eval_name,
                'eval_description', eval_description,
                'rubric_id', rubric_id::text,
                'rubric_name', rubric_name,
                'created_at', attempt_created_at,
                'archived', archived,
                'status', status,
                'total_runs', total_runs,
                'completed_runs', completed_runs,
                'pending_runs', pending_runs
            ) ORDER BY attempt_created_at DESC
        ),
        '[]'::jsonb
    ) as attempts,
    COALESCE((SELECT count FROM total_count), 0) as total_count,
    $6 as page,
    $7 as page_size,
    CASE 
        WHEN $7 > 0 THEN CEIL(COALESCE((SELECT count FROM total_count), 0)::float / $7)
        ELSE 0
    END as total_pages,
    up.actor_name
FROM paginated_attempts
CROSS JOIN user_profile up

