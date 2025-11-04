SELECT 
    title,
    description,
    rubric_id
FROM simulations
WHERE id = $1

