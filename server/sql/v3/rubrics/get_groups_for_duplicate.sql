SELECT 
    id,
    name,
    short_name,
    description,
    points,
    pass_points
FROM standard_groups
WHERE rubric_id = $1
ORDER BY name

