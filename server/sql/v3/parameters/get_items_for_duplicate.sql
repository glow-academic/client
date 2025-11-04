SELECT 
    id,
    name,
    description,
    value
FROM parameter_items
WHERE parameter_id = $1
ORDER BY name

