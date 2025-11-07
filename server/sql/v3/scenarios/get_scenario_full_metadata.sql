-- Get scenario with all related data in single query
-- Parameters: $1=scenario_id (uuid)
-- Returns: id, name, problem_statement, active, generated, created_at, updated_at, use_documents, document_ids (uuid array), parameter_item_ids (uuid array), persona_ids (text array)
SELECT 
    s.id,
    s.name,
    sps.problem_statement,
    s.active,
    s.generated,
    s.created_at,
    s.updated_at,
    s.use_documents,
    COALESCE(ARRAY_AGG(DISTINCT sd.document_id) FILTER (WHERE sd.document_id IS NOT NULL), ARRAY[]::uuid[]) as document_ids,
    COALESCE(ARRAY_AGG(DISTINCT spi.parameter_item_id) FILTER (WHERE spi.parameter_item_id IS NOT NULL), ARRAY[]::uuid[]) as parameter_item_ids,
    COALESCE((
        SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id)
        FROM scenario_personas 
        WHERE scenario_id = s.id AND active = true
    ), ARRAY[]::text[]) as persona_ids
FROM scenarios s
LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
LEFT JOIN scenario_parameter_items spi ON spi.scenario_id = s.id
WHERE s.id = $1::uuid
GROUP BY s.id, s.name, sps.problem_statement, s.active, 
         s.generated, s.created_at, s.updated_at, s.use_documents

