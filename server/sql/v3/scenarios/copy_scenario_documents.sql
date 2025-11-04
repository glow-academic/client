INSERT INTO scenario_documents (scenario_id, document_id, active)
SELECT $1, document_id, active
FROM scenario_documents
WHERE scenario_id = $2

