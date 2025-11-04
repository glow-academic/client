INSERT INTO profiles (id, first_name, alias, role, viewed_intro)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, first_name, alias, role

