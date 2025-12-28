SELECT total
FROM feedbacks
WHERE grade_id = $1::uuid
