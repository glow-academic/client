WITH field_to_delete AS (
    SELECT 
        f.id,
        f.name
    FROM fields f
    WHERE f.id = $1::uuid
)
-- Delete field (cascade deletes parameter_fields and field_departments)
DELETE FROM fields
WHERE id = (SELECT id FROM field_to_delete)
RETURNING 
    (SELECT name FROM field_to_delete) as name

