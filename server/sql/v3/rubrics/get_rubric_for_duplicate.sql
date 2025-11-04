SELECT 
    name,
    description,
    points,
    pass_points
FROM rubrics
WHERE id = $1

