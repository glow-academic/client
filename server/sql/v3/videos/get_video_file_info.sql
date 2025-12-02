SELECT v.name, vg.file_path, vg.mime_type 
FROM videos v
LEFT JOIN video_generations vg ON vg.video_id = v.id AND vg.active = TRUE
WHERE v.id = $1::uuid

