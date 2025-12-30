-- Update document name
-- Parameters: $1=document_id (uuid), $2=name (text)
-- Returns: document_id, name
UPDATE documents
SET name = $2::text,
    updated_at = NOW()
WHERE id = $1::uuid
RETURNING id as document_id, name

