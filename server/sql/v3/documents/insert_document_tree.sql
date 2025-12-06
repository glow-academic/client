-- Insert document_tree junction record
-- Parameters: $1=parent_id (uuid), $2=child_id (uuid), $3=active (boolean)
-- Links a parent document to a child document
INSERT INTO document_tree (parent_id, child_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, $3, NOW(), NOW())
ON CONFLICT (parent_id, child_id) DO UPDATE SET
    active = EXCLUDED.active,
    updated_at = NOW();

