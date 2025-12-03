-- Get randomization data for videos (problem statements, objectives, policies) and existing video links
-- Parameters: 
--   $1=department_ids (uuid array, nullable)
--   $2=video_id (uuid, nullable) - if provided, also returns existing video links
-- Returns: problem_statements, objectives, policies, outline_ids, policy_ids as JSON
WITH filtered_problem_statements AS (
    SELECT DISTINCT ps.id, ps.problem_statement, ps.created_at, ps.updated_at
    FROM problem_statements ps
    LEFT JOIN scenario_problem_statements sps ON sps.problem_statement_id = ps.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = sps.scenario_id AND sd.active = true
    WHERE (
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        COALESCE(array_length($1::uuid[], 1), 0) = 0 OR
        sd.department_id = ANY($1::uuid[])
        OR (NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = sps.scenario_id AND sd2.active = true))
    )
    GROUP BY ps.id, ps.problem_statement, ps.created_at, ps.updated_at
),
filtered_objectives AS (
    SELECT DISTINCT o.id, o.objective
    FROM objectives o
    LEFT JOIN scenario_objectives so ON so.objective_id = o.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = so.scenario_id AND sd.active = true
    WHERE (
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        COALESCE(array_length($1::uuid[], 1), 0) = 0 OR
        sd.department_id = ANY($1::uuid[])
        OR (NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = so.scenario_id AND sd2.active = true))
    )
    GROUP BY o.id, o.objective
),
filtered_policies AS (
    SELECT DISTINCT p.id, p.name, COALESCE(p.description, '') as description, u.file_path, u.mime_type
    FROM policies p
    LEFT JOIN uploads u ON u.id = p.upload_id
    LEFT JOIN policy_departments pd ON pd.policy_id = p.id AND pd.active = true
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, u.file_path, u.mime_type
    HAVING 
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        (COALESCE(array_length($1::uuid[], 1), 0) = 0 OR
         COUNT(pd.policy_id) FILTER (WHERE pd.department_id = ANY($1::uuid[])) > 0
         OR NOT EXISTS (SELECT 1 FROM policy_departments pd2 WHERE pd2.policy_id = p.id AND pd2.active = true))
),
video_outline_links AS (
    SELECT ARRAY_AGG(outline_id::text ORDER BY created_at) as outline_ids
    FROM video_outlines
    WHERE video_id = $2::uuid AND active = true
),
video_policy_links AS (
    SELECT ARRAY_AGG(policy_id::text ORDER BY created_at) as policy_ids
    FROM video_policies
    WHERE video_id = $2::uuid AND active = true
)
SELECT 
    (SELECT COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'id', fps.id,
            'problem_statement', fps.problem_statement,
            'created_at', fps.created_at::text,
            'updated_at', fps.updated_at::text
        )),
        '[]'::json
    ) FROM filtered_problem_statements fps) as problem_statements,
    (SELECT COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'id', fo.id,
            'objective', fo.objective
        )),
        '[]'::json
    ) FROM filtered_objectives fo) as objectives,
    (SELECT COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'id', fp.id,
            'name', fp.name,
            'description', fp.description,
            'file_path', fp.file_path,
            'mime_type', fp.mime_type
        )),
        '[]'::json
    ) FROM filtered_policies fp) as policies,
    COALESCE((SELECT outline_ids FROM video_outline_links), ARRAY[]::text[]) as outline_ids,
    COALESCE((SELECT policy_ids FROM video_policy_links), ARRAY[]::text[]) as policy_ids

