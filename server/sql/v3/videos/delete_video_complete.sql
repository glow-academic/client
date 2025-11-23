-- Delete video with existence and usage checks in a single transaction
-- Parameters: $1=videoId
-- Returns: video_id, name if deleted, or no rows if video doesn't exist or is in use
WITH video_info AS (
    -- Check if video exists and get name
    SELECT 
        v.id,
        v.name,
        (SELECT COUNT(*) FROM simulation_videos WHERE video_id = v.id AND active = true) as usage_count
    FROM videos v
    WHERE v.id = $1::uuid
),
delete_video AS (
    -- Delete video only if it exists and is not in use
    -- Cascades will handle: video_questions, question_times, video_departments, video_tree
    DELETE FROM videos
    WHERE id IN (
        SELECT id FROM video_info WHERE usage_count = 0
    )
    RETURNING id::text as video_id, name
)
-- Return video info (even if not deleted, so caller can determine error)
SELECT 
    vi.id::text as video_id,
    vi.name,
    vi.usage_count,
    CASE WHEN dv.video_id IS NOT NULL THEN true ELSE false END as deleted
FROM video_info vi
LEFT JOIN delete_video dv ON dv.video_id = vi.id::text

