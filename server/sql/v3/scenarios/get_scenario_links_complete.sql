-- Get all scenario links (personas, documents, parameter_items) in single query
-- Parameters: $1 = scenario_id (uuid)
-- Returns: persona_ids (text[]), document_ids (text[]), parameter_item_ids (text[])

WITH persona_links AS (
    SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id) as persona_ids
    FROM scenario_personas
    WHERE scenario_id = $1::uuid AND active = true
),
document_links AS (
    SELECT ARRAY_AGG(document_id::text ORDER BY document_id) as document_ids
    FROM scenario_documents
    WHERE scenario_id = $1::uuid AND active = true
),
parameter_item_links AS (
    SELECT ARRAY_AGG(parameter_item_id::text ORDER BY parameter_item_id) as parameter_item_ids
    FROM scenario_parameter_items
    WHERE scenario_id = $1::uuid AND active = true
)
SELECT 
    COALESCE((SELECT persona_ids FROM persona_links), ARRAY[]::text[]) as persona_ids,
    COALESCE((SELECT document_ids FROM document_links), ARRAY[]::text[]) as document_ids,
    COALESCE((SELECT parameter_item_ids FROM parameter_item_links), ARRAY[]::text[]) as parameter_item_ids

