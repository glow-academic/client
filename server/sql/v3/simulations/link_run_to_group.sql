-- Link run to group with auto-incrementing idx
-- Parameters: $1=group_id (uuid), $2=run_id (uuid)
INSERT INTO group_runs (group_id, run_id, idx, created_at, updated_at)
VALUES (
    $1::uuid, 
    $2::uuid, 
    COALESCE((SELECT MAX(idx) FROM group_runs WHERE group_id = $1::uuid), -1) + 1,
    NOW(), 
    NOW()
)
ON CONFLICT (group_id, run_id) DO NOTHING

