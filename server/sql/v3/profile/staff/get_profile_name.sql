SELECT first_name || ' ' || last_name as name 
FROM profiles WHERE id = $1

