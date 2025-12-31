-- Get persona by name
-- Parameters: $1=persona_name (text), $2=chat_id (uuid, unused)
-- Returns: id (uuid)
SELECT id
FROM personas
WHERE lower(name) = lower($1::text)
  AND active = true
ORDER BY name
LIMIT 1;
