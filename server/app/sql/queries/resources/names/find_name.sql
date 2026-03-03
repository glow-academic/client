-- Find existing name resource by name text
-- Parameters: $1 = name (text)

SELECT nr.id
FROM names_resource nr
WHERE nr.name = $1
LIMIT 1;
