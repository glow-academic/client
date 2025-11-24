-- Search videos by name or description with optional department filter
-- Params: $1 = query string, $2 = limit, $3 = department_ids (text array, nullable)
SELECT 
    v.id,
    v.name,
    v.description,
    v.length_seconds,
    COALESCE(
        (SELECT ARRAY_AGG(vd.department_id::text ORDER BY vd.created_at)
         FROM video_departments vd
         WHERE vd.video_id = v.id AND vd.active = true),
        NULL
    ) as department_ids,
    CASE 
        WHEN LOWER(v.name) = LOWER($1) THEN 100
        WHEN LOWER(v.name) LIKE LOWER($1) || '%' THEN 80
        WHEN LOWER(v.name) LIKE '%' || LOWER($1) || '%' OR LOWER(v.description) LIKE '%' || LOWER($1) || '%' THEN 50
        ELSE 10
    END as score
FROM videos v
-- Only include root videos (parent_id = child_id in video_tree)
JOIN video_tree vt ON vt.parent_id = v.id AND vt.child_id = v.id
WHERE v.active = true
    AND (
        LOWER(v.name) LIKE '%' || LOWER($1) || '%'
        OR LOWER(v.description) LIKE '%' || LOWER($1) || '%'
    )
    -- Filter by department if provided
    AND (
        $3 IS NULL 
        OR array_length($3::text[], 1) IS NULL
        OR EXISTS (
            SELECT 1 FROM video_departments vd2
            WHERE vd2.video_id = v.id 
            AND vd2.active = true
            AND vd2.department_id::text = ANY($3::text[])
        )
        OR NOT EXISTS (
            SELECT 1 FROM video_departments vd3
            WHERE vd3.video_id = v.id AND vd3.active = true
        )
    )
ORDER BY score DESC, v.name
LIMIT $2;

