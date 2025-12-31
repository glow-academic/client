SELECT id
FROM tools
WHERE name = $1::text
  AND active = TRUE
LIMIT 1
