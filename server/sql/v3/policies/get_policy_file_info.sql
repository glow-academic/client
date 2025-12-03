SELECT p.name, u.file_path, u.mime_type 
FROM policies p
LEFT JOIN uploads u ON u.id = p.upload_id
WHERE p.id = $1

