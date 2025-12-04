-- Get randomization data for videos (problem statements, objectives, documents) and existing video links
-- Parameters: 
--   $1=department_ids (uuid array, nullable)
--   $2=video_id (uuid, nullable) - if provided, also returns existing video links
-- Returns: problem_statements, objectives, documents, outline_ids, document_ids as JSON
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
-- Get policy parameter item ID for filtering
policy_param_item AS (
    SELECT pi.id
    FROM parameter_items pi
    JOIN parameters p ON p.id = pi.parameter_id
    WHERE p.name = 'Document Type' AND p.document_parameter = true
    AND pi.value = 'policy'
    LIMIT 1
),
filtered_documents AS (
    SELECT DISTINCT d.id, d.name, '' as description, u.file_path, u.mime_type
    FROM documents d
    LEFT JOIN uploads u ON u.id = d.upload_id
    CROSS JOIN policy_param_item ppi
    JOIN document_parameter_items dpi ON dpi.document_id = d.id AND dpi.parameter_item_id = ppi.id AND dpi.active = true
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    WHERE d.active = true
    GROUP BY d.id, d.name, u.file_path, u.mime_type
    HAVING 
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        (COALESCE(array_length($1::uuid[], 1), 0) = 0 OR
         COUNT(dd.document_id) FILTER (WHERE dd.department_id = ANY($1::uuid[])) > 0
         OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true))
),
video_outline_links AS (
    SELECT ARRAY_AGG(outline_id::text ORDER BY created_at) as outline_ids
    FROM video_outlines
    WHERE video_id = $2::uuid AND active = true
),
video_document_links AS (
    SELECT ARRAY_AGG(document_id::text ORDER BY created_at) as document_ids
    FROM video_documents
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
            'id', fd.id,
            'name', fd.name,
            'description', fd.description,
            'file_path', fd.file_path,
            'mime_type', fd.mime_type
        )),
        '[]'::json
    ) FROM filtered_documents fd) as documents,
    COALESCE((SELECT outline_ids FROM video_outline_links), ARRAY[]::text[]) as outline_ids,
    COALESCE((SELECT document_ids FROM video_document_links), ARRAY[]::text[]) as document_ids

