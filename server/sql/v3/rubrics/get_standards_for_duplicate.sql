SELECT 
    name,
    description,
    points
FROM standards
WHERE standard_group_id = $1
ORDER BY name

