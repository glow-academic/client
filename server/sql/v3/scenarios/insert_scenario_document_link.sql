-- Insert scenario-document link
-- Parameters: $1=scenario_id (uuid), $2=document_id (uuid), $3=active (boolean)
INSERT INTO scenario_documents (scenario_id, document_id, active)
VALUES ($1::uuid, $2::uuid, $3::bool)

