-- Get upload id to validate upload exists
-- Parameters: $1=upload_id (uuid)
-- Returns: id (uuid)
SELECT id FROM uploads WHERE id = $1::uuid

