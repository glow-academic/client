-- Parameters: feedback_id=UUID, resolved=boolean
-- Updates the resolved status of a feedback entry
UPDATE feedback
SET resolved = $2
WHERE id = $1
RETURNING id, resolved;

