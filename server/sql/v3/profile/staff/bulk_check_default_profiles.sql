SELECT id FROM profiles 
WHERE id = ANY($1) AND default_profile = true

