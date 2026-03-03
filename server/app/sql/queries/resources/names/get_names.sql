-- Get names resources by IDs
-- Parameters: $1 = ids (uuid[])

SELECT n.id, n.name, COALESCE(n.generated, false) AS generated
FROM names_resource n
WHERE n.id = ANY($1)
  AND n.name IS NOT NULL
  AND n.name != ''
ORDER BY array_position($1, n.id);
