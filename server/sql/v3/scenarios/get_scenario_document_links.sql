-- Get scenario's document links
-- Parameters: $1=scenario_id (uuid)
-- Returns: document_id
SELECT document_id FROM scenario_documents 
WHERE scenario_id = $1::uuid

