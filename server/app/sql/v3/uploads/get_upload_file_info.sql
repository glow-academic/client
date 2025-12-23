-- Get upload file info for download
-- Parameters: $1=upload_id
SELECT 
    u.id,
    u.file_path,
    u.mime_type,
    u.size
FROM uploads u
WHERE u.id = $1::uuid;

