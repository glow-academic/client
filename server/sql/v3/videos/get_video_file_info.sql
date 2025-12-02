SELECT v.name, g.file_path, g.mime_type 
FROM videos v
LEFT JOIN video_generations vg ON vg.video_id = v.id AND vg.active = TRUE
LEFT JOIN generations g ON g.id = vg.generation_id
WHERE v.id = $1::uuid

