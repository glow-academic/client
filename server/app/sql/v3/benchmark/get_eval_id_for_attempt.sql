SELECT ea.eval_id::text as eval_id
FROM eval_attempts ea
WHERE ea.id = $1::uuid
