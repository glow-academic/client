SELECT name, file_path, mime_type 
FROM videos 
WHERE id = $1::uuid

