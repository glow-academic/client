SELECT id
FROM profiles
WHERE role = 'guest' AND default_profile = true
LIMIT 1

